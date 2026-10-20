import {offlineSaleReceipt} from "../lib/offlineSale.mjs";
import {pricePurchaseCart} from "../lib/wholesale.mjs";
import test from "node:test";import assert from "node:assert/strict";
import {memoryFirestore} from "./fixtures/memoryFirestore.mjs";
import {POST as orderPost} from "../app/api/orders/route.js";
import {POST as salePost} from "../app/api/pos/sales/route.js";
import {POST as productPost} from "../app/api/admin/products/route.js";
import {GET as reportGet} from "../app/api/admin/trade-report/route.js";
import {GET as catalogueGet} from "../app/api/catalog/products/route.js";
import {POST as importPost} from "../app/api/admin/catalogue-import/route.js";
const whole={enabled:true,unitPrice:6,minQty:12,increment:6,tiers:[{minQty:24,unitPrice:5}]};
const request=(url,body,role)=>new Request("http://test"+url,{method:body?"POST":"GET",headers:{"content-type":"application/json",...(role?{authorization:"Bearer "+role}:{})},...(body?{body:JSON.stringify(body)}:{})});
function setup(){
 globalThis.__pamTestUsers=new Map(["owner","cashier","supervisor","customer"].map(role=>[role,{uid:role,role,displayName:"Demo "+role}]));
 const store=memoryFirestore({users:Object.fromEntries(["owner","cashier","supervisor","customer"].map(role=>[role,{role,active:true,displayName:"Demo "+role}])),categories:{c:{name:"Bottles",active:true,sortOrder:2}},subcategories:{},sub_subcategories:{},settings:{},discount_rules:{d:{active:true,scopeType:"GLOBAL",discountType:"PERCENT",value:50,minQty:1}},deal_bundles:{},products:{A:{id:"A",sku:"SKU-A",name:"Blue bottle",categoryId:"c",category:"Bottles",price:10,costPrice:3,stock:100,active:true,productGroupId:"G",variantOptions:{colour:"Blue"},wholesale:whole,imageUrl:"https://example.test/a.jpg"},B:{id:"B",sku:"SKU-B",name:"Pink bottle",categoryId:"c",category:"Bottles",price:null,costPrice:4,stock:100,active:true,productGroupId:"G",variantOptions:{colour:"Pink"},wholesale:whole}},shifts:{S:{shiftId:"S",staffId:"cashier",status:"open",staffName:"Demo Cashier"}},orders:{},sales:{},stock_movements:{},receipt_sequences:{},admin_audit:{}});
 globalThis.__pamTestStore=store;return store;
}
const order={customer:"Sample Buyer",phone:"0201234567",deliveryMethod:"pickup",purchaseType:"wholesale",expectedTotal:72,items:[{id:"A",quantity:12}]};
const sale={transactionId:"wholesale-test-1",purchaseType:"wholesale",expectedTotal:72,shiftId:"S",deviceId:"demo-till",paymentMethod:"cash",amountPaid:72,items:[{id:"A",quantity:12}]};
test("wholesale order prices are server-owned, do not stack promotions and keep retail stock and image identity",async()=>{
 const store=setup();const response=await orderPost(request("/api/orders",{...order,items:[{id:"A",quantity:12,price:.01}]}));
 assert.equal(response.status,200);const result=await response.json();assert.equal(result.total,72);assert.equal(result.discount,0);assert.equal(result.purchaseType,"wholesale");assert.equal(result.items[0].unitPrice,6);assert.equal(store.inspect("products","A").stock,100);assert.equal(store.inspect("products","A").price,10);
 const record=store.inspect("orders",result.orderId);assert.equal(record.items[0].sku,"SKU-A");assert.deepEqual(record.items[0].variantOptions,{colour:"Blue"});assert.equal(record.items[0].wholesaleSnapshot.minQty,12);assert.equal(record.purchaseType,"wholesale");assert.equal(record.channel,"website");
});
test("MOQ is per exact variant and fractional, unavailable or stale-priced wholesale requests write no order",async()=>{
 const store=setup();
 for(const body of [{...order,items:[{id:"A",quantity:6},{id:"B",quantity:6}]},{...order,items:[{id:"A",quantity:12.5}]},{...order,expectedTotal:1},{...order,items:[{id:"A",quantity:102}]}]){
 const r=await orderPost(request("/api/orders",body));assert.ok([400,409].includes(r.status),await r.text());
 }
 assert.equal((await store.collection("orders").get()).docs.length,0);assert.equal(store.inspect("products","A").stock,100);
});
test("POS wholesale decrements shared stock once, captures costs/prices/type and report never reprices history",async()=>{
 const store=setup();const first=await salePost(request("/api/pos/sales",sale,"cashier"));assert.equal(first.status,200,await first.clone().text());const receipt=await first.json();
 assert.equal(receipt.purchaseType,"wholesale");assert.equal(receipt.total,72);assert.equal(receipt.items[0].unitPrice,6);assert.equal(receipt.items[0].unitCost,undefined);assert.equal(store.inspect("products","A").stock,88);
 assert.equal((await (await salePost(request("/api/pos/sales",sale,"cashier"))).json()).duplicate,true);assert.equal(store.inspect("products","A").stock,88);
 const recorded=store.inspect("sales","wholesale-test-1");assert.equal(recorded.cost,36);assert.equal(recorded.profit,36);assert.equal(recorded.salesChannel,"walk-in");
 await store.collection("products").doc("A").update({price:99,costPrice:90,wholesale:{...whole,unitPrice:40,tiers:[]}});
 const response=await reportGet(request("/api/admin/trade-report?period=all",null,"owner"));assert.equal(response.status,200);const result=await response.json();assert.equal(result.report.wholesale.revenue,72);assert.equal(result.report.wholesale.cogs,36);assert.equal(result.report.wholesale.marginPct,50);assert.equal(result.report.combined.revenue,72);
});
test("private trade reports reject cashier, supervisor, customer and anonymous requests",async()=>{
 setup();for(const role of ["cashier","supervisor","customer",undefined]){const response=await reportGet(request("/api/admin/trade-report?period=all",null,role));assert.ok([401,403].includes(response.status));}
});
test("wholesale-only prices are in the public wholesale collection, retail visibility and cost privacy retained",async()=>{
 setup();const response=await catalogueGet();assert.equal(response.status,200);const result=await response.json();assert.deepEqual(result.products.map(p=>p.id),["A"]);assert.deepEqual(result.wholesaleProducts.map(p=>p.id).sort(),["A","B"]);for(const p of result.wholesaleProducts){assert.equal(p.costPrice,undefined);assert.equal(p.wholesale.unitPrice,6);}
});
test("CSV preview/apply updates both prices by SKU with audit, preserving stock, variants and image",async()=>{
 const store=setup(),body={mode:"preview",fileName:"wholesale.csv",csv:"SKU,PRICE,WHOLESALE_PRICE,WHOLESALE_MIN_QTY\nSKU-A,11,7,18"};
 const previewResponse=await importPost(request("/api/admin/catalogue-import",body,"owner"));assert.equal(previewResponse.status,200,await previewResponse.clone().text());const preview=await previewResponse.json();assert.equal(store.inspect("products","A").price,10);
 const applied=await importPost(request("/api/admin/catalogue-import",{...body,mode:"apply",previewHash:preview.previewHash,requestId:"123e4567-e89b-42d3-a456-426614174000"},"owner"));assert.equal(applied.status,200,await applied.clone().text());const p=store.inspect("products","A");assert.equal(p.price,11);assert.equal(p.wholesale.unitPrice,7);assert.equal(p.wholesale.minQty,18);assert.equal(p.stock,100);assert.equal(p.imageUrl,"https://example.test/a.jpg");assert.equal(p.productGroupId,"G");assert.equal(p.costPrice,3);
 const audit=(await store.collection("admin_audit").get()).docs[0].data();assert.equal(audit.newValue.products[0].wholesaleBefore.unitPrice,6);assert.equal(audit.newValue.products[0].wholesaleAfter.unitPrice,7);
});
test("Admin can edit wholesale prices later; invalid and cashier edits never change saved settings",async()=>{
 const store=setup(),body={id:"A",sku:"SKU-A",name:"Blue bottle",categoryId:"c",price:10,costPrice:3,active:true,wholesale:{...whole,unitPrice:7}};
 const saved=await productPost(request("/api/admin/products",body,"owner"));assert.equal(saved.status,200,await saved.clone().text());assert.equal(store.inspect("products","A").wholesale.unitPrice,7);assert.equal(store.inspect("products","B").wholesale.unitPrice,6);assert.equal(store.inspect("products","A").stock,100);
 assert.equal((await productPost(request("/api/admin/products",{...body,wholesale:{...whole,minQty:0}},"owner"))).status,400);
 assert.equal((await productPost(request("/api/admin/products",body,"cashier"))).status,403);assert.equal(store.inspect("products","A").wholesale.unitPrice,7);
});

test("pack orders and POS retain exact pack totals and deduct shared piece stock once",async()=>{
 const store=setup(),pack={enabled:true,sellingUnit:"pack",unitsPerPack:12,unitPrice:35,minQty:1,increment:1,tiers:[]};await store.collection("products").doc("A").update({wholesale:pack,stock:125,costPrice:2});
 const requestBody={...order,expectedTotal:70,items:[{id:"A",quantity:24,expectedPackSize:12,expectedSellingUnit:"pack"}]};
 const response=await orderPost(request("/api/orders",requestBody));assert.equal(response.status,200,await response.clone().text());const placed=await response.json();assert.equal(placed.total,70);assert.equal(placed.items[0].wholesaleSnapshot.sellingUnitPrice,35);assert.equal(placed.items[0].wholesaleSnapshot.sellingQuantity,2);assert.equal(store.inspect("products","A").stock,125);
 const stale=await orderPost(request("/api/orders",{...requestBody,items:[{id:"A",quantity:24,expectedPackSize:50,expectedSellingUnit:"box"}]}));assert.equal(stale.status,409);
 const bad=await orderPost(request("/api/orders",{...requestBody,items:[{id:"A",quantity:13,expectedPackSize:12,expectedSellingUnit:"pack"}]}));assert.equal(bad.status,409);
 const payload={...sale,transactionId:"pack-sale",expectedTotal:70,amountPaid:70,items:[{id:"A",quantity:24,expectedPackSize:12,expectedSellingUnit:"pack"}]};const saved=await salePost(request("/api/pos/sales",payload,"cashier"));assert.equal(saved.status,200,await saved.clone().text());const receipt=await saved.json();assert.equal(receipt.total,70);assert.equal(receipt.items[0].quantity,24);assert.equal(receipt.items[0].wholesaleSnapshot.unitsPerPack,12);assert.equal(receipt.items[0].unitCost,undefined);assert.equal(store.inspect("products","A").stock,101);assert.equal(store.inspect("sales","pack-sale").cost,48);assert.equal(store.inspect("sales","pack-sale").profit,22);
 await salePost(request("/api/pos/sales",payload,"cashier"));assert.equal(store.inspect("products","A").stock,101);
 await store.collection("products").doc("A").update({wholesale:{...pack,unitsPerPack:50,unitPrice:100}});const report=await (await reportGet(request("/api/admin/trade-report?period=all",null,"owner"))).json();assert.equal(report.report.wholesale.packsSold,2);assert.equal(report.report.wholesale.netUnits,24);assert.equal(report.report.wholesale.grossProfit,22);
});

test("offline pack receipts retain original packaging through explicit owner reconciliation",async()=>{
 const store=setup(),pack={enabled:true,sellingUnit:"pack",unitsPerPack:12,unitPrice:35,minQty:1,increment:1,tiers:[]};await store.collection("products").doc("A").update({wholesale:pack,stock:125,costPrice:2});const p={...store.inspect("products","A"),quantity:24},pricing=pricePurchaseCart([p],[],[],"wholesale"),transactionId="123e4567-e89b-42d3-a456-426614174000";
 const receipt=offlineSaleReceipt({transactionId,cart:[p],pricing,purchaseType:"wholesale",amountPaid:70,paymentMethod:"cash"});const payload={...sale,transactionId,offlineFinal:true,offlineTotal:70,amountPaid:70,items:[{id:"A",quantity:24,expectedPackSize:12,expectedSellingUnit:"pack"}]};await store.collection("products").doc("A").update({wholesale:{...pack,unitsPerPack:50,unitPrice:100}});
 const conflict=await salePost(request("/api/pos/sales",payload,"cashier"));assert.equal(conflict.status,409);assert.equal(store.inspect("products","A").stock,125);
 const reconciled=await salePost(request("/api/pos/sales",{...payload,reconciliation:{reason:"Sample captured pack review",confirmCaptured:true,receipt}},"owner"));assert.equal(reconciled.status,200,await reconciled.clone().text());const result=await reconciled.json();assert.equal(result.total,70);assert.equal(result.items[0].wholesaleSnapshot.unitsPerPack,12);assert.equal(result.items[0].wholesaleSnapshot.sellingUnitPrice,35);assert.equal(store.inspect("products","A").stock,101);
});

test("reserve blocks wholesale orders and repeated sales while retail may use reserved pieces",async()=>{
 const store=setup(),config={enabled:true,sellingUnit:"pack",unitsPerPack:50,unitPrice:100,minQty:1,increment:1,tiers:[],retailReserve:50};await store.collection("products").doc("A").update({wholesale:config,stock:100});
 const item={id:"A",quantity:50,expectedPackSize:50,expectedSellingUnit:"pack"};const over=await orderPost(request("/api/orders",{...order,expectedTotal:200,items:[{...item,quantity:100}]}));assert.equal(over.status,409);assert.match((await over.json()).error,/Retail stock is protected/);assert.equal((await store.collection("orders").get()).docs.length,0);
 const requested=await orderPost(request("/api/orders",{...order,expectedTotal:100,items:[item]}));assert.equal(requested.status,200);assert.equal(store.inspect("products","A").stock,100);
 const payload={...sale,transactionId:"reserve-sale",expectedTotal:100,amountPaid:100,items:[item]};const sold=await salePost(request("/api/pos/sales",payload,"cashier"));assert.equal(sold.status,200,await sold.clone().text());assert.equal(store.inspect("products","A").stock,50);
 const blocked=await salePost(request("/api/pos/sales",{...payload,transactionId:"reserve-second"},"cashier"));assert.equal(blocked.status,409);assert.equal(store.inspect("products","A").stock,50);assert.equal(store.inspect("sales","reserve-second"),undefined);
 const retail=await salePost(request("/api/pos/sales",{...payload,transactionId:"retail-reserve",purchaseType:"retail",amountPaid:10,items:[{id:"A",quantity:1}]},"cashier"));assert.equal(retail.status,200,await retail.clone().text());assert.equal(store.inspect("products","A").stock,49);
 const reserveEdit=await productPost(request("/api/admin/products",{id:"A",sku:"SKU-A",name:"Blue bottle",categoryId:"c",price:10,costPrice:3,active:true,wholesale:{...config,retailReserve:75}},"owner"));assert.equal(reserveEdit.status,200);assert.equal(store.inspect("products","A").wholesale.retailReserve,75);assert.equal(store.inspect("products","A").stock,49);assert.equal(store.inspect("products","B").wholesale.retailReserve,undefined);
});
test("offline reconciliation cannot consume current retail reserve",async()=>{
 const store=setup(),config={enabled:true,sellingUnit:"pack",unitsPerPack:50,unitPrice:100,minQty:1,increment:1,tiers:[],retailReserve:0};await store.collection("products").doc("A").update({wholesale:config,stock:100});const p={...store.inspect("products","A"),quantity:100},pricing=pricePurchaseCart([p],[],[],"wholesale"),transactionId="123e4567-e89b-42d3-a456-426614174001",receipt=offlineSaleReceipt({transactionId,cart:[p],pricing,purchaseType:"wholesale",amountPaid:200,paymentMethod:"cash"});await store.collection("products").doc("A").update({wholesale:{...config,retailReserve:50}});
 const payload={...sale,transactionId,offlineFinal:true,offlineTotal:200,amountPaid:200,items:[{id:"A",quantity:100,expectedPackSize:50,expectedSellingUnit:"pack"}],reconciliation:{reason:"Captured sample review",confirmCaptured:true,receipt}};const blocked=await salePost(request("/api/pos/sales",payload,"owner"));assert.equal(blocked.status,409);assert.match((await blocked.json()).error,/Retail stock is protected/);assert.equal(store.inspect("products","A").stock,100);assert.equal(store.inspect("sales",transactionId),undefined);
});
