import { receiptSnapshot } from "./receiptData.mjs";
import {withMarketplaceAccounts,settlementJournal} from "@/lib/marketplaceFinance.mjs";
import {packingJournal} from "@/lib/packing.mjs";
import { businessUseJournal } from '@/lib/businessUse.mjs';
import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { defaultAccountingSettings, validateJournal, defaultAccounts, day, today, sourceDay, saleJournal, expenseJournal, cashJournal } from "@/lib/accounting.mjs";
import { serializeDoc } from "@/lib/productData";
import { auditPayload } from "@/lib/serverData";

export const configRef = store => store.collection("accounting_settings").doc("config");
export const sourceKey = (type,id) => `${type}-${createHash("sha256").update(String(id)).digest("hex").slice(0,40)}`;
export const payloadHash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export async function accountingContext(tx,store,date=today(),source=null) {
  const ref=configRef(store),snap=await tx.get(ref),settings=snap.exists?{...snap.data(),accounts:withMarketplaceAccounts(snap.data().accounts||defaultAccounts)}:defaultAccountingSettings();
  const journalRef=source?store.collection("accounting_journals").doc(sourceKey(source.type,source.id)):null;
  const existing=journalRef?await tx.get(journalRef):null;
  return {ref,settings,journalRef,existing,store,date};
}
export function assertOpen(settings,date) {
  day(date);
  if(!settings.active)throw new Error("Complete accounting opening setup first.");
  if(date<settings.startDate)throw new Error("This date precedes the accounting start date.");
  if(settings.closedThrough&&date<=settings.closedThrough)throw new Error("This accounting period is closed. Use a current-period adjustment with a reference to the original record.");
}
export function writeJournal(tx,context,entry,user,ref=null) {
  assertOpen(context.settings,entry.date);
  const journal=validateJournal(entry,context.settings.accounts||defaultAccounts),target=ref||context.journalRef;
  if(!target)throw new Error("Journal reference is required.");
  tx.create(target,{...journal,id:target.id,postedBy:user?.uid||"system",postedName:user?.displayName||"Staff",postedAt:FieldValue.serverTimestamp(),settingsVersion:context.settings.version,immutable:true});
  tx.update(context.ref,{version:Number(context.settings.version||0)+1,lastPostedAt:FieldValue.serverTimestamp()});
  if(entry.sourceType)tx.create(context.store.collection("admin_audit").doc(),auditPayload(user||{uid:"system",email:""},"ACCOUNTING_SOURCE_POST","accounting_journal",target.id,entry.description,null,{sourceType:entry.sourceType,sourceId:entry.sourceId,date:entry.date,debit:journal.totalDebit,credit:journal.totalCredit}));
  return {...journal,id:target.id};
}
// These hooks run in the SAME transaction as the source. No source writes are lost on a ledger failure.
export function postSource(tx,context,entry,user) {
  if(!context.settings.active||context.date<context.settings.startDate||context.existing?.exists||!entry)return null;
  if(context.settings.closedThrough&&context.date<=context.settings.closedThrough) {
    // POS operation stays valid; immutable source is queued for explicit current-period review.
    return null;
  }
  return writeJournal(tx,context,entry,user);
}
export async function allRecords(store,collection) {
  // Do not reuse Admin's latest-500 reporting slice. Fetch the complete collection and fail explicitly if too large.
  const snapshot=await store.collection(collection).get();
  if(snapshot.size>50000)throw new Error("This dataset requires a paginated accounting export. No partial report was generated.");
  return snapshot.docs.map(serializeDoc);
}
export async function loadAccounting(store) {
  const settingsSnap=await configRef(store).get(),settings=settingsSnap.exists?{...settingsSnap.data(),accounts:withMarketplaceAccounts(settingsSnap.data().accounts||defaultAccounts)}:defaultAccountingSettings();
  const [journals,documents,assets,reconciliations,products,sales,expenses,cash,movements,valuations,stockUses,packings,settlements]=await Promise.all(["accounting_journals","accounting_documents","accounting_assets","accounting_reconciliations","products","sales","expenses","cash_movements","stock_movements","accounting_stock_values","stock_use_records","packing_records","marketplace_settlements"].map(c=>allRecords(store,c)));
  settings.valuations=valuations;
  const saved=new Set(journals.filter(j=>j.sourceType&&j.sourceId).map(j=>`${j.sourceType}:${j.sourceId}`)),pending=[],excluded=[];
  const add=(type,record,factory)=>{
    if(saved.has(`${type}:${record.id}`))return;
    const receipt = type === "sale" ? {receipt:receiptSnapshot(record)} : {};
    let date;try{date=sourceDay(record.date||record.expenseDate||record.createdAt);}catch{pending.push({sourceType:type,sourceId:record.id,label:record.receiptId||record.description||record.reason||record.id,error:"Missing or invalid source date",date:null,...receipt});return;}
    if(settings.startDate&&date<settings.startDate||settings.cutoverAt&&String(record.createdAt||"")<settings.cutoverAt)return;
    const item={...receipt,sourceType:type,sourceId:record.id,label:record.receiptId||record.description||record.reason||record.productName||record.id,date};
    try{
      const entry=factory?.(record,date);
      if(!entry){excluded.push({...item,reason:type==="cash"?"Opening drawer count is a balance count, not income.":"Stock movement already accounted for by a linked sale or purchase."});return;}
      if(!entry.lines.length&&!entry.nonfinancial){excluded.push({...item,reason:"Zero-value record: no financial entry required."});return;}
      validateJournal(entry,settings.accounts);pending.push({...item,entry,closed:settings.closedThrough&&date<=settings.closedThrough});
    }catch(error){pending.push({...item,error:error.message});}
  };
  sales.forEach(r=>add("sale",r,saleJournal));expenses.filter(r=>!r.stockUseId&&!r.marketplaceSettlementId).forEach(r=>add("expense",r,expenseJournal));stockUses.forEach(r=>add("stock-use",r,businessUseJournal));packings.forEach(r=>add("packing",r,packingJournal));settlements.forEach(r=>add("marketplace-settlement",r,settlementJournal));cash.forEach(r=>add("cash",r,cashJournal));
  for(const record of movements){
    if(saved.has(`stock:${record.id}`)||record.sourceCatalogueImportId||record.saleId||record.reversalId||record.accountingDocumentId||record.stockUseId||record.packingId||record.type==="opening")continue;
    let date;try{date=sourceDay(record.createdAt);}catch{date=null;}
    if(settings.startDate&&date&&date<settings.startDate||settings.cutoverAt&&String(record.createdAt||"")<settings.cutoverAt)continue;
    pending.push({sourceType:"stock",sourceId:record.id,date,label:`${record.productName||record.productId}: ${record.type} ${record.quantity??record.qtyChange}`,error:"Record a supplier bill linked to this receipt, or classify this adjustment. Quantity alone does not establish its cost.",movement:record});
  }
  return {settings,journals:journals.sort((a,b)=>b.date.localeCompare(a.date)||String(b.postedAt).localeCompare(String(a.postedAt))),documents,assets,reconciliations,products:products.map(p=>({id:p.id,sku:p.sku||p.id,name:p.name,stock:p.stock,price:p.price,taxExempt:p.taxExempt===true,variantOptions:p.variantOptions||{},costPrice:p.costPrice,inventoryType:p.inventoryType||"sellable",contactForPrice:p.contactForPrice===true})),pending,excluded,updatedAt:new Date().toISOString()};
}
