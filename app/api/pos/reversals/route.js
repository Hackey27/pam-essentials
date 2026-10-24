import {stockUnitIssue} from "@/lib/stockUnits.mjs";
import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb, requireRole } from "@/lib/admin";
import { auditPayload, text } from "@/lib/serverData";
import { receiptSnapshot } from "@/lib/receiptData.mjs";
import { managerRoles, correctionCashImpact } from "@/lib/posOperations.mjs";
import { accountingContext, postSource } from "@/lib/accountingServer";
import { saleJournal, productBook, today } from "@/lib/accounting.mjs";
export async function POST(request){
  const access=await requireRole(request,managerRoles);
  if(access.error)return NextResponse.json({error:access.error},{status:access.status});
  const b=await request.json().catch(()=>({})),saleId=text(b.saleId,120),reason=text(b.reason,500),shiftId=text(b.shiftId,120);
  if(!saleId||!shiftId||!reason||b.paymentResolved!==true||typeof b.restoreStock!=="boolean")return NextResponse.json({error:"Give a reason, choose stock handling and confirm that any payment reversal was handled."},{status:400});
  if(!["not-collected","cash-refund","external-refund"].includes(b.paymentResolution))return NextResponse.json({error:"Choose how payment was handled. Reload the receipt if this option is missing."},{status:400});
  const store=adminDb(),originalRef=store.collection("sales").doc(saleId),reversalRef=store.collection("sales").doc(`REV-${saleId}`),shiftRef=store.collection("shifts").doc(shiftId);
  try{
    const receipt=await store.runTransaction(async tx=>{
      const [original,existing,shift]=await tx.getAll(originalRef,reversalRef,shiftRef);
      if(!shift.exists||shift.data().status!=="open"||shift.data().staffId!==access.user.uid)throw new Error("Start your manager shift before recording a correction.");
      if(!original.exists)throw new Error("Saved sale not found.");
      if(existing.exists)return {...receiptSnapshot({...existing.data(),id:existing.id,createdAt:existing.data().createdAt?.toDate?.()?.toISOString?.()}),duplicate:true};
      const sale=original.data();
      if(sale.saleType==="reversal"||sale.reversalId||sale.total==null||!Number.isFinite(Number(sale.total))||Number(sale.total)<0)throw new Error("This receipt cannot be reversed again.");
      if(sale.paymentMethod==="marketplace-settlement"&&b.paymentResolution!=="external-refund")throw new Error("Jumia refunds are handled through the platform, outside the cash drawer. Choose external refund and reconcile the platform adjustment.");
      const cashImpact=correctionCashImpact(sale,b.paymentResolution,shiftId);
      const sourceRef=cashImpact.sourceDelta&&sale.shiftId?store.collection("shifts").doc(sale.shiftId):null;
      const sourceShift=sourceRef?await tx.get(sourceRef):null;
      if(cashImpact.sourceDelta&&!sourceShift?.exists)throw new Error("The original cash shift is missing. This receipt needs an owner's manual review before a missing-payment correction.");
      const quantities=new Map();
      for(const item of sale.items||[]){const id=item.productId||item.id;if(!id||!Number.isInteger(item.quantity)||item.quantity<=0)throw new Error("This legacy sale needs manual review before correction.");quantities.set(id,(quantities.get(id)||0)+item.quantity);}
      const refs=[...quantities.keys()].map(id=>store.collection("products").doc(encodeURIComponent(id))),products=b.restoreStock?await tx.getAll(...refs):[];
      if(b.restoreStock&&products.some(d=>!d.exists||!Number.isFinite(Number(d.data().stock))))throw new Error("An original product is missing or has invalid stock; choose no stock restoration or resolve Inventory first.");
      if(b.restoreStock)for(const product of products){const items=(sale.items||[]).filter(i=>(i.productId||i.id)===(product.data().id||decodeURIComponent(product.id)));if(items.some(i=>stockUnitIssue(product.data(),i)))throw new Error("The original selling unit changed. Choose no automatic stock restoration and review returned pieces in Inventory.");}
      const negative=n=>-Number(n||0),value={...sale,clientTransactionId:reversalRef.id,receiptId:`REV-${sale.receiptId}`,saleType:"reversal",reversalOf:saleId,originalReceiptId:sale.receiptId,correctionReason:reason,restoreStock:b.restoreStock,paymentResolved:true,reversalId:null,items:(sale.items||[]).map(item=>({...item,quantity:-item.quantity,lineTotal:negative(item.lineTotal),taxAmount:negative(item.taxAmount),...(item.marketplaceSnapshot?{marketplaceSnapshot:{...item.marketplaceSnapshot,standardNetLineTotal:item.marketplaceSnapshot.standardNetLineTotal==null?null:-item.marketplaceSnapshot.standardNetLineTotal}}:{}),lineCost:negative(item.lineCost),lineProfit:negative(item.lineProfit)})),subtotal:negative(sale.subtotal),discount:negative(sale.discount),total:negative(sale.total),cost:negative(sale.cost),profit:negative(sale.profit),amountPaid:negative(sale.total),change:0,staffId:access.user.uid,staffName:access.user.displayName,staffEmail:access.user.email,shiftId,deviceId:text(b.deviceId,120),offlineFinal:false,syncPending:false,createdAt:FieldValue.serverTimestamp()};
      if(sale.paymentMethod==="marketplace-settlement"){value.settledAmount=0;value.settlementFees=0;value.actualFeesKnown=false;value.paymentStatus="pending-settlement";value.refundableFeesCeiling=Number(sale.settlementFees||0);}
      value.paymentResolution=b.paymentResolution;
      value.cashHandling={sourceShiftId:sale.shiftId||"",currentShiftId:shiftId,...cashImpact};
      value.cashChangePaid=0;
      value.cashChangeSource="";
      if(b.paymentResolution==="not-collected")value.amountPaid=0;
      const accounting=await accountingContext(tx,store,today(),{type:"sale",id:reversalRef.id});
      value.originalCashChangePaid=Number(sale.cashChangePaid||0);
      tx.create(reversalRef,value);
      postSource(tx,accounting,saleJournal({...value,id:reversalRef.id},today()),access.user);
      tx.update(originalRef,{reversalId:reversalRef.id,reversedAt:FieldValue.serverTimestamp(),reversedBy:access.user.uid});
      const s=shift.data(),mix={...(s.paymentMix||{})};mix[sale.paymentMethod||"cash"]=Math.round((Number(mix[sale.paymentMethod||"cash"]||0)-Number(sale.total))*100)/100;
      tx.update(shiftRef,{salesTotal:Math.round((Number(s.salesTotal||0)-Number(sale.total))*100)/100,paymentMix:mix,reversalCount:Number(s.reversalCount||0)+1,reversalTotal:Math.round((Number(s.reversalTotal||0)+Number(sale.total))*100)/100,cashCorrectionNet:Math.round((Number(s.cashCorrectionNet||0)+cashImpact.currentDelta)*100)/100});
      if(sourceRef)tx.update(sourceRef,{cashCorrectionNet:Math.round((Number(sourceShift.data().cashCorrectionNet||0)+cashImpact.sourceDelta)*100)/100});
      if(b.restoreStock)for(let i=0;i<refs.length;i++){const p=products[i].data(),id=[...quantities.keys()][i],q=quantities.get(id),old=Number(p.stock);const inventoryBook=productBook(p,accounting.settings);const originalCost=Math.round((sale.items||[]).filter(item=>(item.productId||item.id)===id).reduce((n,item)=>n+Number(item.lineCost||0),0)*100);tx.update(refs[i],{...(accounting.settings.active&&Number.isInteger(inventoryBook.quantity)?{accountingStockQuantity:inventoryBook.quantity+q,accountingStockValueCents:Number.isSafeInteger(inventoryBook.value)?inventoryBook.value+originalCost:null}:{}),stock:old+q,updatedAt:FieldValue.serverTimestamp()});tx.create(store.collection("stock_movements").doc(),{type:"adjust",productId:id,productName:p.name,quantity:q,qtyChange:q,oldStock:old,newStock:old+q,saleId,reversalId:reversalRef.id,reason:`Sale correction: ${reason}`,staff:access.user.uid,staffEmail:access.user.email,createdAt:FieldValue.serverTimestamp()});}
      tx.create(store.collection("admin_audit").doc(),auditPayload(access.user,"REVERSE_POS_SALE","sale",saleId,reason,{receiptId:sale.receiptId,total:sale.total},{reversalId:reversalRef.id,total:value.total,restoreStock:b.restoreStock,paymentResolved:true,paymentResolution:b.paymentResolution,cashHandling:value.cashHandling,linkedOrder:sale.orderReference||null}));
      return receiptSnapshot({...value,id:reversalRef.id,createdAt:new Date().toISOString()});
    });return NextResponse.json(receipt);
  }catch(e){return NextResponse.json({error:e.message||"Correction could not be saved."},{status:409});}
}
