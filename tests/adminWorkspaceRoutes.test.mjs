import { GET as publicCatalogue } from "../app/api/catalog/products/route.js";
import test from "node:test";
import assert from "node:assert/strict";
import { POST as bulk } from "../app/api/admin/bulk-products/route.js";
import { GET as views, POST as saveView } from "../app/api/admin/product-views/route.js";
import { GET as attention } from "../app/api/admin/attention/route.js";
import { POST as saveProduct } from "../app/api/admin/products/route.js";
import { GET as inquiryRecord } from "../app/api/admin/inquiries/route.js";
import { GET as sourcingRecord } from "../app/api/admin/product-requests/route.js";
import { GET as reviewRecord } from "../app/api/admin/reviews/route.js";
import { GET as catalog } from "../app/api/admin/catalog/route.js";
import { memoryFirestore } from "./fixtures/memoryFirestore.mjs";
const req = (body, role = "owner", path = "bulk-products") => new Request(`http://test/api/admin/${path}`, { method: "POST", headers: { authorization: `Bearer ${role}`, "content-type": "application/json" }, body: JSON.stringify(body) });
const get = (role = "owner", path = "attention") => new Request(`http://test/api/admin/${path}`, { headers: { authorization: `Bearer ${role}` } });
const requestId = "123e4567-e89b-42d3-a456-426614174000";
function setup() {
  globalThis.__pamTestUsers = new Map(["owner", "admin", "supervisor", "cashier"].map((role) => [role, { uid: role, role }]));
  globalThis.__pamTestStore = memoryFirestore({ users: Object.fromEntries(["owner", "admin", "supervisor", "cashier"].map((role) => [role, { role }])), categories: { c: { name: "School", active: true, sortOrder: 7 }, d: { name: "Home", active: true } }, subcategories: {}, sub_subcategories: {}, products: { P: { id: "P", sku: "SKU-P", name: "Pen", categoryId: "c", category: "School", price: 20, stock: 10, active: true, archived: false, sellable: true, barcode: "123", imageUrl: "https://example.test/p.jpg", collections: [], productGroupId: "" }, Q: { id: "Q", sku: "SKU-Q", name: "Quote rack", categoryId: "c", price: null, stock: 3, contactForPrice: true, active: true } }, orders: { O: { orderId: "O", status: "pending", customer: "Demo", createdAt: "2026-10-10T10:00Z" }, DONE: { status: "completed" } }, inquiries: { I: { status: "new", name: "Demo", reference: "INQ", createdAt: "2026-10-09T10:00Z" }, R: { status: "resolved" } }, product_requests: { R: { status: "checking-availability", reference: "REQ", createdAt: "2026-10-08T10:00Z", imageIds: ["private-photo"] } }, product_reviews: { REVIEW: { status: "pending", productName: "Pen", rating: 3, text: "Demo review", publicName: "Demo", createdAt: "2026-09-01T12:00Z", updatedAt: "2026-10-11T12:00Z", revision: 2 } } });
  return globalThis.__pamTestStore;
}
const changes = { ids: ["P"], patch: { price: 25, active: false, collections: { mode: "add", values: ["Back to School"] } }, reason: "Seasonal update" };
test("bulk preview writes nothing; apply preserves identifiers, images, barcode, groups and stock; retries are idempotent", async () => {
  const store = setup(), preview = await (await bulk(req({ ...changes, mode: "preview" }))).json(); assert.equal(store.inspect("products", "P").price, 20); assert.equal((await store.collection("admin_audit").get()).docs.length, 0);
  const body = { ...changes, mode: "apply", previewHash: preview.previewHash, requestId };
  assert.equal((await bulk(req(body))).status, 200); const p = store.inspect("products", "P"); assert.equal(p.price, 25); assert.equal(p.active, false); assert.equal(p.sellable, false); assert.equal(p.stock, 10); assert.equal(p.sku, "SKU-P"); assert.equal(p.barcode, "123"); assert.equal(p.imageUrl, "https://example.test/p.jpg"); assert.deepEqual(p.collections, ["Back to School"]);
  assert.equal((await (await bulk(req(body))).json()).duplicate, true); assert.equal((await store.collection("admin_audit").get()).docs.length, 1);
});
test("stale bulk preview and unsupported stock/identity edits save nothing", async () => {
  const store = setup(), preview = await (await bulk(req({ ...changes, mode: "preview" }))).json(); await store.collection("products").doc("P").update({ stock: 9 });
  assert.equal((await bulk(req({ ...changes, mode: "apply", previewHash: preview.previewHash, requestId }))).status, 409); assert.equal(store.inspect("products", "P").price, 20); assert.equal((await store.collection("admin_audit").get()).docs.length, 0);
  for (const patch of [{ stock: 0 }, { sku: "X" }, { price: -1 }]) assert.equal((await bulk(req({ ...changes, patch, mode: "preview" }))).status, 400);
  assert.equal((await bulk(req({ ...changes, mode: "preview" }, "supervisor"))).status, 403); assert.equal((await bulk(req({ ...changes, mode: "preview" }, "cashier"))).status, 403);
});
test("bulk reclassification requires the complete variant group; quote-price clearing retains quote intent", async () => {
  const store = setup(); await store.collection("products").doc("P").update({ productGroupId: "g" }); await store.collection("products").doc("Q").update({ productGroupId: "g" });
  assert.equal((await bulk(req({ ...changes, patch: { categoryId: "d" }, mode: "preview" }))).status, 400);
  const request = { ids: ["P", "Q"], patch: { categoryId: "d", subcategoryId: "", subSubcategoryId: "" }, reason: "Move complete group" };
  const preview = await (await bulk(req({ ...request, mode: "preview" }))).json(); assert.equal((await bulk(req({ ...request, mode: "apply", previewHash: preview.previewHash, requestId }))).status, 200); assert.equal(store.inspect("products", "P").productGroupId, "g"); assert.equal(store.inspect("products", "Q").contactForPrice, true);
});
test("a racing product write rejects the whole batch, including Audit", async () => {
  const store = setup(), preview = await (await bulk(req({ ...changes, mode: "preview" }))).json(), base = store.batch.bind(store);
  store.batch = () => { const batch = base(), commit = batch.commit.bind(batch); batch.commit = async () => { await store.collection("products").doc("P").update({ stock: 8 }); await commit(); }; return batch; };
  assert.equal((await bulk(req({ ...changes, mode: "apply", previewHash: preview.previewHash, requestId }))).status, 409); assert.equal(store.inspect("products", "P").price, 20); assert.equal((await store.collection("admin_audit").get()).docs.length, 0);
});
test("personal saved views cannot read or edit another staff account's view; removal archives", async () => {
  const store = setup(); const result = await (await saveView(req({ name: "Missing photos", filters: { readiness: "photo" } }, "owner", "product-views"))).json(); assert.ok(result.id);
  assert.equal((await (await views(get("admin", "product-views"))).json()).views.length, 0);
  assert.equal((await saveView(req({ id: result.id, name: "Stolen", filters: {} }, "admin", "product-views"))).status, 404);
  assert.equal((await saveView(req({ id: result.id, name: "Missing photos", filters: {}, archived: true }, "owner", "product-views"))).status, 200); assert.equal(store.inspect("admin_product_views", result.id).archived, true); assert.equal((await (await views(get("owner", "product-views"))).json()).views.length, 0);
  assert.equal((await views(get("supervisor", "product-views"))).status, 403);
});
test("inbox counts exact pending statuses; supervisor receives orders only and private photos are not returned", async () => {
  setup(); const owner = await (await attention(get())).json(); assert.deepEqual(owner.queues.map((v) => v.count), [1,1,1,1]); assert.equal(Date.parse(owner.queues[3].oldestAt), Date.parse("2026-10-11T12:00:00.000Z")); assert.equal(owner.queues[2].records[0].imageCount, 1); assert.equal(JSON.stringify(owner).includes("private-photo"), false);
  const supervisor = await (await attention(get("supervisor"))).json(); assert.deepEqual(supervisor.queues.map((v) => v.section), ["Orders"]); assert.equal((await attention(get("cashier"))).status, 403); assert.equal((await attention(new Request("http://test/api/admin/attention"))).status, 401);
});
test("product editor revision rejects stale saves without changing product data", async () => {
  const store = setup(); const p = store.inspect("products", "P"); await store.collection("products").doc("P").update({ stock: 9 });
  const result = await saveProduct(req({ ...p, expectedVersion: "-1", create: false, price: 40 })); assert.equal(result.status, 409); assert.equal(store.inspect("products", "P").price, 20); assert.equal(store.inspect("products", "P").stock, 9);
});
test("focused inbox links load an older exact record and enforce the existing permissions", async () => {
  const store = setup(), id = "123e4567-e89b-42d3-a456-426614174000", reviewId = "a".repeat(64);
  await store.collection("inquiries").doc(id).set({ reference: "OLD-INQ", name: "Demo", status: "new", createdAt: "2020-01-01", message: "Older request" });
  await store.collection("product_requests").doc(id).set({ reference: "OLD-REQ", name: "Demo", status: "new", createdAt: "2020-01-01" });
  await store.collection("product_reviews").doc(reviewId).set({ publicName: "Demo", rating: 3, text: "Older review", status: "pending", createdAt: "2020-01-01", updatedAt: "2020-01-01", revision: 2 });
  for (let i = 0; i < 110; i++) await store.collection("inquiries").doc(`recent-${i}`).set({ status: "resolved", createdAt: "2026-10-12" });
  const request = (path, focus, role = "owner") => new Request(`http://test/api/admin/${path}?id=${focus}`, { headers: { authorization: `Bearer ${role}` } });
  assert.equal((await (await inquiryRecord(request("inquiries", id))).json()).inquiries[0].reference, "OLD-INQ");
  assert.equal((await (await sourcingRecord(request("product-requests", id))).json()).requests[0].reference, "OLD-REQ");
  assert.equal((await (await reviewRecord(request("reviews", reviewId))).json()).reviews[0].text, "Older review");
  assert.equal((await inquiryRecord(request("inquiries", id, "supervisor"))).status, 403);
  assert.equal((await reviewRecord(request("reviews", "invalid"))).status, 400);
});
test("saved-view retry does not duplicate the view or its audit history", async () => {
  const store = setup(), value = { id: requestId, name: "Quote products", filters: { readiness: "quote" } };
  assert.equal((await saveView(req(value, "owner", "product-views"))).status, 200);
  assert.equal((await (await saveView(req(value, "owner", "product-views"))).json()).duplicate, true);
  assert.equal((await store.collection("admin_audit").get()).docs.length, 1);
});
test("catalogue revision metadata is read-only and supervisor data excludes profit, costs and private queues", async () => {
  const store = setup(); await store.collection("products").doc("P").update({ costPrice: 5, wholesalePackPrice: 50 });
  const owner = await (await catalog(get("owner", "catalog"))).json(); assert.equal(owner.metrics.quoteProducts, 1); assert.equal(owner.metrics.needsPricing, 0); assert.ok(owner.products[0].editVersion);
  const supervisor = await (await catalog(get("supervisor", "catalog"))).json(); assert.equal(supervisor.metrics.profit, undefined); assert.equal(supervisor.products.find((p) => p.id === "P").costPrice, undefined); assert.equal(supervisor.products.find((p) => p.id === "P").wholesalePackPrice, undefined); assert.deepEqual(supervisor.audit, []);
  assert.equal(store.inspect("products", "P").editVersion, undefined);
});

test("retired SKUs disappear from Admin and storefront but retain immutable history and component inventory", async () => {
  const store = setup(), old = { id: "OLD", sku: "ERA-COL-002", name: "Retired eraser", categoryId: "c", price: 20, costPrice: 5, stock: 0, active: true, catalogueRetirement: { replacements: ["SKU-P"] }, wholesale: { enabled: true, unitPrice: 10, minQty: 1, increment: 1 } };
  await store.collection("products").doc("OLD").create(old);
  await store.collection("products").doc("LOOSE").create({ ...old, id: "LOOSE", sku: "LOOSE", catalogueRetirement: null, stock: 4, retailUnit: { unit: "individual", contents: 1, role: "component" } });
  const owner = await (await catalog(get("owner", "catalog"))).json();
  assert.equal(owner.products.some(p => p.id === "OLD"), false);
  assert.equal(owner.products.some(p => p.id === "LOOSE"), true);
  assert.equal(owner.metrics.products, 2); assert.equal(owner.metrics.outOfStock, 0);
  const storefront = await (await publicCatalogue()).json();
  assert.equal(storefront.products.some(p => ["OLD", "LOOSE"].includes(p.id)), false);
  assert.equal(storefront.wholesaleProducts.some(p => ["OLD", "LOOSE"].includes(p.id)), false);
  assert.deepEqual(store.inspect("products", "OLD"), old);
  assert.equal(store.inspect("products", "LOOSE").stock, 4);
});
