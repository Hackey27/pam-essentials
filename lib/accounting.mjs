// GHS double-entry accounting. Money is stored as integer pesewas in the ledger.
export const accountingVersion = 1;
export const accountTypes = ["asset", "liability", "equity", "income", "expense"];
export const defaultAccounts = [
  ["1010","Till cash","asset","operating"],["1020","Mobile Money","asset","operating"],["1030","Bank","asset","operating"],["1040","Card clearing","asset","operating"],["1050","Other cash — review source","asset","operating"],
  ["1090","Unclassified cash outflows","asset","operating"],["1100","Customer receivables","asset","operating"],["1200","Retail inventory","asset","operating"],["1210","Packaging supplies","asset","operating"],["1500","Equipment & fixtures in use","asset","investing"],["1590","Accumulated depreciation","asset","investing"],
  ["2000","Supplier payables","liability","operating"],["2100","Owner-paid expenses payable","liability","financing"],["2200","VAT payable","liability","operating"],["2210","NHIL payable","liability","operating"],["2220","GETFund payable","liability","operating"],["2230","Recoverable purchase taxes","asset","operating"],["2240","Income tax payable","liability","operating"],["2300","Loans payable","liability","financing"],["2990","Unclassified cash inflows","liability","operating"],
  ["3000","Owner capital","equity","financing"],["3100","Owner drawings","equity","financing"],["3200","Opening retained earnings","equity","operating"],["4000","Product sales","income","operating"],["4100","Service income","income","operating"],["4200","Other income","income","operating"],
  ["5000","Cost of goods sold","expense","operating"],["5100","Stock losses / adjustments","expense","operating"],["6000","Operating expenses","expense","operating"],["6100","Packaging consumed","expense","operating"],["6200","Depreciation expense","expense","operating"],["6300","Interest / finance charges","expense","financing"],["6400","Income tax expense","expense","operating"],
].map(([code,name,type,cashFlow]) => ({code,name,type,cashFlow,active:true,system:true,cashAccount:/^10[1-5]0$/.test(code)}));
export const moneyAccounts = ["1010","1020","1030","1040","1050"];
export const paymentAccount = method => ({cash:"1010","mobile-money":"1020","bank-transfer":"1030",card:"1040"})[method] || "1050";
export function cents(value, signed = false) {
  const numeric=typeof value==="number"&&Number.isFinite(value)&&Math.abs(value*100-Math.round(value*100))<0.00001;
  if (value === "" || value == null || !numeric&&!/^[-+]?\d+(?:\.\d{1,2})?$/.test(String(value))) throw new Error("Enter a GHS amount with at most two decimals.");
  const n = Math.round(Number(value)*100);
  if (!Number.isSafeInteger(n) || Math.abs(n)>100_000_000_000 || !signed && n<0) throw new Error("Amount is outside the allowed range.");
  return n;
}
export function day(value) {
  const text = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || text<"2000-01-01" || text>"2100-12-31" || !Number.isFinite(Date.parse(text+"T00:00:00Z")) || new Date(text+"T00:00:00Z").toISOString().slice(0,10)!==text) throw new Error("Choose a valid date (2000–2100).");
  return text;
}
export function sourceDay(value) { return day(value?.toDate?.()?.toISOString().slice(0,10) || (value instanceof Date ? value.toISOString().slice(0,10) : String(value || "").slice(0,10))); }
export const today = () => new Date().toISOString().slice(0,10);
export function line(account, amount, label = "") { const n=cents(amount,true); return {account, debit:n>0?n:0,credit:n<0?-n:0,label}; }
export function validateJournal(entry, accounts=defaultAccounts) {
  day(entry.date);
  if(entry.nonfinancial===true&&["sale","opening"].includes(entry.sourceType)&&Array.isArray(entry.lines)&&entry.lines.length===0&&String(entry.description||"").trim())return {...entry,totalDebit:0,totalCredit:0,currency:"GHS",version:accountingVersion};
  if (!String(entry.description||"").trim() || entry.description.length>1000 || !Array.isArray(entry.lines) || entry.lines.length<2 || entry.lines.length>150) throw new Error("A journal needs a description and 2–150 lines.");
  let debit=0,credit=0;
  const known=new Map(accounts.map(a=>[a.code,a]));
  for (const row of entry.lines) {
    if (!known.get(row.account)?.active || !Number.isSafeInteger(row.debit) || !Number.isSafeInteger(row.credit) || row.debit<0 || row.credit<0 || row.debit&&row.credit || row.debit+row.credit<=0 || row.debit+row.credit>100_000_000_000) throw new Error("Each journal line needs an active account and a positive debit OR credit.");
    debit+=row.debit;credit+=row.credit;
  }
  if (!Number.isSafeInteger(debit) || debit!==credit) throw new Error("Journal debits and credits must balance exactly.");
  return {...entry, lines:entry.lines.map(r=>({account:r.account,debit:r.debit,credit:r.credit,label:String(r.label||"").slice(0,160)})),totalDebit:debit,totalCredit:credit,currency:"GHS",version:accountingVersion};
}
export function normaliseTax(input={}) {
  const rates=(input.rates || [{code:"VAT",name:"VAT",rate:15,account:"2200"},{code:"NHIL",name:"NHIL",rate:2.5,account:"2210"},{code:"GETFund",name:"GETFund",rate:2.5,account:"2220"}]).map(r=>({code:String(r.code||"").slice(0,20),name:String(r.name||"").slice(0,50),rate:Number(r.rate),account:r.account}));
  if (!rates.length || rates.length>8 || new Set(rates.map(r=>r.code)).size!==rates.length || rates.some(r=>!r.code||!r.name||!Number.isFinite(r.rate)||r.rate<0||r.rate>100||Math.round(r.rate*100)!==r.rate*100||!defaultAccounts.some(a=>a.code===r.account&&a.type==="liability")) || rates.reduce((n,r)=>n+r.rate,0)>100) throw new Error("Tax rates need unique codes, liability accounts and percentages between 0 and 100.");
  const enabled=input.enabled===true,effectiveDate=input.effectiveDate?day(input.effectiveDate):null;
  if(enabled&&(!effectiveDate||!String(input.registrationNumber||"").trim()||input.registrationConfirmed!==true))throw new Error("Confirm tax registration, registration number and the effective date before enabling tax.");
  return {enabled,effectiveDate,registrationNumber:String(input.registrationNumber||"").trim().slice(0,80),registrationConfirmed:input.registrationConfirmed===true,rates,pricingMode:input.pricingMode==="exclusive"?"exclusive":"inclusive"};
}
export function normaliseIncomeTax(input={}) {
  const enabled=input.enabled===true,method=input.method==="manual"?"manual":"turnover",rate=Number(input.rate??3),effectiveDate=input.effectiveDate?day(input.effectiveDate):today();
  if(!Number.isFinite(rate)||rate<0||rate>100||Math.round(rate*100)!==rate*100)throw new Error("Income tax percentage must be 0–100 with at most two decimals.");
  if(enabled&&input.confirmed!==true)throw new Error("Confirm the GRA/accountant-assigned income tax scheme before enabling estimates.");
  return {enabled,method,rate,effectiveDate,confirmed:input.confirmed===true};
}
export function taxForDate(policy,date) {
  day(date);
  if(!policy?.effectiveDate||date>=policy.effectiveDate)return policy||{enabled:false};
  return (policy.history||[]).map((p,index)=>({...p,index})).filter(p=>!p.effectiveDate||date>=p.effectiveDate).sort((a,b)=>String(b.effectiveDate||"").localeCompare(String(a.effectiveDate||""))||b.index-a.index)[0]||{enabled:false};
}
export function productBook(product,settings) {
  if(Number.isInteger(product.accountingStockQuantity))return {quantity:product.accountingStockQuantity,value:product.accountingStockValueCents};
  const opening=(settings.openingStock||[]).find(p=>p.productId===product.id);
  return opening?{quantity:opening.quantity,value:opening.unitCost==null?null:opening.quantity*opening.unitCost}:{quantity:0,value:0};
}
export function incomeTaxEstimate(journals,settings,start,end) {
  const policy=settings.incomeTax;if(!policy?.enabled||policy.method!=="turnover")return null;
  const after=policy.effectiveDate>start?policy.effectiveDate:start;if(after>end)return 0;
  return Math.round(reportLedger(journals,settings.accounts,after,end).revenue*policy.rate/100);
}
// Split inclusive catalogue prices without increasing them. Exclusive mode is for accounting documents.
export function splitTax(amount, tax, date, exempt=false, mode="inclusive") {
  tax=taxForDate(tax,date);
  const gross=cents(amount), enabled=tax?.enabled===true&&date>=tax.effectiveDate&&!exempt;
  if(!enabled)return {enabled:false,net: gross,total:gross,tax:0,lines:[],pricingMode:mode};
  const rates=tax.rates.map(r=>({...r,bp:Math.round(r.rate*100)})),bp=rates.reduce((n,r)=>n+r.bp,0);
  const net=mode==="exclusive"?gross:Math.round(gross*10000/(10000+bp));
  const sum=mode==="exclusive"?Math.round(net*bp/10000):gross-net;
  const lines=rates.map(r=>({code:r.code,name:r.name,rate:r.rate,account:r.account,cents:bp?Math.floor(sum*r.bp/bp):0}));
  let remainder=sum-lines.reduce((n,r)=>n+r.cents,0);
  for(let i=0;remainder>0;i=(i+1)%lines.length){lines[i].cents++;remainder--;}
  return {enabled:true,net,total:net+sum,tax:sum,lines,pricingMode:mode,registrationNumber:tax.registrationNumber,effectiveDate:tax.effectiveDate};
}
export function saleTax(pricing, products, tax, date) {
  tax=taxForDate(tax,date);
  const splits=pricing.lines.map((r,i)=>splitTax(r.lineTotal,tax,date,products[i]?.taxExempt===true,"inclusive"));
  return {registered:tax?.enabled===true&&date>=tax.effectiveDate,enabled:splits.some(r=>r.enabled),pricingMode:"inclusive",productLines:splits.map(t=>({net:t.net/100,tax:t.tax/100})),registrationNumber:tax?.registrationNumber||"",effectiveDate:tax?.effectiveDate||null,net:splits.reduce((n,r)=>n+r.net,0)/100,total:pricing.total,tax:splits.reduce((n,r)=>n+r.tax,0)/100,lines:(tax?.rates||[]).map(rate=>({...rate,amount:splits.reduce((n,r)=>n+(r.lines.find(t=>t.code===rate.code)?.cents||0),0)/100})).filter(r=>r.amount>0)};
}
export function saleJournal(sale,date) {
  const amount=cents(sale.total,true),cost=cents(sale.cost??0,true),reverse=sale.saleType==="reversal",rows=[];
  const tax=sale.taxSnapshot?.enabled?sale.taxSnapshot.lines||[]:[],taxTotal=tax.reduce((n,r)=>n+cents(r.amount,true),0);
  // Reversal snapshots were originally positive; apply the reversal sign once.
  const signedTax=reverse&&taxTotal>0?-taxTotal:taxTotal;
  const net=amount-signedTax;
  let paidAccount=paymentAccount(sale.paymentMethod);
  if(reverse&&sale.paymentResolution==="cash-refund")paidAccount="1010";
  const cashChange=!reverse?cents(sale.cashChangePaid||0):sale.paymentResolution==="not-collected"?-cents(sale.originalCashChangePaid||0):0;
  const paidAmount=amount+cashChange;
  if(paidAmount)rows.push(line(paidAccount,paidAmount/100,"Payment / recorded correction"));
  if(cashChange)rows.push(line("1010",-cashChange/100,"Change returned from drawer"));
  if(net)rows.push(line("4000",-net/100,"Sales after discounts, excluding tax"));
  for(const r of tax){const n=cents(r.amount,true)*(reverse&&taxTotal>0?-1:1);if(n)rows.push(line(r.account,-n/100,r.name));}
  if(cost){
    // Without stock restoration, a correction leaves the original inventory expense in place.
    if(!reverse||sale.restoreStock){rows.push(line("5000",cost/100,"Recorded product cost"),line("1200",-cost/100,"Inventory cost"));}
  }
  const issues=[];
  if((sale.items||[]).some(i=>i.costRecorded===false||i.unitCost==null))issues.push("Missing product cost: review the original sale and post a cost adjustment.");
  const inventoryChanges=(!reverse||sale.restoreStock)?(sale.items||[]).map(i=>({productId:i.productId||i.id,sku:i.sku||i.productId,name:i.name,quantity:-Number(i.quantity),cost:-cents(i.lineCost??Number(i.unitCost||0)*Number(i.quantity),true)})):[];
  return {date,description:`${reverse?"Correction":"Sale"} ${sale.receiptId||sale.id}`,lines:rows,nonfinancial:rows.length===0,issues,sourceType:"sale",sourceId:sale.id||sale.clientTransactionId,reference:sale.receiptId||sale.id,taxSnapshot:sale.taxSnapshot||{enabled:false},cashFlow:"operating",inventoryChanges};
}
export function expenseJournal(expense,date) {
  const amount=cents(expense.amount);if(!amount)throw new Error("Expense amount must be positive.");
  const account=expense.paymentMethod==="cash"&&expense.fromTill===false?"2100":paymentAccount(expense.paymentMethod);
  return {date,description:expense.description,reference:expense.id||expense.expenseId,sourceType:"expense",sourceId:expense.id||expense.expenseId,cashFlow:"operating",lines:[line("6000",amount/100,expense.category),line(account,-amount/100,"Expense payment")],issues:account==="2100"?["Expense paid outside the till: confirm the owner funding or reclassify its payment account."]:[]};
}
export function cashJournal(movement,date) {
  if(movement.type==="opening")return null; // A drawer count is not new business money.
  const amount=cents(movement.amount),incoming=movement.type==="in";
  return {date,description:movement.reason,sourceType:"cash",sourceId:movement.id||movement.movementId,reference:movement.id||movement.movementId,cashFlow:"operating",lines:incoming?[line("1010",amount/100),line("2990",-amount/100)]:[line("1090",amount/100),line("1010",-amount/100)],issues:["Classify this drawer movement as a transfer, owner funding, loan or other appropriate account."]};
}
export function reportLedger(journals,accounts,start,end) {
  day(start);day(end);if(end<start)throw new Error("End date must follow start date.");
  const activity=journals.filter(j=>j.date>=start&&j.date<=end),through=journals.filter(j=>j.date<=end);
  const balances=new Map(accounts.map(a=>[a.code,{...a,opening:0,debit:0,credit:0,closing:0}]));
  for(const j of through)for(const r of j.lines){const a=balances.get(r.account);if(!a)throw new Error("Ledger references an unknown account.");if(j.date<start)a.opening+=r.debit-r.credit;else{a.debit+=r.debit;a.credit+=r.credit;}a.closing+=r.debit-r.credit;}
  const trial=[...balances.values()],sum=(type,field)=>trial.filter(a=>a.type===type).reduce((n,a)=>n+a[field],0);
  const revenue=-sum("income","debit")+sum("income","credit"),expense=sum("expense","debit")-sum("expense","credit"),cogs=trial.find(a=>a.code==="5000"),gross=revenue-(cogs.debit-cogs.credit);
  const lifetimeProfit=-sum("income","closing")-sum("expense","closing"),assets=sum("asset","closing"),liabilities=-sum("liability","closing"),equity=-sum("equity","closing");
  const cashCodes=new Set([...moneyAccounts,...accounts.filter(a=>a.cashAccount).map(a=>a.code)]),cashFlow={operating:0,investing:0,financing:0,unclassified:0},ledger=[];
  for(const j of activity){const cash=j.lines.filter(l=>cashCodes.has(l.account)).reduce((n,l)=>n+l.debit-l.credit,0);const category=j.cashFlow||"unclassified";cashFlow[category]=(cashFlow[category]||0)+cash;for(const row of j.lines)ledger.push({date:j.date,journalId:j.id,reference:j.reference,description:j.description,...row});}
  const cashOpening=trial.filter(a=>cashCodes.has(a.code)).reduce((n,a)=>n+a.opening,0),cashClosing=trial.filter(a=>cashCodes.has(a.code)).reduce((n,a)=>n+a.closing,0);
  return {start,end,trial,activity,ledger,revenue,expense,grossProfit:gross,netProfit:revenue-expense,costOfGoodsSold:cogs.debit-cogs.credit,otherExpenses:expense-cogs.debit+cogs.credit,lifetimeProfit,assets,liabilities,equity,balanceDifference:assets-liabilities-equity-lifetimeProfit,cashFlow,cashOpening,cashClosing,debit:trial.reduce((n,a)=>a.closing>0?n+a.closing:n,0),credit:trial.reduce((n,a)=>a.closing<0?n-a.closing:n,0)};
}
export function ageDocuments(documents,end) {
  day(end);return documents.filter(d=>["invoice","bill"].includes(d.kind)&&d.date<=end).map(d=>{
    const paid=(d.payments||[]).filter(p=>p.date<=end&&(!p.reversedDate||p.reversedDate>end)).reduce((n,p)=>n+p.amount,0),credited=(d.credits||[]).filter(p=>p.date<=end).reduce((n,p)=>n+p.amount,0),balance=d.total-credited-paid;
    const overdue=Math.max(0,Math.floor((Date.parse(end)-Date.parse(d.dueDate))/86400000));
    return {...d,paid,credited,balance,overdue,bucket:d.dueDate>=end?"Current":overdue<=30?"1–30":overdue<=60?"31–60":overdue<=90?"61–90":"90+"};
  });
}
export function depreciation(asset,through) {
  day(through);const cost=asset.cost,salvage=asset.salvage,months=asset.months;
  if(!Number.isSafeInteger(cost)||!Number.isSafeInteger(salvage)||salvage<0||salvage>cost||!Number.isInteger(months)||months<1||months>1200)throw new Error("Enter asset cost, residual value and useful life in months.");
  day(asset.inServiceDate);
  const date=new Date(through+"T00:00:00Z"),lastDay=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).toISOString().slice(0,10);
  if(through!==lastDay)throw new Error("Depreciation must be posted through a month-end date.");
  const start=new Date(asset.inServiceDate+"T00:00:00Z"),elapsed=Math.max(0,Math.min(months,(date.getUTCFullYear()-start.getUTCFullYear())*12+date.getUTCMonth()-start.getUTCMonth()+1));
  return Math.max(0,Math.round((cost-salvage)*elapsed/months)-Number(asset.depreciated||0));
}
export const defaultAccountingSettings=()=>({version:0,active:false,startDate:null,closedThrough:null,accounts:defaultAccounts,tax:normaliseTax(),costing:"recorded-cost",openingConfirmed:false});
export function inventoryStatement(settings,journals,end) {
  day(end);const rows=new Map((settings.openingStock||[]).map(p=>[p.productId,{...p,cost:p.unitCost==null?null:p.quantity*p.unitCost}]));
  const events=[...journals.filter(j=>j.date<=end),...(settings.valuations||[]).filter(v=>v.date<=end).map(v=>({...v,valuation:true}))].sort((a,b)=>a.date.localeCompare(b.date)||Number(a.settingsVersion||0)-Number(b.settingsVersion||0));
  for(const j of events){if(j.valuation){const r=rows.get(j.productId)||{productId:j.productId,sku:j.sku,name:j.name,quantity:j.quantity};r.cost=j.value;r.quantity=j.quantity;rows.set(j.productId,r);continue;}for(const change of j.inventoryChanges||[]){
    const r=rows.get(change.productId)||{productId:change.productId,sku:change.sku,name:change.name,quantity:0,cost:0,unitCost:null};
    r.quantity+=change.quantity;if(r.cost!=null)r.cost+=change.cost;rows.set(change.productId,r);
  }}
  return [...rows.values()].sort((a,b)=>String(a.name).localeCompare(String(b.name)));
}
export function accountingReadiness(data,end) {
  day(end);const issues=[],s=data.settings;
  if(!s.active)return ["Complete reviewed opening balances."];
  const inventory=inventoryStatement(s,data.journals,end);
  if(inventory.some(p=>p.quantity&&p.cost==null))issues.push("Allocate the missing inventory costs in Inventory.");
  const book=reportLedger(data.journals,s.accounts,s.startDate,end);
  const inventoryAccount=book.trial.find(a=>a.code==="1200")?.closing||0;
  if(inventory.every(p=>p.cost!=null)&&inventory.reduce((n,p)=>n+p.cost,0)!==inventoryAccount)issues.push("Reconcile SKU inventory values to the Retail inventory account.");
  const assetAccount=book.trial.find(a=>a.code==="1500")?.closing||0,assets=data.assets.filter(a=>(a.acquisitionDate||a.inServiceDate)<=end&&(!a.disposalDate||a.disposalDate>end));
  if(assets.reduce((n,a)=>n+a.cost,0)!==assetAccount)issues.push("Complete/reconcile the business asset register to Equipment & fixtures.");
  return issues;
}
