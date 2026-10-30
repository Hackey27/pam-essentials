import test from "node:test";
import assert from "node:assert/strict";
import {memoryFirestore} from "./fixtures/memoryFirestore.mjs";
import {GET} from "../app/api/staff/session/route.js";
const req=token=>new Request("https://pamess.com/api/staff/session?uid=owner&role=owner",{headers:token?{authorization:"Bearer "+token}:{}});
function setup(){
 globalThis.__pamTestAuth=undefined;
 globalThis.__pamTestUsers=new Map([["owner",{uid:"owner"}],["cashier",{uid:"cashier",role:"owner"}],["customer",{uid:"customer",email:"owner@example.test"}],["disabled",{uid:"disabled",role:"owner"}],["claimed",{uid:"claimed",role:"admin"}]]);
 const store=memoryFirestore({users:{owner:{role:"owner",active:true},cashier:{role:"cashier",active:true},disabled:{role:"owner",active:false}}});
 globalThis.__pamTestStore=store;return store;
}
test("Session rejects unauthenticated and invalid tokens",async()=>{
 setup();assert.equal((await GET(req())).status,401);assert.equal((await GET(req("invalid"))).status,401);
});
test("A verified Admin role is read without exposing private profile fields",async()=>{
 const store=setup(),response=await GET(req("owner"));
 assert.equal(response.status,200);assert.deepEqual(await response.json(),{uid:"owner",role:"owner",active:true});
 assert.match(response.headers.get("cache-control"),/private.*no-store/);
 assert.equal((await store.collection("users").get()).docs.length,3);
});
test("Client parameters cannot elevate roles and inactive users remain blocked",async()=>{
 setup();assert.deepEqual(await(await GET(req("cashier"))).json(),{uid:"cashier",role:"cashier",active:true});
 assert.deepEqual(await(await GET(req("disabled"))).json(),{uid:"disabled",role:null,active:false});
 assert.deepEqual(await(await GET(req("customer"))).json(),{uid:"customer",role:null,active:true});
 assert.deepEqual(await(await GET(req("claimed"))).json(),{uid:"claimed",role:"admin",active:true});
});
test("Database failure is reported as unavailable rather than a missing role",async()=>{
 setup();globalThis.__pamTestStore={collection(){throw Error("unavailable");}};
 const response=await GET(req("owner"));assert.equal(response.status,503);
 const result=await response.json();assert.match(result.error,/could not be checked/);assert.equal("role" in result,false);
});
test("Token verification failures cannot return a role",async()=>{
 setup();let checked=false;
 globalThis.__pamTestAuth={async verifyIdToken(token){checked=token==="owner";throw Error("invalid");}};
 assert.equal((await GET(req("owner"))).status,401);assert.equal(checked,true);
 globalThis.__pamTestAuth=undefined;
});
