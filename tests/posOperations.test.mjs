import test from "node:test";
import assert from "node:assert/strict";
import {cashCents,cashPosition,restoreBasket,basketDraft,validateDraft,capturedPricing} from "../lib/posOperations.mjs";
import {receiptSnapshot,formatReceiptText} from "../lib/receiptData.mjs";
test("drawer calculations use integer cents, net cash sales, cash expenses and movements",()=>{
 assert.deepEqual(cashPosition({openingCash:100.1,cashLedgerVersion:1,paymentMix:{cash:45.23,"mobile-money":100},cashExpenses:5.1,cashMovementNet:-20}),{openingRecorded:true,openingCash:100.1,cashSales:45.23,cashExpenses:5.1,cashMovementNet:-20,expectedCash:120.23});
 assert.equal(cashPosition({paymentMix:{cash:10}},[{paymentMethod:"cash",amount:2},{paymentMethod:"card",amount:30}]).expectedCash,8);
 for(const amount of [null,"",NaN,Infinity,-1,1.001,[],{},true," "])assert.throws(()=>cashCents(amount));assert.equal(cashCents("12.30"),1230);
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
