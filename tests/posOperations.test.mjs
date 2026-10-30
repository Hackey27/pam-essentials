import test from "node:test";
import assert from "node:assert/strict";
import {cashCents,cashPosition,restoreBasket,basketDraft,validateDraft,capturedPricing,correctionCashImpact} from "../lib/posOperations.mjs";
import {receiptSnapshot,formatReceiptText} from "../lib/receiptData.mjs";
test("drawer calculations use integer cents, net cash sales, cash expenses and movements",()=>{
 assert.deepEqual(cashPosition({openingCash:100.1,cashLedgerVersion:1,paymentMix:{cash:45.23,"mobile-money":100},cashExpenses:5.1,cashMovementNet:-20}),{openingRecorded:true,openingCash:100.1,cashSales:45.23,cashExpenses:5.1,cashMovementNet:-20,cashCorrectionNet:0,cashChangePaid:0,expectedCash:120.23});
 assert.equal(cashPosition({paymentMix:{cash:10}},[{paymentMethod:"cash",amount:2},{paymentMethod:"card",amount:30}]).expectedCash,8);
 for(const amount of [null,"",NaN,Infinity,-1,1.001,[],{},true," "])assert.throws(()=>cashCents(amount));assert.equal(cashCents("12.30"),1230);
});
test("corrections distinguish missing payments, drawer refunds and outside refunds",()=>{
 const cash={shiftId:"S",paymentMethod:"cash",total:20},card={...cash,paymentMethod:"card"};
 assert.deepEqual(correctionCashImpact(cash,"not-collected","M"),{currentDelta:20,sourceDelta:-20});
 assert.deepEqual(correctionCashImpact(cash,"not-collected","S"),{currentDelta:0,sourceDelta:0});
 assert.deepEqual(correctionCashImpact(cash,"cash-refund","M"),{currentDelta:0,sourceDelta:0});
 assert.deepEqual(correctionCashImpact(cash,"external-refund","M"),{currentDelta:20,sourceDelta:0});
 assert.deepEqual(correctionCashImpact(card,"cash-refund","M"),{currentDelta:-20,sourceDelta:0});
 assert.deepEqual(correctionCashImpact(card,"external-refund","M"),{currentDelta:0,sourceDelta:0});
 assert.deepEqual(correctionCashImpact({...card,cashChangePaid:5},"not-collected","M"),{currentDelta:0,sourceDelta:5});
 assert.equal(cashPosition({openingCash:100,cashChangePaid:5}).expectedCash,95);
 assert.equal(cashPosition({openingCash:100,cashChangePaid:5,cashCorrectionNet:5}).expectedCash,100);
 assert.equal(cashPosition({openingCash:100},[{paymentMethod:"cash",amount:10,fromTill:false}]).expectedCash,100);
 assert.throws(()=>correctionCashImpact(cash,"","M"));
});
test("basket recovery preserves exact SKU, bounds stock and discards payment confirmation",()=>{
 const draft=basketDraft({cart:[{id:"A",name:"Pink 500ml",quantity:4,price:20},{id:"B",name:"Blue",quantity:1,price:10}],staffId:"cashier",shift:{shiftId:"S1"},orderChannel:"walk-in",attemptId:"attempt-123"});
 assert.equal(validateDraft(draft,"cashier"),true);assert.equal(validateDraft(draft,"other"),false);assert.equal("amountPaid" in draft,false);assert.equal("transactionVerified" in draft,false);assert.equal(draft.attemptId,"attempt-123");
 const restored=restoreBasket(draft,[{id:"A",name:"Pink 500ml",sku:"PINK-500",stock:2,price:25,variantOptions:{colour:"Pink",size:"500ml"}}]);assert.equal(restored.cart.length,1);assert.equal(restored.cart[0].quantity,2);assert.equal(restored.cart[0].price,25);assert.equal(restored.cart[0].sku,"PINK-500");assert.equal(restored.issues.length,3);
});
test("captured offline pricing must balance and match exact quantities",()=>{
 const receipt={subtotal:20,discount:2,total:18,items:[{productId:"A",quantity:2,unitPrice:10,lineTotal:18}]};assert.equal(capturedPricing(receipt,[{id:"A",quantity:2}]).total,18);
 assert.throws(()=>capturedPricing({...receipt,total:19},[{id:"A",quantity:2}]));assert.throws(()=>capturedPricing(receipt,[{id:"A",quantity:1}]));assert.throws(()=>capturedPricing({...receipt,items:[{productId:"A",quantity:2,unitPrice:10,lineTotal:21}]},[{id:"A",quantity:2}]));
});
test("correction receipts retain original reference, signed totals and no profit fields",()=>{
 const receipt=receiptSnapshot({saleType:"reversal",reversalOf:"A",originalReceiptId:"PAM-1",correctionReason:"Mistaken sale",restoreStock:true,total:-18,subtotal:-20,discount:-2,cost:-10,profit:-8,items:[{productId:"A",name:"Pink bottle",variantOptions:{colour:"Pink",size:"500ml"},quantity:-2,unitPrice:10,lineTotal:-18,lineCost:-10}]});const text=formatReceiptText(receipt);assert.match(text,/SALE CORRECTION \/ REVERSAL/);assert.match(text,/Original receipt: PAM-1/);assert.match(text,/Pink \/ 500ml/);assert.equal("profit" in receipt,false);assert.equal("lineCost" in receipt.items[0],false);
});

import {shiftTimestamp,formatPosDateTime} from "../lib/posTime.mjs";
test("POS dates always show Ghana time and the original shift date across device timezones",()=>{
 const original=process.env.TZ;
 try {
  for(const zone of ["America/New_York","Asia/Tokyo","Africa/Accra"]){
   process.env.TZ=zone;
   assert.match(formatPosDateTime("2026-10-29T06:06:00Z"),/29 Oct 2026.*6:06 am/);
   assert.match(formatPosDateTime("2026-10-30T00:30:00+02:00"),/29 Oct 2026.*10:30 pm/);
  }
 } finally {if(original===undefined)delete process.env.TZ;else process.env.TZ=original;}
});
test("Shift timestamps preserve Firestore, ISO and Date values without inventing missing starts",()=>{
 const iso="2026-10-29T06:06:00.000Z",date=new Date(iso);
 for(const value of [iso,date,{toDate:()=>date},{seconds:date.getTime()/1000,nanoseconds:0},{_seconds:date.getTime()/1000,_nanoseconds:0}])assert.equal(shiftTimestamp(value),iso);
 for(const value of [null,undefined,"invalid",{}, {toDate:()=>new Date("invalid")}]){assert.equal(shiftTimestamp(value),null);assert.equal(formatPosDateTime(value),"Not recorded");}
});
