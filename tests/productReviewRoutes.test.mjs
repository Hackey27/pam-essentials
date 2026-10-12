import test from "node:test";
import assert from "node:assert/strict";
import { memoryFirestore } from "./fixtures/memoryFirestore.mjs";
import { GET as listPublic } from "../app/api/product-reviews/route.js";
import { GET as own, POST as submit } from "../app/api/customer/reviews/route.js";
import { GET as listAdmin, POST as moderate } from "../app/api/admin/reviews/route.js";
import { GET as catalogue } from "../app/api/catalog/products/route.js";
import { publicReviewCollection, reviewId, reviewKey } from "../lib/reviewStore.js";
const product = { id: "p1", sku: "PINK", name: "Pink bottle", categoryId: "c", category: "Bottles", productGroupId: "g", variantOptions: { colour: "Pink" }, price: 45, stock: 7, active: true, galleryImagePaths: ["unchanged"] };
const request = (path, token, body) => new Request(`http://test${path}`, { method: body ? "POST" : "GET", headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { "content-type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
const values = { productId: "p1", rating: 1, publicName: "Ada", title: "Size", text: "Smaller than expected", revision: 0, status: "published", verifiedPurchase: true };
function setup() {
  globalThis.__pamTestAuth = undefined;
  globalThis.__pamTestUsers = new Map([["owner", { uid: "owner", role: "owner" }], ["cashier", { uid: "cashier", role: "cashier" }], ["a", { uid: "a", email: "private@test" }], ["b", { uid: "b", email: "private-b@test" }]]);
  const store = memoryFirestore({ users: { owner: { role: "owner" }, cashier: { role: "cashier" } }, categories: { c: { categoryId: "c", name: "Bottles", active: true } }, subcategories: {}, sub_subcategories: {}, discount_rules: {}, deal_bundles: {}, settings: {}, announcements: {}, products: { p1: product, p2: { ...product, id: "p2", name: "Blue bottle", sku: "BLUE", variantOptions: { colour: "Blue" } } }, orders: { purchased: { customerUid: "a", status: "completed", paymentStatus: "paid", items: [{ productId: "p1", quantity: 2 }] } } });
  const original = store.collection.bind(store);
  store.collection = (name) => { const c = original(name); const query = (field, count = 101, after = null) => ({ limit: (n) => query(field,n,after), startAfter: (snap) => query(field,count,snap.id), async get() { const docs = (await c.get()).docs.sort((a,b) => { const time = (d) => { const v = d.data()[field]; return v?.toDate?.()?.getTime() || new Date(v || 0).getTime(); }; return time(b)-time(a) || a.id.localeCompare(b.id); }); const start = after ? docs.findIndex((v) => v.id === after)+1 : 0; return { docs: docs.slice(start,start+count) }; } }); return { ...c, orderBy: (field) => query(field) }; };
  globalThis.__pamTestStore = store; return store;
}
test("authenticated customer submissions are pending, idempotent and private; staff cannot submit or moderate as customers", async () => {
  const store = setup(), before = structuredClone(store.inspect("products", "p1"));
  for (const [token,status] of [[null,401],["cashier",403]]) { assert.equal((await submit(request("/api/customer/reviews",token,values))).status,status); assert.equal((await listAdmin(request("/api/admin/reviews",token))).status,status); }
  assert.equal((await listAdmin(request("/api/admin/reviews","a"))).status,403);
  assert.equal((await submit(request("/api/customer/reviews","a",values))).status,200);
  const id = reviewId(reviewKey(product),"a"), saved = store.inspect("product_reviews",id);
  assert.equal(saved.status,"pending"); assert.equal(saved.verifiedPurchase,true); assert.equal(saved.variant,"Pink");
  assert.equal((await (await submit(request("/api/customer/reviews","a",values))).json()).duplicate,true);
  assert.equal((await (await own(request("/api/customer/reviews?productId=p2","a"))).json()).review.id,id);
  assert.equal((await (await own(request("/api/customer/reviews?productId=p1","b"))).json()).review,null);
  const page = await (await listPublic(request("/api/product-reviews?productId=p1"))).json(); assert.equal(page.reviews.length,0); assert.equal(page.summary.count,0);
  assert.deepEqual(store.inspect("products","p1"),before); assert.equal((await store.collection("orders").get()).docs.length,1);
});
test("moderation publishes negative reviews, updates group averages exactly once, and never exposes private fields or rewrites customer text", async () => {
  const store = setup(); await submit(request("/api/customer/reviews","a",values));
  const key = reviewKey(product), id = reviewId(key,"a"), change = { id, revision:1, status:"published", reply:"Thank you for the feedback.", text:"changed", rating:5 };
  assert.equal((await moderate(request("/api/admin/reviews","cashier",change))).status,403);
  assert.equal((await moderate(request("/api/admin/reviews","owner",change))).status,200);
  assert.equal((await moderate(request("/api/admin/reviews","owner",change))).status,409);
  assert.equal(store.inspect("product_reviews",id).text,values.text); assert.equal(store.inspect("product_reviews",id).rating,1);
  assert.equal((await store.collection("admin_audit").get()).docs.length,1);
  const publicData = await (await listPublic(request("/api/product-reviews?productId=p2"))).json(); assert.equal(publicData.summary.average,1); assert.equal(publicData.reviews[0].verifiedPurchase,true); assert.equal(publicData.reviews[0].reply,change.reply);
  for (const field of ["customerUid","email","sku","reason","payloadHash","moderatedBy"]) assert.equal(publicData.reviews[0][field],undefined);
  await submit(request("/api/customer/reviews","b",{ ...values, productId:"p2",rating:5,publicName:"Ben" }));
  const second = reviewId(key,"b"); assert.equal(store.inspect("product_reviews",second).verifiedPurchase,false);
  await moderate(request("/api/admin/reviews","owner",{ id:second,revision:1,status:"published" }));
  const cat = await (await catalogue()).json(); assert.equal(cat.products.length,2); for (const p of cat.products) { assert.equal(p.rating,3); assert.equal(p.reviewCount,2); assert.equal(p.stock,7); assert.deepEqual(p.galleryImagePaths,["unchanged"]); }
  const edited = { ...values,rating:2,text:"Updated after another use",revision:2 };
  assert.equal((await submit(request("/api/customer/reviews","a",edited))).status,200); assert.equal(store.inspect("product_review_summaries",key).count,1); assert.equal(store.inspect("product_review_summaries",key).average,5);
  assert.equal((await publicReviewCollection(store,key).doc(id).get()).exists,false);
  assert.equal((await moderate(request("/api/admin/reviews","owner",{ id:second,revision:2,status:"hidden",reason:"Contains unrelated content" }))).status,200);
  assert.equal(store.inspect("product_review_summaries",key).count,0); assert.equal((await (await listPublic(request("/api/product-reviews?productId=p1"))).json()).reviews.length,0);
});
test("validation, stale revisions, pagination and rate limits are explicit; database errors do not claim success", async () => {
  let store = setup(); assert.equal((await submit(request("/api/customer/reviews","a",{ ...values,rating:6 }))).status,400);
  assert.equal((await submit(request("/api/customer/reviews","a",{ ...values,productId:"missing" }))).status,404);
  assert.equal((await listPublic(request("/api/product-reviews?productId=p1&cursor=wrong"))).status,400);
  await submit(request("/api/customer/reviews","a",values));
  assert.equal((await submit(request("/api/customer/reviews","a",{ ...values,text:"changed content",revision:0 }))).status,409);
  for (let n=1;n<5;n++) assert.equal((await submit(request("/api/customer/reviews","a",{ ...values,text:`Changed content ${n}`,revision:n }))).status,200);
  assert.equal((await submit(request("/api/customer/reviews","a",{ ...values,text:"sixth submission",revision:5 }))).status,429);
  const key = reviewKey(product), c = publicReviewCollection(store,key);
  for (let n=0;n<23;n++) await c.doc(n.toString(16).padStart(64,"0")).set({ publicName:"Customer",rating:5,text:"Great",createdAt:new Date(Date.now()-n*1000) });
  const first = await (await listPublic(request("/api/product-reviews?productId=p1"))).json(); assert.equal(first.reviews.length,20); assert.ok(first.nextCursor);
  const second = await (await listPublic(request(`/api/product-reviews?productId=p1&cursor=${first.nextCursor}`))).json(); assert.equal(second.reviews.length,3); assert.equal(second.nextCursor,null);
  store = setup(); store.runTransaction = async () => { throw new Error("private connection secret"); };
  const failure = await submit(request("/api/customer/reviews","a",values)); assert.equal(failure.status,503); assert.doesNotMatch(JSON.stringify(await failure.json()),/private connection secret/); assert.equal((await store.collection("product_reviews").get()).docs.length,0);
});
