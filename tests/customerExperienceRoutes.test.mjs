import test from "node:test";
import assert from "node:assert/strict";
import {memoryFirestore} from "./fixtures/memoryFirestore.mjs";
import {POST as saveAnnouncement} from "../app/api/admin/announcements/route.js";
import {PATCH as markRead,GET as profileGet} from "../app/api/customer/profile/route.js";
const request=(path,token,body,method="POST")=>new Request("https://pamess.com"+path,{method,headers:{...(token?{authorization:"Bearer "+token}:{}),"content-type":"application/json"},...(body?{body:JSON.stringify(body)}:{})});
function setup(){
 globalThis.__pamTestAuth=undefined;
 globalThis.__pamTestUsers=new Map([["owner",{uid:"owner",role:"owner"}],["c",{uid:"c",email:"c@example.test"}],["d",{uid:"d",email:"d@example.test"}]]);
 const store=memoryFirestore({users:{owner:{role:"owner",active:true}},announcements:{"ANN-A":{title:"Welcome",body:"Existing message",active:true}},customer_accounts:{c:{name:"Ama",phone:"0200000000",wishlist:["P1"],marketingEmail:false,marketingPhone:false},d:{name:"Other customer"}}});
 globalThis.__pamTestStore=store;return store;
}
test("Admin formatting is additive, audited and cannot save unsafe links or oversized message",async()=>{
 const store=setup(),body={announcementId:"ANN-A",title:"Welcome",body:"Welcome PAM",sortOrder:1,bodyDocument:{version:1,blocks:[{type:"paragraph",align:"left",runs:[{text:"Welcome PAM",bold:true,color:"#00235b"}]}]}};
 assert.equal((await saveAnnouncement(request("/api/admin/announcements","owner",body))).status,200);
 assert.equal(store.inspect("announcements","ANN-A").body,"Welcome PAM");assert.equal(store.inspect("announcements","ANN-A").bodyDocument.blocks[0].runs[0].bold,true);
 assert.equal((await store.collection("admin_audit").get()).docs.length,1);
 const bad=structuredClone(body);bad.bodyDocument.blocks[0].runs[0].href="javascript:alert(1)";
 assert.equal((await saveAnnouncement(request("/api/admin/announcements","owner",bad))).status,400);
 assert.equal((await saveAnnouncement(request("/api/admin/announcements","c",body))).status,403);
 assert.equal(store.inspect("announcements","ANN-A").body,"Welcome PAM");
 assert.equal((await saveAnnouncement(request("/api/admin/announcements","owner",{...body,bodyDocument:null,body:"Plain update"}))).status,200);
 assert.equal(store.inspect("announcements","ANN-A").body,"Plain update");assert.equal(store.inspect("announcements","ANN-A").bodyDocument,null);
});
test("Notification read receipts are private, server-timed and preserve contact/wishlist records",async()=>{
 const store=setup(),body={action:"notifications-read",uid:"d",name:"Changed"};
 assert.equal((await markRead(request("/api/customer/profile",null,body,"PATCH"))).status,401);
 assert.equal((await markRead(request("/api/customer/profile","owner",body,"PATCH"))).status,403);
 const response=await markRead(request("/api/customer/profile","c",body,"PATCH"));assert.equal(response.status,200);
 const data=await response.json();assert.ok(Number.isFinite(Date.parse(data.profile.notificationsSeenAt)));
 assert.equal(store.inspect("customer_accounts","d").notificationsSeenAt,undefined);
 assert.deepEqual(store.inspect("customer_accounts","c").wishlist,["P1"]);assert.equal(store.inspect("customer_accounts","c").phone,"0200000000");assert.equal(store.inspect("customer_accounts","c").marketingPhone,false);
 const loaded=await(await profileGet(request("/api/customer/profile","c",null,"GET"))).json();assert.equal(loaded.profile.notificationsSeenAt,data.profile.notificationsSeenAt);
 assert.equal((await markRead(request("/api/customer/profile","c",{action:"grant-role"},"PATCH"))).status,400);
});
