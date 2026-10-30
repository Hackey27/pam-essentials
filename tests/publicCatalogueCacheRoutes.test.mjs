import test from "node:test";
import assert from "node:assert/strict";
import {memoryFirestore} from "./fixtures/memoryFirestore.mjs";
import {GET} from "../app/api/catalog/products/route.js";
function setup(){
 const store=memoryFirestore({products:{P:{id:"P",name:"Blue pen",sku:"PEN",categoryId:"C",price:5,stock:4,active:true,costPrice:2,supplier:"private",barcodeHistory:[{code:"private"}]}},categories:{C:{name:"Writing",active:true}},subcategories:{},sub_subcategories:{},discount_rules:{},order_discount_rules:{},deal_bundles:{},settings:{},marketplace_settings:{},announcements:{},product_review_summaries:{}});
 globalThis.__pamTestStore=store;return store;
}
test("public catalogue cache serves repeat requests without reflecting unexpired source mutations or private fields",async()=>{
 const store=setup(),request=new Request("https://pam.local/api/catalog/products");
 const first=await GET(request);assert.equal(first.status,200);assert.equal(first.headers.get("cache-control"),"public, s-maxage=60, stale-while-revalidate=300");
 const body=await first.json();assert.equal(body.products[0].name,"Blue pen");for(const field of ["costPrice","supplier","barcodeHistory"])assert.equal(field in body.products[0],false);
 await store.collection("products").doc("P").update({name:"Changed in Admin"});
 const repeat=await GET(request);assert.equal((await repeat.json()).products[0].name,"Blue pen");assert.equal(repeat.headers.get("etag"),first.headers.get("etag"));
 const notModified=await GET(new Request(request.url,{headers:{"if-none-match":first.headers.get("etag")}}));assert.equal(notModified.status,304);
 const paged=await GET(new Request(request.url+"?q=pen&limit=1"));const page=await paged.json();assert.equal(page.products.length,1);assert.equal(page.pagination.total,1);
 const invalid=await GET(new Request(request.url+"?limit=10000"));assert.equal(invalid.status,400);assert.equal(invalid.headers.get("cache-control"),"no-store");
});
