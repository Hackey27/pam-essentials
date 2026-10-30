import test from "node:test";
import assert from "node:assert/strict";
import {STAFF_IDLE_MS,staffSessionActive,readStaffSession,verifyStaffSession,touchStaffSession,clearStaffSession} from "../lib/staffSession.mjs";
const store=()=>{const values=new Map();return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};};
test("Staff session locks at ten minutes and activity cannot revive an expired session",()=>{
 const storage=store(),uid="idle-staff",start=1000;verifyStaffSession(storage,uid,start);
 assert.ok(readStaffSession(storage,uid,start+STAFF_IDLE_MS-1));
 assert.equal(readStaffSession(storage,uid,start+STAFF_IDLE_MS),null);
 assert.equal(touchStaffSession(storage,uid,start+STAFF_IDLE_MS),null);
 assert.equal(readStaffSession(storage,uid,start+STAFF_IDLE_MS+1000),null);
 verifyStaffSession(storage,uid,start+STAFF_IDLE_MS+2000);
 assert.ok(readStaffSession(storage,uid,start+STAFF_IDLE_MS+2001));
});
test("Active interaction extends inactivity but refresh and route changes do not",()=>{
 const storage=store(),start=1000,uid="active-staff";verifyStaffSession(storage,uid,start);
 touchStaffSession(storage,uid,start+500000);
 const afterReload=readStaffSession(storage,uid,start+600000);
 assert.equal(afterReload.lastActivity,start+500000);assert.equal(afterReload.verifiedAt,start);
 assert.equal(readStaffSession(storage,uid,start+500000+STAFF_IDLE_MS),null);
});
test("Sessions are tied to staff identity, reject clock rollback and clear on sign-out",()=>{
 const storage=store(),uid="logout-staff";const value=verifyStaffSession(storage,uid,1000);
 assert.equal(staffSessionActive(value,"another-staff",1001),false);
 assert.equal(staffSessionActive(value,uid,999),false);
 clearStaffSession(storage,uid);assert.equal(readStaffSession(storage,uid,1001),null);
 assert.equal(staffSessionActive({uid,verifiedAt:1000,lastActivity:999},uid,1001),false);
});
test("Storage failures allow only a verified in-memory session and do not bypass expiry",()=>{
 const storage={getItem(){throw Error("blocked")},setItem(){throw Error("blocked")},removeItem(){throw Error("blocked")}},uid="storage-staff";
 assert.equal(readStaffSession(storage,uid,1000),null);verifyStaffSession(storage,uid,1000);
 assert.ok(readStaffSession(storage,uid,1001));
 assert.equal(readStaffSession(storage,uid,1000+STAFF_IDLE_MS),null);
 clearStaffSession(storage,uid);assert.equal(readStaffSession(storage,uid,1001),null);
});
