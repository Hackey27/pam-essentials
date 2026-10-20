import test from "node:test";import assert from "node:assert/strict";
import {validateWholesale,wholesaleQuantityIssue,pricePurchaseCart,purchaseProduct} from "../lib/wholesale.mjs";
import {tradePerformance,tradePerformanceCsv} from "../lib/tradePerformance.mjs";
import {planCatalogueImport,exportCatalogueCsv} from "../lib/catalogueImport.mjs";
import {basketDraft,restoreBasket} from "../lib/posOperations.mjs";
import {offlineSaleReceipt} from "../lib/offlineSale.mjs";
const product={id:"A",sku:"A",name:"Blue bottle",price:10,stock:100,categoryId:"c",category:"Bottles",active:true,variantOptions:{colour:"Blue"},wholesale:{enabled:true,unitPrice:6,minQty:12,increment:6,tiers:[{minQty:24,unitPrice:5}]}};
test("wholesale validates exact quantities, prices and non-increasing tiers without retail offer stacking",()=>{
 assert.throws(()=>validateWholesale({...product.wholesale,unitPrice:1.001}),/decimals/);
 assert.throws(()=>validateWholesale({...product.wholesale,tiers:[{minQty:24,unitPrice:7}]}),/Tiers/);
 assert.match(wholesaleQuantityIssue(product,11),/Minimum 12/);
 assert.match(wholesaleQuantityIssue(product,13),/increments/);
 assert.match(wholesaleQuantityIssue(product,102),/available/);
 assert.equal(wholesaleQuantityIssue(product,18),"");
 const rules=[{active:true,scopeType:"GLOBAL",discountType:"PERCENT",value:50,minQty:1}];
 assert.equal(pricePurchaseCart([{...product,quantity:12}],rules,[],"retail").total,60);
 const whole=pricePurchaseCart([{...product,quantity:12}],rules,[],"wholesale");
 assert.equal(whole.total,72);assert.equal(whole.discount,0);assert.equal(whole.lines[0].price,6);
 assert.equal(pricePurchaseCart([{...product,quantity:24}],rules,[],"wholesale").total,120);
 assert.throws(()=>pricePurchaseCart([{...product,quantity:11}],rules,[],"wholesale"),/Minimum/);
 assert.equal(product.price,10);
});
test("wholesale-only price does not require or overwrite a retail selling price",()=>{
 assert.equal(purchaseProduct({...product,price:null},"wholesale",12).price,6);
 assert.equal(purchaseProduct(product,"retail",12).price,10);
 assert.throws(()=>purchaseProduct(product,"unknown",12),/retail or wholesale/);
});
test("SKU import updates both selling prices, retains metadata and round-trips quantity tiers",()=>{
 const before={...product,imageUrl:"https://example.test/a.jpg",costPrice:3};
 const records=[{docId:"A",data:before}],hierarchy={categories:[{categoryId:"c",name:"Bottles"}],subcategories:[],subSubcategories:[]};
 const plan=planCatalogueImport("SKU,PRICE,WHOLESALE_ENABLED,WHOLESALE_PRICE,WHOLESALE_MIN_QTY,WHOLESALE_INCREMENT,WHOLESALE_TIERS\nA,11,TRUE,7,12,6,24:6;48:5",records,hierarchy);
 assert.deepEqual(plan.errors,[]);assert.equal(plan.entries[0].patch.price,11);assert.equal(plan.entries[0].patch.wholesale.unitPrice,7);assert.equal(before.stock,100);assert.equal(before.imageUrl,"https://example.test/a.jpg");assert.equal(before.costPrice,3);
 const round=planCatalogueImport(exportCatalogueCsv([before]),records,hierarchy);assert.deepEqual(round.errors,[]);assert.equal(round.entries[0].patch.wholesale,undefined);assert.equal(round.entries[0].patch.price,undefined);
 const partial=planCatalogueImport("SKU,NAME\nA,Renamed",records,hierarchy);assert.equal(partial.entries[0].patch.wholesale,undefined);
 const invalid=planCatalogueImport("SKU,WHOLESALE_PRICE\nA,-1",records,hierarchy);assert.equal(invalid.errors.length,1);
});
test("Retail → Wholesale → Combined uses captured costs, signed corrections, net tax and recomputed margins",()=>{
 const sales=[{id:"r",total:100,items:[{quantity:10,lineCost:60,costRecorded:true}]},{id:"w",purchaseType:"wholesale",total:50,items:[{quantity:10,lineCost:40,costRecorded:true}]}];
 const report=tradePerformance(sales);assert.equal(report.retail.grossProfit,40);assert.equal(report.wholesale.grossProfit,10);assert.equal(report.combined.grossProfit,50);assert.equal(report.combined.marginPct,50/150*100);assert.notEqual(report.combined.marginPct,30);
 const corrected=tradePerformance([...sales,{purchaseType:"wholesale",saleType:"reversal",restoreStock:false,total:-50,items:[{quantity:-10,lineCost:-40,costRecorded:true}]}]);
 assert.equal(corrected.wholesale.revenue,0);assert.equal(corrected.wholesale.cogs,40);assert.equal(corrected.wholesale.grossProfit,-40);
 const unknown=tradePerformance([{total:10,items:[{quantity:1,unitCost:0,costRecorded:false}]}]);assert.equal(unknown.retail.grossProfit,null);assert.equal(unknown.combined.marginPct,null);
 const taxed=tradePerformance([{total:110,taxSnapshot:{enabled:true,tax:10},items:[{quantity:1,lineCost:60,costRecorded:true}]}]);assert.equal(taxed.retail.revenue,100);
 assert.match(tradePerformanceCsv({...report,label:"Today"}),/"Metric","Retail","Wholesale","Combined"/);
});
test("held and offline baskets preserve wholesale type and capture the actual unit price",()=>{
 const cart=[{...product,quantity:12,purchaseType:"wholesale"}],draft=basketDraft({cart,shift:{shiftId:"s"},staffId:"u",purchaseMode:"wholesale"});
 assert.equal(draft.purchaseType,"wholesale");const restored=restoreBasket(draft,[{...product,wholesale:{...product.wholesale,unitPrice:7}}]);assert.equal(restored.cart[0].price,7);assert.equal(restored.cart[0].quantity,12);
 const receipt=offlineSaleReceipt({transactionId:"123e4567-e89b-42d3-a456-426614174000",cart,pricing:pricePurchaseCart(cart,[],[],"wholesale"),purchaseType:"wholesale",amountPaid:72,paymentMethod:"cash"});
 assert.equal(receipt.purchaseType,"wholesale");assert.equal(receipt.items[0].unitPrice,6);assert.equal(receipt.total,72);
});

test("packs use exact selling-unit cents, complete quantities and preserve piece stock semantics",async()=>{
 const {wholesaleMinimumUnits,wholesaleStepUnits,displayQuantity,displayUnitPrice,packDescription}=await import("../lib/wholesaleUnits.mjs");
 const {formatReceiptText}=await import("../lib/receiptData.mjs");
 const {capturedPricing}=await import("../lib/posOperations.mjs");
 const p={...product,stock:125,wholesale:{enabled:true,sellingUnit:"pack",unitsPerPack:12,unitPrice:35,minQty:1,increment:1,tiers:[{minQty:5,unitPrice:33}]}},cart=[{...p,quantity:24}],pricing=pricePurchaseCart(cart,[],[],"wholesale");
 assert.throws(()=>validateWholesale({...p.wholesale,sellingUnit:"unit"}),/pack size of 1/);
 const box={...p,wholesale:{...p.wholesale,sellingUnit:"box",unitsPerPack:50,unitPrice:100,tiers:[]}};assert.match(packDescription(purchaseProduct(box,"wholesale",100)),/2 boxes × 50 pcs/);
 assert.equal(wholesaleMinimumUnits(p),12);assert.equal(wholesaleStepUnits(p),12);assert.equal(pricing.total,70);assert.equal(pricing.discount,0);assert.equal(pricing.lines[0].quantity,24);assert.equal(displayQuantity(pricing.lines[0]),2);assert.equal(displayUnitPrice(pricing.lines[0]),35);assert.match(packDescription(pricing.lines[0]),/2 packs × 12 pcs/);
 assert.match(wholesaleQuantityIssue(p,13),/complete packs/);assert.match(wholesaleQuantityIssue(p,132),/unavailable/);assert.equal(pricePurchaseCart([{...p,quantity:60}],[],[],"wholesale").total,165);
 const receipt=offlineSaleReceipt({transactionId:"123e4567-e89b-42d3-a456-426614174000",cart,pricing,purchaseType:"wholesale",amountPaid:70,paymentMethod:"cash"});
 assert.equal(receipt.items[0].quantity,24);assert.equal(capturedPricing(receipt,[{id:p.id,quantity:24}]).total,70);assert.match(formatReceiptText(receipt),/packs/);assert.match(formatReceiptText(receipt),/35.00/);
 assert.throws(()=>capturedPricing({...receipt,items:[{...receipt.items[0],wholesaleSnapshot:{...receipt.items[0].wholesaleSnapshot,unitsPerPack:10}}]},[{id:p.id,quantity:24}]),/pack/);
 const report=tradePerformance([{purchaseType:"wholesale",total:70,items:[{...receipt.items[0],lineCost:48,costRecorded:true}]}]);assert.equal(report.wholesale.netUnits,24);assert.equal(report.wholesale.packsSold,2);assert.equal(report.wholesale.grossProfit,22);
 const csv="SKU,WHOLESALE_SELLING_UNIT,WHOLESALE_PACK_SIZE,WHOLESALE_PRICE,WHOLESALE_MIN_QTY,WHOLESALE_INCREMENT,WHOLESALE_TIERS\n"+product.sku+",box,50,100,1,1,NONE";
 const plan=planCatalogueImport(csv,[{docId:product.id,data:product}],{categories:[{categoryId:"c",name:"Bottles"}],subcategories:[],subSubcategories:[]});assert.equal(plan.errors.length,0);assert.equal(plan.entries[0].patch.wholesale.unitsPerPack,50);const roundtrip=planCatalogueImport(exportCatalogueCsv([{...product,wholesale:plan.entries[0].patch.wholesale}]),[{docId:product.id,data:{...product,wholesale:plan.entries[0].patch.wholesale}}],{categories:[{categoryId:"c",name:"Bottles"}],subcategories:[],subSubcategories:[]});assert.equal(roundtrip.errors.length,0);assert.equal(roundtrip.entries[0].patch.wholesale,undefined);
});

test("last complete pack remains wholesale-buyable while smaller shared stock remains retail-only",()=>{const p={...product,stock:50,wholesale:{enabled:true,sellingUnit:"pack",unitsPerPack:50,unitPrice:100,minQty:1,increment:1,tiers:[]}};assert.equal(wholesaleQuantityIssue(p,50),"");assert.match(wholesaleQuantityIssue({...p,stock:49},50),/unavailable/);assert.equal(purchaseProduct({...p,stock:49},"retail",1).price,10);});

test("retail reserve is per SKU in pieces and only wholesale is restricted",async()=>{
 const {wholesaleAvailableUnits}=await import("../lib/wholesaleUnits.mjs");const p={...product,stock:150,wholesale:{enabled:true,sellingUnit:"pack",unitsPerPack:50,unitPrice:100,minQty:1,increment:1,tiers:[],retailReserve:50}};
 assert.equal(wholesaleAvailableUnits(p),100);assert.equal(pricePurchaseCart([{...p,quantity:100}],[],[],"wholesale").total,200);assert.equal(wholesaleAvailableUnits({...p,stock:100}),50);assert.equal(wholesaleQuantityIssue({...p,stock:100},50),"");assert.match(wholesaleQuantityIssue({...p,stock:100},100),/Retail stock is protected/);assert.match(wholesaleQuantityIssue({...p,stock:50},50),/Retail stock is protected/);assert.equal(purchaseProduct({...p,stock:50},"retail",1).price,10);assert.equal(wholesaleAvailableUnits({...p,stock:30}),0);
 for(const retailReserve of [-1,1.5,1000000001])assert.throws(()=>validateWholesale({...p.wholesale,retailReserve}),/reserve/);
 const records=[{docId:p.id,data:p}],hierarchy={categories:[{categoryId:"c",name:"Bottles"}],subcategories:[],subSubcategories:[]};const changed=planCatalogueImport("SKU,WHOLESALE_RETAIL_RESERVE\nA,75",records,hierarchy);assert.equal(changed.errors.length,0);assert.equal(changed.entries[0].patch.wholesale.retailReserve,75);assert.equal(p.stock,150);const round=planCatalogueImport(exportCatalogueCsv([p]),records,hierarchy);assert.deepEqual(round.errors,[]);assert.equal(round.entries[0].patch.wholesale,undefined);
});
