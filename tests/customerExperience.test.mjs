import test from "node:test";
import assert from "node:assert/strict";
import {announcementDocument,announcementText,plainAnnouncementDocument,safeAnnouncementHref} from "../lib/announcementDocument.mjs";
import {customerTab,customerFirstName,customerNotifications,validCustomerSignup} from "../lib/customerAccount.mjs";
import {customerRoute,readNavigation,saveNavigation,navigationTarget,listingReturnTarget} from "../lib/customerNavigation.mjs";
const storage=()=>{const values=new Map();return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};};
test("Legacy messages remain readable and formatted messages retain only safe typed marks",()=>{
 const message="Welcome to PAM\nEveryday essentials";
 assert.equal(announcementText(plainAnnouncementDocument(message)),message);
 const doc={version:1,blocks:[{type:"paragraph",align:"left",runs:[{text:"Welcome",bold:true,color:"#00235b",fontSize:20,fontFamily:"Georgia",href:"/wholesale",onclick:"bad"}]}]};
 const parsed=announcementDocument(doc);assert.equal(parsed.blocks[0].runs[0].bold,true);assert.equal("onclick" in parsed.blocks[0].runs[0],false);
 for(const patch of [{color:"url(bad)"},{fontSize:1000},{fontFamily:"url(bad)"},{href:"javascript:alert(1)"}])assert.equal(announcementDocument({...doc,blocks:[{...doc.blocks[0],runs:[{text:"Welcome",...patch}]}]}),null);
 assert.equal(announcementDocument(plainAnnouncementDocument("x".repeat(1201))),null);
 assert.equal(safeAnnouncementHref("//bad.example"),false);assert.equal(safeAnnouncementHref("https://example.test"),true);assert.equal(safeAnnouncementHref("/\\"+"bad.example"),false);
});
test("Customer signup checks matching passwords and valid phone without granting marketing consent",()=>{
 const valid={name:"Ama Mensah",phone:"+233 20 000 0000",password:"password123",confirmation:"password123"};
 assert.equal(validCustomerSignup(valid),"");assert.match(validCustomerSignup({...valid,confirmation:"different"}),/do not match/);
 assert.match(validCustomerSignup({...valid,phone:"hello"}),/phone/);
 assert.equal(customerFirstName({name:" Ama Mensah "}),"Ama");assert.equal(customerFirstName({},{}),"there");
 assert.equal(customerTab(""),"orders");assert.equal(customerTab("#wishlist"),"wishlist");assert.equal(customerTab("#unknown","details"),"details");
});
test("Notification counts reflect real order/request timestamps and seen receipt",()=>{
 const notifications=customerNotifications([{orderId:"A",status:"ready",updatedAt:"2026-10-30T10:00:00Z"}],[{id:"B",kind:"inquiry",productName:"Rack",status:"quoted",updatedAt:"2026-10-30T09:00:00Z"}],"2026-10-30T09:30:00Z");
 assert.equal(notifications.filter(n=>n.unread).length,1);assert.equal(notifications[0].key,"order:A");assert.equal(notifications[1].tab,"requests");
 assert.equal(customerNotifications([{orderId:"bad"}]).length,0);
});
test("Customer navigation retains scroll/detail destinations and isolates account scopes",()=>{
 const store=storage(),now=Date.now();
 saveNavigation(store,"c","/products/PINK-500",{y:1450,details:["order:A"]},"home",now);
 assert.equal(navigationTarget(store,"c","home","/"),"/products/PINK-500");
 assert.deepEqual(readNavigation(store,"c",now).positions["/products/PINK-500"],{y:1450,details:["order:A"]});
 assert.equal(navigationTarget(store,"d","home","/"),"/");
 saveNavigation(store,"c","/account#details",{y:280,details:[]},"account",now);
 assert.equal(navigationTarget(store,"c","account","/account"),"/account#details");
 assert.deepEqual(readNavigation(store,"c",now+8*60*60*1000+1).positions,{});
 assert.equal(navigationTarget(store,"missing","home","/"),"/");
 for(const path of ["//evil.example","https://evil.example","/admin","/pos","/api/orders",undefined])assert.equal(customerRoute(path),null);
});

test("Product back returns to its listing after Account and Home tab round trips, never browser history",()=>{
 const now=Date.now(),store=storage(),listing={at:now,path:"/?browse=products"};
 saveNavigation(store,"customer","/products/PINK-500",{y:260,details:[]},"home",now);
 saveNavigation(store,"customer","/account#orders",{y:80,details:[]},"orders",now);
 assert.equal(navigationTarget(store,"customer","home","/"),"/products/PINK-500");
 assert.equal(listingReturnTarget(listing,"",now),"/?browse=products");
 assert.equal(listingReturnTarget({at:now,path:"/wholesale?category=bottles"},"",now),"/wholesale?category=bottles");
 for(const path of ["/account","/services","//evil.example","/admin","https://evil.example"]){
  assert.equal(listingReturnTarget({at:now,path},"",now),"/#catalogue");
 }
 assert.equal(listingReturnTarget({...listing,at:now-9*60*60*1000},"",now),"/#catalogue");
 assert.equal(listingReturnTarget({at:now,path:"/?cart=1&from=footer"},"SKU/BLUE",now),"/?quick=SKU%2FBLUE");
});
