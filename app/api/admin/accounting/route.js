import {packingJournal} from "@/lib/packing.mjs";
import {settlementJournal} from "@/lib/marketplaceFinance.mjs";
import {assertAvailable} from "@/lib/reservations.mjs";
import { businessUseJournal } from '@/lib/businessUse.mjs';
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, requireRole } from "@/lib/admin";
import { auditPayload, text } from "@/lib/serverData";
import { defaultAccounts, accountTypes, defaultAccountingSettings, validateJournal, day, today, cents, line, normaliseTax, normaliseIncomeTax, incomeTaxEstimate, productBook, taxForDate, accountingReadiness, splitTax, moneyAccounts, paymentAccount, depreciation, reportLedger, ageDocuments, saleJournal, expenseJournal, cashJournal, sourceDay } from "@/lib/accounting.mjs";
import { configRef, accountingContext, assertOpen, writeJournal, loadAccounting, payloadHash, sourceKey } from "@/lib/accountingServer";
import { priceChange } from "@/lib/priceHistory.mjs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
const error=(message,status=400)=>NextResponse.json({error:message},{status,headers});
const identifier=value=>{const id=text(value,120);if(!/^[a-zA-Z0-9-]{8,120}$/.test(id))throw new Error("A valid request reference is required.");return id;};
function rowsFromForm(rows) {return (rows||[]).map(r=>({account:r.account,debit:cents(r.debit||0),credit:cents(r.credit||0),label:text(r.label,160)})).filter(r=>r.debit||r.credit);}
export async function GET(request){
  const access=await requireRole(request,["owner","admin"]);if(access.error)return error(access.error,access.status);
  try{const data=await loadAccounting(adminDb()),url=new URL(request.url),end=day(url.searchParams.get("end")||today()),start=day(url.searchParams.get("start")||data.settings.startDate||end.slice(0,7)+"-01");
    if(data.settings.startDate&&end<data.settings.startDate)throw new Error("This period predates accounting setup. Choose a date on/after the opening date.");
    return NextResponse.json({...data,setupIssues:accountingReadiness(data,end),report:reportLedger(data.journals,data.settings.accounts,start,end),balances:ageDocuments(data.documents,end),incomeTaxEstimate:incomeTaxEstimate(data.journals,data.settings,start,end)},{headers});
  }catch(e){return error(e.message,409);}
}
export async function POST(request){
  const access=await requireRole(request,["owner","admin"]);if(access.error)return error(access.error,access.status);
  const b=await request.json().catch(()=>({})),store=adminDb();
  try{
    const requestId=identifier(b.requestId),requestRef=store.collection("accounting_requests").doc(requestId),mode=b.mode==="preview"?"preview":"apply";
    if(!["setup","settings","account","journal","reverse","review","valuation","document","payment","refund","credit","payment-reverse","asset-opening","depreciation","dispose","reconcile","close","reopen","source"].includes(b.action))throw new Error("Choose an accounting action.");
    const date=day(b.date||today());if(date>today()&&!["settings","account"].includes(b.action))throw new Error("Future financial postings are not allowed.");
    const reason=text(b.reason,500);if(!reason)throw new Error("Enter a description or reason for this accounting action.");
    const requestBody={...b};delete requestBody.mode;delete requestBody.previewHash;delete requestBody.expectedVersion;
    const fingerprint=payloadHash(requestBody);
    const result=await store.runTransaction(async tx=>{
      const oldRequest=await tx.get(requestRef);
      if(oldRequest.exists){if(oldRequest.data().fingerprint!==fingerprint)throw new Error("This request reference was used for different details.");return {...oldRequest.data().result,duplicate:true};}
      const context=await accountingContext(tx,store,date),s=context.settings;
      const plan={action:b.action,date,description:reason,journals:[],document:null,changes:[],warnings:[],priceChanges:[]},writes=[];
      const updateProductPrice=(ref,previous,patch)=>{const change=priceChange(previous,{...previous,...patch});if(change)plan.priceChanges.push(change);writes.push(()=>tx.update(ref,patch));};
      let settings=null,original=null;
      const journalRef=store.collection("accounting_journals").doc(`manual-${requestId}`);
      const accounts=s.accounts||defaultAccounts;
      const entry=(lines,extra={})=>validateJournal({date,description:reason,reference:text(b.reference,120),cashFlow:b.cashFlow||"operating",lines,...extra},accounts);
      const account=(code,types=accountTypes)=>{const a=accounts.find(a=>a.code===code&&a.active&&types.includes(a.type));if(!a)throw new Error("Choose an active account of the correct type.");return a;};
      if(b.action==="setup"){
        if(s.active)throw new Error("Opening setup has already been posted. Use an audited adjustment.");
        if(b.openingConfirmed!==true)throw new Error("Confirm that the opening balances have been reviewed.");
        if(date!==today())throw new Error("Initial setup snapshots current stock. Start accounting today; earlier activity should be included in reviewed opening balances.");
        const openingLines=rowsFromForm(b.lines);
        const opening=entry(openingLines,{kind:"opening",cashFlow:"opening",...(openingLines.length?{}:{nonfinancial:true,sourceType:"opening"})});
        if(opening.lines.some(l=>accounts.find(a=>a.code===l.account)?.type==="income"||accounts.find(a=>a.code===l.account)?.type==="expense"))throw new Error("Opening balances use asset, liability and equity accounts only.");
        const cutoverAt=String(b.cutoverAt||"");
        if(!Number.isFinite(Date.parse(cutoverAt))||cutoverAt.slice(0,10)!==date||Date.parse(cutoverAt)>Date.now())throw new Error("Choose a valid opening cutover time today.");
        const products=await tx.get(store.collection("products"));
        const setupSources=await Promise.all(["sales","expenses","cash_movements","stock_movements"].map(collection=>tx.get(store.collection(collection))));
        const setupSourcesHash=payloadHash(setupSources.map(snapshot=>snapshot.docs.map(d=>d.id).sort()));
        const openingStock=products.docs.map(d=>({productId:d.data().id||decodeURIComponent(d.id),sku:d.data().sku||d.id,name:d.data().name,quantity:Number(d.data().stock||0),unitCost:d.data().costPrice==null?null:cents(d.data().costPrice)}));
        const unknown=openingStock.filter(p=>p.quantity&&p.unitCost==null);
        if(unknown.length)plan.warnings.push(`${unknown.length} products have stock without recorded cost. Inventory valuation needs review.`);
        const inventory=openingStock.reduce((n,p)=>n+p.quantity*(p.unitCost||0),0),book=opening.lines.filter(l=>l.account==="1200").reduce((n,l)=>n+l.debit-l.credit,0);
        if(book!==inventory)plan.warnings.push("Opening inventory account differs from current stock at recorded cost. Reconcile this difference before relying on stock valuation.");
        opening.issues=[...plan.warnings];
        settings={...defaultAccountingSettings(),active:true,accounts:s.accounts,incomeTax:s.incomeTax||normaliseIncomeTax(),startDate:date,cutoverAt,setupSourcesHash,version:Number(s.version)+1,openingConfirmed:true,openingStock,costing:b.costing==="weighted-average"?"weighted-average":"recorded-cost",tax:s.tax,createdAt:FieldValue.serverTimestamp(),createdBy:access.user.uid};
        plan.journals.push(opening);plan.changes.push("Activate accounting from "+date,"Snapshot opening stock; historical receipts stay unchanged");
      }else if(b.action==="settings"){
        if(Number(b.expectedVersion)!==Number(s.version))throw new Error("Accounting settings changed. Refresh before saving.");
        const tax=normaliseTax(b.tax);
        tax.effectiveDate=tax.effectiveDate||today();
        const { history: taxHistory, ...previousTax }=s.tax;
        tax.history=[...(taxHistory||[]),previousTax];
        if(tax.enabled&&tax.effectiveDate<today())throw new Error("New tax settings must start today or later; historical receipts retain their snapshots.");
        settings={...s,tax,incomeTax:normaliseIncomeTax(b.incomeTax),version:Number(s.version)+1};plan.changes.push("Update tax settings prospectively; catalogue prices remain tax-inclusive",`Accounting invoice price mode: ${tax.pricingMode}`);
      }else if(b.action==="account"){
        const code=text(b.code,12),name=text(b.name,100),type=b.type;
        if(!/^[0-9]{4,8}$/.test(code)||!name||!accountTypes.includes(type))throw new Error("Enter an account code, name and type.");
        const current=accounts.find(a=>a.code===code);
        if(current&&current.type!==type)throw new Error("An existing account's type cannot be changed.");
        if(current?.system&&b.active===false)throw new Error("System posting accounts must remain active.");
        settings={...s,accounts:[...accounts.filter(a=>a.code!==code),{code,name,type,system:current?.system||false,active:b.active!==false,cashAccount:current?.system?moneyAccounts.includes(code):b.cashAccount===true&&type==="asset",cashFlow:["operating","investing","financing"].includes(b.cashFlow)?b.cashFlow:"operating"}].sort((a,b)=>a.code.localeCompare(b.code)),version:Number(s.version)+1};plan.changes.push(`${current?"Update":"Add"} account ${code} ${name}`);
      }else{
        if(b.action!=="reopen")assertOpen(s,date);
        if(b.action==="journal"){
          if(!["operating","investing","financing","unclassified"].includes(b.cashFlow))throw new Error("Choose a cash-flow classification.");
          plan.journals.push(entry(rowsFromForm(b.lines)));
        }else if(b.action==="review"){
          const ref=store.collection("accounting_journals").doc(identifier(b.journalId)),snap=await tx.get(ref);
          if(!snap.exists||b.confirm!==true)throw new Error("Select a journal and confirm that its issues have been resolved or assessed.");
          if(date<snap.data().date)throw new Error("Review date cannot precede its journal.");
          writes.push(()=>tx.update(ref,{reviewedBy:access.user.uid,reviewReason:reason,reviewedAt:FieldValue.serverTimestamp()}));plan.changes.push("Record issue review; journal amounts stay unchanged");
        }else if(b.action==="valuation"){
          if(date!==today())throw new Error("Inventory value review uses today's current stock.");
          const productRef=store.collection("products").doc(encodeURIComponent(text(b.productId,160))),snap=await tx.get(productRef);if(!snap.exists)throw new Error("Product not found.");
          const p=snap.data(),book=productBook(p,s),value=cents(b.newValue),previous=book.value==null?cents(b.currentValue):book.value;
          if(book.quantity!==Number(p.stock||0))throw new Error("Resolve pending stock receipts/adjustments before reviewing this product's value.");
          if(!book.quantity&&value)throw new Error("A zero-stock product must have zero inventory book value.");
          account(b.offsetAccount,["equity","expense"]);const difference=value-previous;
          if(difference)plan.journals.push(entry([line("1200",difference/100),line(b.offsetAccount,-difference/100)],{cashFlow:"operating",productId:p.id}));
          const allocation={id:requestId,date,settingsVersion:s.version+0.5,productId:p.id,sku:p.sku||p.id,name:p.name,quantity:book.quantity,previous,value,reason,postedBy:access.user.uid,postedAt:FieldValue.serverTimestamp()};
          writes.push(()=>tx.create(store.collection("accounting_stock_values").doc(requestId),allocation));
          updateProductPrice(productRef,p,{accountingStockQuantity:book.quantity,accountingStockValueCents:value,...(book.quantity>0?{costPrice:Math.round(value/book.quantity)/100}:{}),updatedAt:FieldValue.serverTimestamp()});
          plan.changes.push("Allocate reviewed cost to "+p.sku+"; stock quantity and images stay unchanged.");
        }else if(b.action==="reverse"){
          const ref=store.collection("accounting_journals").doc(identifier(b.journalId)),snap=await tx.get(ref);
          if(!snap.exists||snap.data().kind==="opening"||snap.data().reversalOf)throw new Error("Choose an original, non-opening journal.");
          const existing=await tx.get(store.collection("accounting_reversals").doc(ref.id));if(existing.exists)throw new Error("This journal has already been reversed.");
          if(snap.data().sourceType)throw new Error("Use the original source workflow for a sale/expense correction. Use a reclassification journal to change accounts.");
          if(snap.data().documentId||snap.data().assetId)throw new Error("Linked invoices, bills, payments and assets need document adjustments; use the Journals correction form with a reference, retaining the register history.");
          original=snap.data();plan.journals.push(entry(original.lines.map(l=>({...l,debit:l.credit,credit:l.debit})),{reversalOf:ref.id,cashFlow:original.cashFlow}));writes.push(()=>tx.create(store.collection("accounting_reversals").doc(ref.id),{journalId:journalRef.id,reason,date}));
        }else if(b.action==="document"){
          if(!["invoice","bill","asset"].includes(b.kind))throw new Error("Choose an invoice, supplier bill or business asset acquisition.");
          const id=`DOC-${requestId}`,ref=store.collection("accounting_documents").doc(id),party=text(b.party,160),dueDate=day(b.dueDate||date);
          if(!party||dueDate<date||!Array.isArray(b.items)||!b.items.length||b.items.length>40)throw new Error("Enter a customer/supplier, valid due date and 1–40 items.");
          const rows=[],items=[],inventoryChanges=[],taxTotals=new Map(),activeTax=taxForDate(s.tax,date);let total=0;
          const inventoryRefs=b.items.filter(i=>i.productId).map(i=>store.collection("products").doc(encodeURIComponent(i.productId)));
          const productSnaps=inventoryRefs.length?await tx.getAll(...inventoryRefs):[],productMap=new Map(productSnaps.map(d=>[d.data()?.id||decodeURIComponent(d.id),d]));
          if(new Set(b.items.filter(i=>i.productId).map(i=>i.productId)).size!==b.items.filter(i=>i.productId).length)throw new Error("Combine duplicate products into one document line.");
          for(const item of b.items){
            const quantity=Number(item.quantity),unit=cents(item.unitPrice),label=text(item.description,160);
            if(!label||!Number.isInteger(quantity)||quantity<1||quantity>100000||!unit)throw new Error("Each line needs a description, positive whole quantity and unit price.");
            const code=b.kind==="asset"?"1500":item.account;account(code,b.kind==="invoice"?["income"]:["asset","expense"]);
            const split=splitTax(quantity*unit/100,activeTax,date,item.taxExempt===true,activeTax.pricingMode);
            const recover=b.kind!=="invoice"&&b.recoverTax===true&&split.enabled;
            total+=split.total;rows.push(line(code,(b.kind==="invoice"?-split.net:recover?split.net:split.total)/100,label));
            if(split.enabled&&(b.kind==="invoice"||recover))for(const tax of split.lines){if(!tax.cents)continue;const key=b.kind==="invoice"?tax.account:"2230";taxTotals.set(key,(taxTotals.get(key)||0)+(b.kind==="invoice"?-tax.cents:tax.cents));}
            items.push({description:label,quantity,unitPrice:unit,account:code,productId:text(item.productId,160),tax:split,total:split.total});
            if(item.productId){
              if(b.kind==="invoice"){
                const snap=productMap.get(item.productId),p=snap?.data();
                if(!p||p.active===false||p.archived||Number(p.stock||0)<quantity)throw new Error("This invoice product is inactive or has insufficient stock.");
                const unitCost=p.costPrice==null?0:cents(p.costPrice),valued=productBook(p,s).quantity,book=productBook(p,s).value,tracked=s.costing==="weighted-average"&&Number.isSafeInteger(book)&&Number.isInteger(valued)&&valued>=quantity,cost=tracked?Math.round(book*quantity/valued):unitCost*quantity;
                Object.assign(items.at(-1),{sku:p.sku||p.id,variantOptions:p.variantOptions||{},colour:p.colour||"",size:p.size||"",unitCost,costRecorded:p.costPrice!=null});
                if(p.costPrice==null)plan.warnings.push("Product cost is missing for "+p.name+". Review the cost before relying on profit.");
                if(cost)rows.push(line("5000",cost/100,"Invoice product cost"),line("1200",-cost/100,"Invoice stock cost"));
                inventoryChanges.push({productId:p.id,sku:p.sku||p.id,name:p.name,quantity:-quantity,cost:-cost});
                assertAvailable(p,quantity);
                writes.push(()=>tx.update(snap.ref,{stock:Number(p.stock)-quantity,...(Number.isInteger(valued)?{accountingStockQuantity:valued-quantity,accountingStockValueCents:Number.isSafeInteger(book)?book-cost:null}:{}),updatedAt:FieldValue.serverTimestamp()}));
                const movementRef=store.collection("stock_movements").doc("INVOICE-"+requestId+"-"+inventoryChanges.length);
                writes.push(()=>tx.create(movementRef,{type:"sale",productId:p.id,productName:p.name,quantity:-quantity,qtyChange:-quantity,oldStock:Number(p.stock),newStock:Number(p.stock)-quantity,accountingDocumentId:id,reason,staff:access.user.uid,createdAt:FieldValue.serverTimestamp()}));
                continue;
              }
              if(b.kind!=="bill"||code!=="1200")throw new Error("Physical stock receipts must use Retail inventory on a supplier bill.");
              const snap=productMap.get(item.productId);if(!snap?.exists)throw new Error("Product not found.");
              const p=snap.data(),oldStock=Number(p.stock||0),oldCost=p.costPrice==null?null:cents(p.costPrice),receiptCost=Math.round((recover?split.net:split.total)/quantity);
              if(item.receiveStock!==true&&!item.stockMovementId)throw new Error("Choose Receive stock now or link an existing stock receipt.");
              if(item.receiveStock===true&&item.stockMovementId)throw new Error("Choose one stock receipt option.");
              if(item.stockMovementId){const moveRef=store.collection("stock_movements").doc(item.stockMovementId),move=await tx.get(moveRef),posted=await tx.get(store.collection("accounting_journals").doc(sourceKey("stock",item.stockMovementId)));if(!move.exists||move.data().type!=="receive"||move.data().productId!==item.productId||Number(move.data().quantity??move.data().qtyChange)!==quantity||move.data().accountingDocumentId||posted.exists)throw new Error("This stock receipt is missing, already linked or does not match the product and quantity.");writes.push(()=>tx.update(moveRef,{accountingDocumentId:id}));}
              if(s.costing==="weighted-average"&&oldStock>0&&oldCost==null)throw new Error("Record the existing product cost before using weighted-average receipts.");
              const newStock=item.receiveStock?oldStock+quantity:oldStock,priorQuantity=item.receiveStock?oldStock:Math.max(0,oldStock-quantity),newCost=s.costing==="weighted-average"&&priorQuantity>0?Math.round((priorQuantity*oldCost+(recover?split.net:split.total))/(priorQuantity+quantity)):receiptCost;
              const initialBook=productBook(p,s),priorBook=Number.isSafeInteger(initialBook.value)?initialBook.value:priorQuantity*(oldCost||0),priorValued=initialBook.quantity,bookValue=priorBook+(recover?split.net:split.total),valuedQuantity=priorValued+quantity,average=s.costing==="weighted-average"&&valuedQuantity>0?Math.round(bookValue/valuedQuantity):newCost;
              inventoryChanges.push({productId:item.productId,sku:p.sku||p.id,name:p.name,quantity,cost:recover?split.net:split.total,unitCost:average,physicalReceipt:item.receiveStock===true,stockMovementId:item.stockMovementId||""});
              updateProductPrice(snap.ref,p,{...(item.receiveStock?{stock:newStock}:{}),costPrice:average/100,accountingStockQuantity:valuedQuantity,accountingStockValueCents:bookValue,updatedAt:FieldValue.serverTimestamp()});
              const receiptIndex=inventoryChanges.length;
              if(item.receiveStock)writes.push(()=>tx.create(store.collection("stock_movements").doc(`ACCT-${requestId}-${receiptIndex}`),{type:"receive",productId:item.productId,productName:p.name,quantity,qtyChange:quantity,oldStock,newStock,supplier:party,reason,accountingDocumentId:id,staff:access.user.uid,staffEmail:access.user.email||"",createdAt:FieldValue.serverTimestamp()}));
            }
          }
          for(const [code,n]of taxTotals)rows.push(line(code,n/100,"Document tax"));
          const control=b.kind==="invoice"?"1100":"2000";rows.push(line(control,(b.kind==="invoice"?total:-total)/100,party));
          const document={id,kind:b.kind==="asset"?"bill":b.kind,date,dueDate,party,reference:text(b.reference,120),description:reason,items,total,payments:[],taxSnapshot:activeTax,createdBy:access.user.uid,assetAcquisition:b.kind==="asset",journalId:journalRef.id};
          plan.document=document;plan.journals.push(entry(rows,{documentId:id,inventoryChanges,taxSnapshot:activeTax,issues:plan.warnings.filter(w=>w.includes("cost is missing")),cashFlow:b.kind==="asset"?"investing":"operating"}));writes.push(()=>tx.create(ref,document));
          if(b.kind==="asset"){
            if(b.items.length!==1)throw new Error("Record each business asset separately.");
            const asset={id:`ASSET-${requestId}`,name:items[0].description,acquisitionDate:date,cost:b.recoverTax&&items[0].tax.enabled?items[0].tax.net:items[0].total,salvage:cents(b.salvage||0),months:Number(b.months),inServiceDate:day(b.inServiceDate||date),depreciated:0,documentId:id,disposed:false};
            depreciation(asset,new Date(Date.UTC(new Date(asset.inServiceDate).getUTCFullYear(),new Date(asset.inServiceDate).getUTCMonth()+1,0)).toISOString().slice(0,10));
            if(asset.inServiceDate<date)throw new Error("In-service date cannot precede asset acquisition.");
            writes.push(()=>tx.create(store.collection("accounting_assets").doc(asset.id),asset));plan.changes.push(`Register asset ${asset.name}`);
          }
        }else if(b.action==="payment"||b.action==="refund"){
          const ref=store.collection("accounting_documents").doc(identifier(b.documentId)),snap=await tx.get(ref);
          if(!snap.exists)throw new Error("Document not found.");const d=snap.data(),amount=cents(b.amount),paid=(d.payments||[]).filter(p=>!p.reversedDate).reduce((n,p)=>n+p.amount,0)+(d.credits||[]).reduce((n,p)=>n+p.amount,0);
          const balance=d.total-paid,refund=b.action==="refund";
          if(date<d.date||!amount||refund&&amount>-balance||!refund&&amount>balance)throw new Error("Payment/refund must be positive, no more than its outstanding balance, and dated on/after the document.");
          const cash=account(b.paymentAccount,["asset"]).code;if(!moneyAccounts.includes(cash)&&!accounts.find(a=>a.code===cash)?.cashAccount)throw new Error("Choose a cash, bank or Mobile Money account.");
          const signed=refund?-amount:amount,rows=d.kind==="invoice"?[line(cash,signed/100),line("1100",-signed/100,d.party)]:[line("2000",signed/100,d.party),line(cash,-signed/100)];
          plan.journals.push(entry(rows,{documentId:d.id,cashFlow:d.assetAcquisition?"investing":"operating"}));
          const payment={id:requestId,date,amount:signed,account:cash,journalId:journalRef.id,reference:text(b.reference,120),refund};
          writes.push(()=>tx.update(ref,{payments:[...(d.payments||[]),payment]}));plan.changes.push(`Record payment against ${d.id}`);
        }else if(b.action==="credit"){
          const ref=store.collection("accounting_documents").doc(identifier(b.documentId)),snap=await tx.get(ref);if(!snap.exists)throw new Error("Document not found.");
          const d=snap.data(),amount=cents(b.amount),credited=(d.credits||[]).reduce((n,p)=>n+p.amount,0);
          if(date<d.date||!amount||amount>d.total-credited)throw new Error("Credit must be positive, no more than the remaining document value, and dated after the original document.");
          const originalSnap=await tx.get(store.collection("accounting_journals").doc(d.journalId));if(!originalSnap.exists)throw new Error("Original document journal is missing.");
          const original=originalSnap.data(),fraction=amount/d.total;
          if(d.assetAcquisition){const assetSnaps=await tx.get(store.collection("accounting_assets").where("documentId","==",d.id));if(!assetSnaps.docs.length||assetSnaps.docs.some(a=>!a.data().disposed))throw new Error("Record disposal/return of this business asset first, then credit its supplier bill. Asset and depreciation history remain intact.");plan.warnings.push("Asset already disposed: this supplier credit offsets disposal expense and updates the supplier balance.");}
          const stockItems=d.items.filter(i=>i.productId),stockSnaps=stockItems.length?await tx.getAll(...stockItems.map(i=>store.collection("products").doc(encodeURIComponent(i.productId)))):[];
          if(stockItems.length&&b.restoreStock!==true)throw new Error("Confirm physical stock return before crediting this stock document.");
          const quantities=stockItems.map(i=>i.quantity*fraction);
          if(quantities.some(n=>!Number.isInteger(n)))throw new Error("This credit amount does not represent whole units across the document. Credit a proportional whole-unit amount or use a separately reviewed adjustment.");
          const control=d.kind==="invoice"?"1100":"2000",controlAmount=d.kind==="invoice"?-amount:amount;
          const originalRows=original.lines.filter(l=>l.account!==control).map(l=>d.assetAcquisition&&l.account==="1500"?{...l,account:"6000"}:l),originalCredits=originalRows.filter(l=>l.credit),originalDebits=originalRows.filter(l=>l.debit);
          const scale=(rows,side)=>{const shares=rows.map(l=>Math.floor(l[side]*fraction)),target=Math.round(rows.reduce((n,l)=>n+l[side],0)*fraction);let rem=target-shares.reduce((n,v)=>n+v,0);for(let i=0;rem>0;i=(i+1)%shares.length){shares[i]++;rem--;}return rows.map((l,i)=>({account:l.account,debit:side==="credit"?shares[i]:0,credit:side==="debit"?shares[i]:0,label:"Credit: "+l.label})).filter(l=>l.debit||l.credit);};
          const rows=[line(control,controlAmount/100,d.party),...scale(originalCredits,"credit"),...scale(originalDebits,"debit")],inventoryChanges=[];
          const imbalance=rows.reduce((n,l)=>n+l.debit-l.credit,0);
          if(imbalance){const side=imbalance>0?"credit":"debit",candidates=rows.slice(1).filter(l=>l[side]>0).sort((a,b)=>b[side]-a[side]);if(!candidates.length)throw new Error("Credit rounding needs a manual review.");candidates[0][side]+=Math.abs(imbalance);}
          let returnVariance=0;
          for(let i=0;i<stockItems.length;i++){
            const item=stockItems[i],snap=stockSnaps[i],quantity=quantities[i],delta=d.kind==="invoice"?quantity:-quantity;
            if(!snap.exists||Number(snap.data().stock||0)+delta<0)throw new Error("The returned product has insufficient stock or no longer exists.");
            const p=snap.data(),book=productBook(p,s),change=(original.inventoryChanges||[]).find(v=>v.productId===item.productId);
            const originalCost=-Math.round((change?.cost||0)*fraction);
            const carrying=d.kind==="bill"&&s.costing==="weighted-average"&&Number.isSafeInteger(book.value)&&book.quantity>=quantity?-Math.round(book.value*quantity/book.quantity):originalCost;
            const costChange=carrying;
            if(d.kind==="bill")returnVariance+=-originalCost+costChange;
            inventoryChanges.push({...change,quantity:delta,cost:costChange});
            const nextStock=Number(p.stock||0)+delta,nextQuantity=book.quantity+delta,nextValue=Number.isSafeInteger(book.value)?book.value+costChange:null;
            if(nextQuantity<0||nextValue!=null&&nextValue<0)throw new Error("Resolve the inventory book balance before posting this return.");
            const nextCost=s.costing==="weighted-average"&&nextQuantity>0&&nextValue!=null?Math.round(nextValue/nextQuantity):null;
            if(nextStock<Number(p.stock||0))assertAvailable(p,Number(p.stock||0)-nextStock);
            updateProductPrice(snap.ref,p,{stock:nextStock,accountingStockQuantity:nextQuantity,accountingStockValueCents:nextValue,...(nextCost!=null?{costPrice:nextCost/100}:{}),updatedAt:FieldValue.serverTimestamp()});
            const movementRef=store.collection("stock_movements").doc("CREDIT-"+requestId+"-"+i);
            writes.push(()=>tx.create(movementRef,{type:"adjust",productId:item.productId,productName:item.description,quantity:delta,qtyChange:delta,oldStock:Number(p.stock||0),newStock:nextStock,accountingDocumentId:d.id,reason,staff:access.user.uid,createdAt:FieldValue.serverTimestamp()}));
          }
          if(returnVariance){
            const inventoryCredits=rows.filter(l=>l.account==="1200"&&l.credit>0);
            if(!inventoryCredits.length)throw new Error("Inventory return classification needs review.");
            if(returnVariance<0)inventoryCredits[0].credit-=returnVariance;
            else{let remainder=returnVariance;for(const l of inventoryCredits){const reduction=Math.min(l.credit,remainder);l.credit-=reduction;remainder-=reduction;}if(remainder)throw new Error("Return cost variance exceeds the original inventory credit.");}
            rows.push(line("5100",-returnVariance/100,"Supplier return carrying-value difference"));
          }
          const creditRows=rows.filter(l=>l.debit||l.credit);
          plan.journals.push(entry(creditRows,{documentId:d.id,inventoryChanges,taxSnapshot:d.taxSnapshot,cashFlow:"operating"}));writes.push(()=>tx.update(ref,{credits:[...(d.credits||[]),{id:requestId,date,amount,journalId:journalRef.id,reason,stockReturned:stockItems.length>0}]}));
        }else if(b.action==="payment-reverse"){
          const ref=store.collection("accounting_documents").doc(identifier(b.documentId)),snap=await tx.get(ref);if(!snap.exists)throw new Error("Document not found.");
          const d=snap.data(),p=(d.payments||[]).find(p=>p.id===b.paymentId);if(!p||p.reversedDate||date<p.date)throw new Error("Choose an unreversed payment and a date on/after it.");
          const rows=d.kind==="invoice"?[line("1100",p.amount/100,d.party),line(p.account,-p.amount/100)]:[line(p.account,p.amount/100),line("2000",-p.amount/100,d.party)];
          plan.journals.push(entry(rows,{documentId:d.id,cashFlow:d.assetAcquisition?"investing":"operating"}));writes.push(()=>tx.update(ref,{payments:d.payments.map(v=>v.id===p.id?{...v,reversedDate:date,reversalJournalId:journalRef.id,reversalReason:reason}:v)}));
        }else if(b.action==="asset-opening"){
          const assets=await tx.get(store.collection("accounting_assets")),journals=await tx.get(store.collection("accounting_journals")),opening=journals.docs.filter(d=>d.data().kind==="opening").flatMap(d=>d.data().lines);
          const asset={id:"ASSET-"+requestId,name:text(b.name,160),cost:cents(b.amount),salvage:cents(b.salvage||0),months:Number(b.months),inServiceDate:day(b.inServiceDate),depreciated:cents(b.depreciated||0),openingDepreciation:cents(b.depreciated||0),acquisitionDate:s.startDate,depreciatedThrough:day(b.depreciatedThrough||s.startDate),disposed:false,openingAsset:true};
          const registered=assets.docs.filter(d=>d.data().openingAsset).reduce((n,d)=>n+d.data().cost,0),balance=opening.filter(l=>l.account==="1500").reduce((n,l)=>n+l.debit-l.credit,0);
          const registeredDep=assets.docs.filter(d=>d.data().openingAsset).reduce((n,d)=>n+d.data().openingDepreciation,0),openingDep=-opening.filter(l=>l.account==="1590").reduce((n,l)=>n+l.debit-l.credit,0);
          if(!asset.name||!asset.cost||asset.inServiceDate>s.startDate||asset.depreciated>asset.cost-asset.salvage||asset.depreciatedThrough>s.startDate||registered+asset.cost>balance||registeredDep+asset.depreciated>openingDep)throw new Error("Opening asset cost/depreciation must fit the opening equipment balances, with valid dates.");
          const monthEnd=new Date(Date.UTC(new Date(asset.inServiceDate).getUTCFullYear(),new Date(asset.inServiceDate).getUTCMonth()+1,0)).toISOString().slice(0,10);depreciation(asset,monthEnd);
          writes.push(()=>tx.create(store.collection("accounting_assets").doc(asset.id),asset));plan.changes.push("Register existing opening asset; no new acquisition or double-counting.");
        }else if(b.action==="depreciation"||b.action==="dispose"){
          const ref=store.collection("accounting_assets").doc(identifier(b.assetId)),snap=await tx.get(ref);if(!snap.exists||snap.data().disposed)throw new Error("Choose an active asset.");const a=snap.data();
          if(b.action==="depreciation"){
            const amount=depreciation(a,date);if(!amount)throw new Error("No additional depreciation is due for this month-end.");
            plan.journals.push(entry([line("6200",amount/100),line("1590",-amount/100)],{assetId:a.id,cashFlow:"operating"}));writes.push(()=>tx.update(ref,{depreciated:a.depreciated+amount,depreciatedThrough:date}));
          }else{
            if(date<a.inServiceDate||a.depreciatedThrough&&date<a.depreciatedThrough)throw new Error("Disposal must follow the in-service/depreciation date.");
            const proceeds=cents(b.amount||0),cash=account(b.paymentAccount,["asset"]).code; if(!moneyAccounts.includes(cash)&&!accounts.find(a=>a.code===cash)?.cashAccount)throw new Error("Choose a settlement account.");
            const book=a.cost-a.depreciated,rows=[line("1500",-a.cost/100)],gain=proceeds-book;
            if(a.depreciated)rows.push(line("1590",a.depreciated/100));if(proceeds)rows.push(line(cash,proceeds/100));if(gain)rows.push(line(gain>0?"4200":"6000",-gain/100));
            plan.journals.push(entry(rows,{assetId:a.id,cashFlow:"investing"}));writes.push(()=>tx.update(ref,{disposed:true,disposalDate:date,proceeds,disposalJournalId:journalRef.id}));
          }
        }else if(b.action==="reconcile"){
          const code=account(b.account,["asset"]).code;if(!moneyAccounts.includes(code)&&!accounts.find(a=>a.code===code)?.cashAccount)throw new Error("Choose a cash, bank, card or Mobile Money account.");
          const journals=await tx.get(store.collection("accounting_journals")),records=journals.docs.map(d=>({...d.data(),id:d.id})),end=day(b.end),start=day(b.start),report=reportLedger(records,accounts,start,end),balance=report.trial.find(a=>a.code===code),selected=Array.isArray(b.journalIds)?b.journalIds:[],statementOpening=cents(b.statementOpening,true),statementClosing=cents(b.statementClosing,true);
          if(new Set(selected).size!==selected.length||selected.some(id=>!report.activity.some(j=>j.id===id&&j.lines.some(l=>l.account===code))))throw new Error("Select valid, unique account transactions in the statement period.");
          const movements=report.activity.filter(j=>selected.includes(j.id)).reduce((n,j)=>n+j.lines.filter(l=>l.account===code).reduce((n,l)=>n+l.debit-l.credit,0),0),difference=statementClosing-statementOpening-movements;
          if(difference!==0)throw new Error("Selected transactions do not reconcile to the statement opening and closing balances.");
          const value={id:`REC-${requestId}`,account:code,start,end,statementOpening,statementClosing,bookOpening:balance.opening,bookClosing:balance.closing,unmatchedBookDifference:balance.closing-statementClosing,journalIds:selected,reason,createdBy:access.user.uid,createdAt:FieldValue.serverTimestamp()};
          if(value.unmatchedBookDifference)plan.warnings.push("Statement reconciles, but unmatched book transactions remain. Review the difference before closing.");
          writes.push(()=>tx.create(store.collection("accounting_reconciliations").doc(value.id),value));plan.changes.push("Save statement reconciliation (no financial entry)");
        }else if(b.action==="close"||b.action==="reopen"){
          if(access.user.role!=="owner")throw new Error("Only the owner can close or reopen accounting periods.");
          if(b.confirm!==true)throw new Error("Confirm the accounting period action.");
          if(b.action==="close"){
            if(s.closedThrough&&date<=s.closedThrough)throw new Error("Choose a date after the existing close.");
            const all=await loadAccounting(store);
            if(accountingReadiness(all,date).length)throw new Error(accountingReadiness(all,date).join(" "));
            if(all.pending.some(p=>!p.date||p.date<=date))throw new Error("Resolve pending source records before closing this period.");
            if(all.journals.some(j=>j.date<=date&&(j.issues||[]).length&&!j.reviewedBy))throw new Error("Review flagged journals before closing this period.");
            if(reportLedger(all.journals,accounts,s.startDate,date).balanceDifference!==0)throw new Error("The balance sheet does not balance.");
          }
          settings={...s,closedThrough:b.action==="close"?date:null,version:Number(s.version)+1};plan.changes.push(b.action==="close"?`Lock postings through ${date}`:"Reopen accounting periods; audit reason retained");
        }else if(b.action==="source"){
          if(!["sale","expense","cash","stock","stock-use","packing","marketplace-settlement"].includes(b.sourceType))throw new Error("Choose a source type.");
          const collection={sale:"sales",expense:"expenses",cash:"cash_movements",stock:"stock_movements","stock-use":"stock_use_records",packing:"packing_records","marketplace-settlement":"marketplace_settlements"}[b.sourceType],ref=store.collection(collection).doc(text(b.sourceId,160)),snap=await tx.get(ref);
          if(!snap.exists)throw new Error("Source record not found.");
          if(b.sourceType==="expense"&&(snap.data().stockUseId||snap.data().marketplaceSettlementId))throw new Error("Post the linked business-use source; this expense is already included there.");
          const source={...snap.data(),id:snap.id},sourceDate=sourceDay(source.date||source.expenseDate||source.createdAt),key=sourceKey(b.sourceType,snap.id),existing=await tx.get(store.collection("accounting_journals").doc(key));if(existing.exists)throw new Error("This source has already been posted.");
          if(sourceDate<s.startDate||s.cutoverAt&&String(source.createdAt?.toDate?.()?.toISOString()||source.createdAt)<s.cutoverAt)throw new Error("This source precedes the opening date and should be covered by opening balances.");
          let journal;
          if(b.sourceType==="stock"){
            if(source.stockUseId||source.packingId)throw new Error("This movement is already linked to its business-use source.");
            if(source.saleId||source.reversalId||source.accountingDocumentId||source.type!=="adjust")throw new Error("Stock receipts must be linked to a supplier bill. Sale movements are covered by their receipts.");
            journal=entry(rowsFromForm(b.lines));plan.warnings.push("Stock quantity is already recorded. This action adds financial classification only.");
            const productRef=store.collection("products").doc(encodeURIComponent(source.productId)),productSnap=await tx.get(productRef),quantity=Number(source.quantity??source.qtyChange),cost=journal.lines.filter(l=>l.account==="1200").reduce((n,l)=>n+l.debit-l.credit,0);
            if(!productSnap.exists||!Number.isInteger(quantity)||!quantity||!cost||Math.sign(cost)!==Math.sign(quantity))throw new Error("Inventory debit/credit must match the direction of this stock adjustment.");
            const p=productSnap.data(),book=productBook(p,s);journal.inventoryChanges=[{productId:p.id,sku:p.sku||p.id,name:p.name,quantity,cost}];
            if(Number.isInteger(book.quantity)){const nextQuantity=book.quantity+quantity,nextValue=Number.isSafeInteger(book.value)?book.value+cost:null;if(nextQuantity<0||nextValue!=null&&(nextValue<0||nextQuantity===0&&nextValue!==0))throw new Error("This adjustment exceeds the remaining inventory book balance.");updateProductPrice(productRef,p,{accountingStockQuantity:nextQuantity,accountingStockValueCents:nextValue,...(s.costing==="weighted-average"&&nextQuantity>0&&nextValue!=null?{costPrice:Math.round(nextValue/nextQuantity)/100}:{})});}
          }else journal=({sale:saleJournal,expense:expenseJournal,cash:cashJournal,"stock-use":businessUseJournal,packing:packingJournal,"marketplace-settlement":settlementJournal})[b.sourceType](source,sourceDate);
          if(!journal||!journal.lines.length&&!journal.nonfinancial)throw new Error("This source does not require a financial entry.");
          if(journal.issues?.length&&b.reviewConfirmed!==true)throw new Error("Confirm that you have reviewed the flagged source details.");
          if(b.sourceType==="cash"&&b.offsetAccount){account(b.offsetAccount);if(b.offsetAccount==="1010")throw new Error("The offset must differ from Till cash.");journal.lines=journal.lines.map(l=>["1090","2990"].includes(l.account)?{...l,account:b.offsetAccount}:l);journal.issues=[];}
          if(b.sourceType==="expense"&&b.offsetAccount){account(b.offsetAccount,["asset","liability"]);journal.lines=journal.lines.map(l=>l.credit?{...l,account:b.offsetAccount}:l);journal.issues=[];}
          if(sourceDate<=s.closedThrough&&b.adjustCurrent!==true)throw new Error("The source period is closed. Confirm a current-period posting.");
          journal={...journal,date:sourceDate<=s.closedThrough?date:sourceDate,sourceType:b.sourceType,sourceId:snap.id,originalDate:sourceDate,sourceHash:payloadHash(source),reviewedBy:access.user.uid,reviewReason:reason};
          assertOpen(s,journal.date);plan.journals.push(validateJournal(journal,accounts));plan.sourceJournalId=key;
        }
      }
      const publicPlan={...plan,settings:settings?{...settings,openingStock:settings.openingStock?.map(p=>({...p}))}:null};
      // Include config version in preview lease; all posting operations change it.
      const previewHash=payloadHash({fingerprint,version:s.version,plan:{...publicPlan,settings:settings?{...settings,createdAt:null}:null}});
      if(mode==="preview")return {plan:publicPlan,previewHash,settingsVersion:s.version};
      if(!b.previewHash||b.previewHash!==previewHash)throw new Error("The preview is stale. Review this action again before posting.");
      if(settings)tx.set(context.ref,b.action==="setup"?{...settings,cutoverAt:new Date().toISOString()}:settings);
      if(plan.journals.length){
        const target=plan.sourceJournalId?store.collection("accounting_journals").doc(plan.sourceJournalId):journalRef;
        if(b.action==="setup")tx.create(target,{...plan.journals[0],id:target.id,postedBy:access.user.uid,postedAt:FieldValue.serverTimestamp(),immutable:true});
        else writeJournal(tx,context,plan.journals[0],access.user,target);
      }else if(!settings)tx.update(context.ref,{version:Number(s.version)+1});
      for(const write of writes)write();
      const response={ok:true,journalId:plan.journals.length?(plan.sourceJournalId||journalRef.id):null,documentId:plan.document?.id||null};
      tx.create(requestRef,{fingerprint,result:response,createdAt:FieldValue.serverTimestamp(),userId:access.user.uid});
      const compactTax=t=>t?{enabled:t.enabled,effectiveDate:t.effectiveDate,registrationNumber:t.registrationNumber,pricingMode:t.pricingMode,rates:t.rates}:null;
      const before=settings?{tax:compactTax(s.tax),incomeTax:s.incomeTax||null,closedThrough:s.closedThrough,account:b.action==="account"?accounts.find(a=>a.code===b.code)||null:null}:null;
      const after={...response,date,changes:plan.changes,priceChanges:plan.priceChanges,settingsVersion:s.version,...(settings?{tax:compactTax(settings.tax),incomeTax:settings.incomeTax||null,closedThrough:settings.closedThrough,account:b.action==="account"?settings.accounts.find(a=>a.code===b.code)||null:null}:{})};
      tx.create(store.collection("admin_audit").doc(),auditPayload(access.user,`ACCOUNTING_${b.action.toUpperCase()}`,"accounting",requestId,reason,before,after));
      return response;
    });return NextResponse.json(result,{headers});
  }catch(e){return error(e.message||"Accounting action failed. Nothing was posted.",409);}
}
