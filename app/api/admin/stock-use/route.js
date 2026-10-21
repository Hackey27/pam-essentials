import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { adminDb, requireRole } from '@/lib/admin';
import { auditPayload, text } from '@/lib/serverData';
import { serializeDoc } from '@/lib/productData';
import { accountingContext, assertOpen, writeJournal, sourceKey, payloadHash, allRecords } from '@/lib/accountingServer';
import { productBook, day, today, cents, depreciation, validateJournal } from '@/lib/accounting.mjs';
import { businessPurposes, inventoryCategory, issueCost, businessUseJournal, businessUseSummary } from '@/lib/businessUse.mjs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
const error=(message,status=409)=>NextResponse.json({error:message},{status,headers});
export async function GET(request){const access=await requireRole(request,['owner','admin']);if(access.error)return error(access.error,access.status);try{const url=new URL(request.url),start=day(url.searchParams.get('start')||'2000-01-01'),end=day(url.searchParams.get('end')||today());if(end<start)throw new Error('End date must follow start date.');const all=await allRecords(adminDb(),'stock_use_records');const records=all.filter(r=>r.date>=start&&r.date<=end).sort((a,b)=>b.date.localeCompare(a.date)||String(b.createdAt).localeCompare(String(a.createdAt)));return NextResponse.json({records,summary:businessUseSummary(records),updatedAt:new Date().toISOString()},{headers});}catch(e){return error(e.message);}}
export async function POST(request){
 const access=await requireRole(request,['owner','admin']);if(access.error)return error(access.error,access.status);
 const b=await request.json().catch(()=>({}));
 try{
  if(!['issue','reverse'].includes(b.action)||!['preview','apply'].includes(b.mode)||!/^[-a-zA-Z0-9]{8,120}$/.test(b.requestId||''))throw new Error('Choose an action and a valid request reference.');
  const date=day(b.date||today()),notes=text(b.notes,1000);if(date>today())throw new Error('Future stock issues are not allowed.');if(notes.length<3)throw new Error('Enter a detailed business purpose or reversal reason.');
  const input={action:b.action,date,notes,productId:text(b.productId,80),quantity:Number(b.quantity),purpose:text(b.purpose,30),originalId:text(b.originalId,120),assetMonths:Number(b.assetMonths||0),assetSalvage:Number(b.assetSalvage||0),inServiceDate:text(b.inServiceDate,10)};
  const fingerprint=payloadHash(input),store=adminDb(),ref=store.collection('stock_use_records').doc(b.requestId);
  const result=await store.runTransaction(async tx=>{
   const previous=await tx.get(ref);if(previous.exists){if(previous.data().requestFingerprint!==fingerprint||previous.data().staffId!==access.user.uid)throw new Error('This reference is already used for different details.');return {ok:true,id:ref.id,duplicate:true};}
   let original=null,originalRef=null,assetSnap=null;
   if(b.action==='reverse'){if(!input.originalId)throw new Error('Choose the original issue.');originalRef=store.collection('stock_use_records').doc(input.originalId);const snap=await tx.get(originalRef);if(!snap.exists||snap.data().action!=='issue')throw new Error('Original issue not found.');original={...snap.data(),id:snap.id};if(original.reversedBy)throw new Error('This issue was already reversed.');if(date<original.date)throw new Error('Reversal date cannot precede the original issue.');if(original.purpose==='asset'){assetSnap=await tx.get(store.collection('accounting_assets').doc(original.assetId));if(!assetSnap.exists||assetSnap.data().depreciated||assetSnap.data().disposed)throw new Error('An asset already depreciated or disposed needs a reviewed Accounting adjustment.');}}
   const productId=original?.productId||input.productId;if(!productId)throw new Error('Choose a product.');
   const productRef=store.collection('products').doc(encodeURIComponent(productId)),productSnap=await tx.get(productRef);if(!productSnap.exists)throw new Error('Product not found.');const product={...productSnap.data(),id:productId};
   const context=await accountingContext(tx,store,date,{type:'stock-use',id:ref.id}),settings=context.settings;
   if(settings.active)assertOpen(settings,date);
   let valuation,purpose;
   if(original){if(Boolean(settings.active)!==Boolean(original.accountingPosted))throw new Error("Accounting setup changed since this issue. Use a reviewed Accounting adjustment.");purpose=businessPurposes.find(p=>p.value===original.purpose);const book=productBook(product,settings),stock=Number(product.stock||0);if(!Number.isSafeInteger(stock)||stock<0)throw new Error('Review the current stock first.');if(settings.active){const posted=await tx.get(store.collection('accounting_journals').doc(sourceKey('stock-use',original.id)));if(!posted.exists||original.accountingPosted!==true)throw new Error('Review this pre-accounting issue in Accounting before reversing it.');if(book.quantity!==stock||!Number.isSafeInteger(book.value))throw new Error('Reconcile inventory quantity and cost before reversing.');}valuation={quantity:original.quantity,stock,unitCost:original.unitCost,totalCost:original.totalCost,totalCostCents:cents(original.totalCost),costBasis:original.costBasis,book};}
   else{purpose=businessPurposes.find(p=>p.value===input.purpose);if(!purpose)throw new Error('Choose a business purpose.');valuation=issueCost(product,input.quantity,settings);}
   const direction=original?1:-1,newStock=valuation.stock+direction*valuation.quantity;if(!Number.isSafeInteger(newStock)||newStock>1000000000)throw new Error('Resulting stock is outside the supported range.');
   let asset=null;
   if(!original&&purpose.value==='asset'){if(!settings.active)throw new Error('Complete Accounting setup before transferring stock to a fixed asset.');if(valuation.quantity!==1)throw new Error('Register each equipment item separately with quantity 1.');const salvage=cents(input.assetSalvage),inServiceDate=day(input.inServiceDate||date);if(inServiceDate<date||inServiceDate>today())throw new Error('Choose an in-service date from the issue date through today.');asset={id:'USE-'+ref.id,name:product.name,acquisitionDate:date,inServiceDate,cost:valuation.totalCostCents,salvage,months:input.assetMonths,depreciated:0,disposed:false,stockUseId:ref.id,productId,sku:product.sku||productId};depreciation(asset,new Date(Date.UTC(new Date(inServiceDate).getUTCFullYear(),new Date(inServiceDate).getUTCMonth()+1,0)).toISOString().slice(0,10));}
   const nextBookValue=settings.active?valuation.book.value+direction*valuation.totalCostCents:null;
   const nextCost=settings.active&&settings.costing==='weighted-average'&&newStock>0?Math.round(nextBookValue/newStock)/100:product.costPrice;
   const record={productCostBefore:product.costPrice??null,productCostAfter:nextCost??null,id:ref.id,action:b.action,date,productId,sku:original?.sku||product.sku||productId,productName:original?.productName||product.name,variantOptions:original?.variantOptions||product.variantOptions||{},inventoryCategory:original?.inventoryCategory||inventoryCategory(product),purpose:purpose.value,purposeLabel:purpose.label,quantity:valuation.quantity,unitCost:valuation.unitCost,totalCost:valuation.totalCost,costBasis:valuation.costBasis,oldStock:valuation.stock,newStock,notes,staffId:access.user.uid,staffName:access.user.displayName||access.user.email||'Staff',staffEmail:access.user.email||'',originalId:original?.id||'',assetId:asset?.id||original?.assetId||'',accountingPosted:settings.active,requestFingerprint:fingerprint};
   const rawJournal=businessUseJournal(record,date),journal=settings.active?validateJournal(rawJournal,settings.accounts):rawJournal,previewHash=payloadHash({fingerprint,record,asset,book:valuation.book,settingsVersion:settings.version||0,active:settings.active,accounts:settings.accounts});
   if(b.mode==='preview')return {previewHash,record,asset,journal:settings.active?journal:null};
   if(!b.previewHash||b.previewHash!==previewHash)throw new Error('Stock, cost or settings changed. Preview again; nothing was saved.');
   const now=FieldValue.serverTimestamp(),movementId='USE-'+ref.id;
   tx.update(productRef,{stock:newStock,updatedAt:now,...(settings.active?{accountingStockQuantity:newStock,accountingStockValueCents:nextBookValue,...(nextCost!==product.costPrice?{costPrice:nextCost}:{})}:{})});
   if(nextCost!==product.costPrice)tx.create(store.collection('admin_audit').doc(),auditPayload(access.user,'UPDATE_PRODUCT','product',productId,'Business-use stock movement recalculated weighted-average cost. '+notes,{id:productId,sku:product.sku||productId,name:product.name,price:product.price??null,costPrice:product.costPrice},{id:productId,sku:product.sku||productId,name:product.name,price:product.price??null,costPrice:nextCost}));
   tx.create(ref,{...record,createdAt:now});
   tx.create(store.collection('stock_movements').doc(movementId),{type:original?'business-return':'business-use',productId,productName:record.productName,quantity:direction*record.quantity,qtyChange:direction*record.quantity,oldStock:record.oldStock,newStock,reason:'Promotional/business purpose — '+purpose.label,notes,stockUseId:ref.id,staff:access.user.uid,staffEmail:record.staffEmail,createdAt:now});
   if(purpose.value!=='asset')tx.create(store.collection('expenses').doc(movementId),{expenseId:movementId,amount:(original?-1:1)*record.totalCost,category:purpose.value==='promotion'?'Promotional use':purpose.value==='packaging'?'Packaging consumed':'Internal business use',description:(original?'Reversal: ':'')+record.productName+' — '+notes,expenseDate:date,paymentMethod:'inventory',fromTill:false,nonCash:true,stockUseId:ref.id,productId,sku:record.sku,quantity:record.quantity,unitCost:record.unitCost,staffId:access.user.uid,staffEmail:record.staffEmail,createdAt:date===today()?now:Timestamp.fromDate(new Date(date+'T12:00:00Z'))});
   if(asset)tx.create(store.collection('accounting_assets').doc(asset.id),asset);
   if(original){tx.update(originalRef,{reversedBy:ref.id,reversedAt:now});if(assetSnap)tx.update(assetSnap.ref,{disposed:true,disposalDate:date,reversedBy:ref.id});}
   if(settings.active)writeJournal(tx,context,journal,access.user);
   tx.create(store.collection('admin_audit').doc(),auditPayload(access.user,original?'REVERSE_BUSINESS_USE':'ISSUE_BUSINESS_USE','stock_use',ref.id,notes,null,record));
   return {ok:true,id:ref.id,newStock,totalCost:record.totalCost};
  });return NextResponse.json(result,{headers});
 }catch(e){return error(e.message||'Stock issue could not be saved.');}
}
