import test from "node:test";
import assert from "node:assert/strict";
import {staffAccess,loginDestination,staffLoginUrl,afterStaffLogin} from "../lib/staffAccess.mjs";
test("Admin and POS retain their intended destination for every staff role",()=>{
 for(const role of ["owner","admin","supervisor","cashier"]){
  assert.equal(afterStaffLogin(loginDestination("?next=%2Fadmin"),role),"/admin");
  assert.equal(afterStaffLogin(loginDestination("?next=%2Fpos"),role),"/pos");
 }
 assert.equal(staffLoginUrl("/admin"),"/login?next=%2Fadmin");
 assert.equal(staffLoginUrl("/pos"),"/login?next=%2Fpos");
 assert.equal(afterStaffLogin("","cashier"),"/pos");
 for(const value of ["https://evil.example","//evil.example","/admin/../../elsewhere","%2Fadmin"]){
  assert.equal(loginDestination("?next="+encodeURIComponent(value)),"");
  assert.equal(afterStaffLogin(value,"owner"),"/admin");
 }
});
test("Existing profiles remain authoritative and no roles are granted from email addresses",()=>{
 assert.deepEqual(staffAccess({role:"owner"}),{role:"owner",active:true});
 assert.deepEqual(staffAccess({role:"cashier"},{role:"owner"}),{role:"cashier",active:true});
 assert.deepEqual(staffAccess({role:"owner",active:false},{role:"owner"}),{role:null,active:false});
 assert.deepEqual(staffAccess({},{role:"admin"}),{role:"admin",active:true});
 assert.deepEqual(staffAccess({email:"owner@example.test"}),{role:null,active:true});
 assert.deepEqual(staffAccess({role:"customer"}),{role:null,active:true});
});
