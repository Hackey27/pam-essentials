import test from "node:test";
import assert from "node:assert/strict";
import {register} from "node:module";
register(new URL("./fixtures/imageStorage-loader.mjs",import.meta.url));
const {GET:imageGet}=await import("../app/images/[...path]/route.js");
const {GET:inventoryGet,POST:backfillPost}=await import("../app/api/admin/image-variants/route.js");
import {memoryFirestore} from "./fixtures/memoryFirestore.mjs";
test("invalid public resize parameters return400 before any storage request",async()=>{
 for(const query of ["w=1","w=320&q=80","w=320&fmt=avif","w=320&noise=1","w=320&w=640"]){
  const response=await imageGet(new Request("https://pam.local/images/products/a/gallery/p.jpg?"+query),{params:Promise.resolve({path:["products","a","gallery","p.jpg"]})});assert.equal(response.status,400);assert.equal(response.headers.get("cache-control"),"no-store");
 }
});
test("backfill requires Owner/Admin and image inventory paginates through projected fields without modifying products",async()=>{
 globalThis.__pamTestUsers=new Map([["owner",{uid:"owner",role:"owner"}],["cashier",{uid:"cashier",role:"cashier"}]]);
 const products=Object.fromEntries(Array.from({length:27},(_,i)=>["P"+String(i).padStart(2,"0"),{name:"Private name",costPrice:10,cardPreviewImagePath:"products/p"+i+"/card-preview/a.jpg"}]));
 const store=memoryFirestore({products,users:{owner:{role:"owner",active:true},cashier:{role:"cashier",active:true}},settings:{}});globalThis.__pamTestStore=store;
 const request=(suffix="",role="owner")=>new Request("https://pam.local/api/admin/image-variants"+suffix,{headers:role?{authorization:"Bearer "+role}:{}});
 assert.equal((await inventoryGet(request("","cashier"))).status,403);assert.equal((await inventoryGet(request("",null))).status,401);
 const first=await inventoryGet(request()),a=await first.json();assert.equal(a.paths.length,25);assert.equal(a.nextCursor,"P24");assert.equal(first.headers.get("cache-control"),"private,no-store");
 const second=await inventoryGet(request("?cursor="+a.nextCursor)),b=await second.json();assert.equal(b.paths.length,2);assert.equal(b.nextCursor,null);assert.equal(new Set([...a.paths,...b.paths]).size,27);
 const invalid=await backfillPost(new Request("https://pam.local/api/admin/image-variants",{method:"POST",headers:{authorization:"Bearer owner","content-type":"application/json"},body:JSON.stringify({path:"users/private.jpg"})}));assert.equal(invalid.status,400);
 assert.deepEqual(store.inspect("products","P00"),products.P00);
});
