import test from "node:test";
import assert from "node:assert/strict";
import { memoryFirestore } from "./fixtures/memoryFirestore.mjs";
import { POST as send } from "../app/api/inquiries/route.js";
import { GET as list, POST as update } from "../app/api/admin/inquiries/route.js";
import { POST as order } from "../app/api/orders/route.js";
import { GET as catalogue } from "../app/api/catalog/products/route.js";
import { GET as pos } from "../app/api/pos/products/route.js";
import { POST as wishlist } from "../app/api/customer/wishlist/route.js";
import { POST as catalogueImport } from "../app/api/admin/catalogue-import/route.js";
import { POST as saveProduct } from "../app/api/admin/products/route.js";

const request = (path, body, token, headers = {}) => new Request(`http://test${path}`, { method: body ? "POST" : "GET", headers: { ...headers, ...(body ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
const body = (id = "47bbd9b4-380d-4123-8bb2-2be59d168a91") => ({ requestId: id, productId: "rack", name: "Ada", phone: "0207015198", quantity: 2, measurements: "180 cm high", message: "Please provide a quote.", status: "resolved", productName: "spoofed" });
function setup() {
  globalThis.__pamTestAuth = undefined;
  globalThis.__pamTestUsers = new Map([["owner", { uid: "owner", role: "owner" }], ["cashier", { uid: "cashier", role: "cashier" }], ["customer", { uid: "customer", email: "customer@example.test" }]]);
  const store = memoryFirestore({ users: { owner: { role: "owner" }, cashier: { role: "cashier" } }, categories: { home: { categoryId: "home", name: "Home", active: true } }, products: { rack: { id: "rack", sku: "RACK-1", name: "Storage rack", categoryId: "home", category: "Home", price: null, contactForPrice: true, stock: 5, active: true, cardPreviewImagePath: "", variantOptions: { height: "180 cm" } }, hidden: { id: "hidden", name: "Unpriced", categoryId: "home", price: null, stock: 3, active: true }, fixed: { id: "fixed", name: "Priced", categoryId: "home", price: 50, stock: 3, active: true } }, inquiries: {}, orders: {}, customer_accounts: {}, deal_bundles: { unsafe: { active: true, productIds: ["rack", "fixed"], finalPrice: 40 } }, settings: { PAM_DEALS_ACTIVE: { value: true } } });
  const original = store.collection.bind(store);
  store.collection = (name) => {
    const collection = original(name);
    if (name !== "inquiries") return collection;
    const query = (cursor = null, limit = 101) => ({ limit: (n) => query(cursor, n), startAfter: (snap) => query(snap.id, limit), async get() { const docs = (await collection.get()).docs.sort((a, b) => String(b.data().createdAt).localeCompare(String(a.data().createdAt))); const start = cursor ? docs.findIndex((doc) => doc.id === cursor) + 1 : 0; return { docs: docs.slice(start, start + limit) }; } });
    return { ...collection, orderBy: () => query() };
  };
  globalThis.__pamTestStore = store; return store;
}
test("quote catalogue visibility is separate from sale eligibility; wishlist accepts quote products only with customer sign-in", async () => {
  setup();
  const publicData = await (await catalogue()).json(); assert.deepEqual(publicData.products.map((p) => p.id).sort(), ["fixed", "rack"]); assert.equal(publicData.products.find((p) => p.id === "rack").contactForPrice, true); assert.deepEqual(publicData.dealBundles, []);
  const posData = await (await pos(request("/api/pos/products", null, "cashier"))).json(); assert.deepEqual(posData.products.map((p) => p.id), ["fixed"]);
  assert.equal((await order(request("/api/orders", { customer: "Ada", phone: "0207015198", items: [{ id: "rack", quantity: 1 }] }))).status, 409);
  assert.equal((await wishlist(request("/api/customer/wishlist", { productId: "rack" }))).status, 401);
  assert.equal((await wishlist(request("/api/customer/wishlist", { productId: "rack" }, "customer"))).status, 200);
});
test("guest submission trusts saved product identity, acknowledges only committed data, prevents duplicate sends and rate limits", async () => {
  const store = setup();
  const submitted = await send(request("/api/inquiries", body())); assert.equal(submitted.status, 200);
  const reply = await submitted.json(); assert.match(reply.reference, /^PAM-INQ-/); assert.match(reply.message, /received/);
  const saved = store.inspect("inquiries", body().requestId); assert.equal(saved.productName, "Storage rack"); assert.equal(saved.sku, "RACK-1"); assert.equal(saved.status, "new"); assert.equal(saved.measurements, "180 cm high");
  assert.equal((await (await send(request("/api/inquiries", body()))).json()).duplicate, true);
  assert.equal((await send(request("/api/inquiries", { ...body(), message: "Changed" }))).status, 409);
  for (let i = 1; i < 5; i++) assert.equal((await send(request("/api/inquiries", body(`47bbd9b4-380d-4123-8bb2-2be59d168a9${i + 1}`)))).status, 200);
  assert.equal((await send(request("/api/inquiries", body("47bbd9b4-380d-4123-8bb2-2be59d168a99")))).status, 429);
  assert.equal((await store.collection("inquiries").get()).docs.length, 5);
  assert.equal((await store.collection("orders").get()).docs.length, 0); assert.equal(store.inspect("products", "rack").stock, 5);
});
test("invalid/disabled inquiries are rejected, cross-origin and large bodies blocked, database errors never acknowledge success", async () => {
  const store = setup();
  assert.equal((await send(request("/api/inquiries", { ...body(), productId: "hidden" }))).status, 409);
  await store.collection("products").doc("rack").update({ active: false });
  assert.equal((await send(request("/api/inquiries", body()))).status, 409);
  assert.equal((await send(request("/api/inquiries", { ...body(), message: "" }))).status, 400);
  assert.equal((await send(request("/api/inquiries", body(), null, { origin: "https://elsewhere.test" }))).status, 403);
  assert.equal((await send(request("/api/inquiries", { ...body(), excess: "a".repeat(20000) }))).status, 400);
  setup().runTransaction = async () => { throw new Error("secret internal failure"); };
  const failure = await send(request("/api/inquiries", body())); assert.equal(failure.status, 503); assert.doesNotMatch(JSON.stringify(await failure.json()), /secret internal/);
});
test("HTTPS storefront origins are accepted behind Cloud Run's internal HTTP request URL", async () => {
  setup();
  const response = await send(request("/api/inquiries", body(), null, { origin: "https://pam.example.test", host: "pam.example.test" }));
  assert.equal(response.status, 200);
  assert.equal((await send(request("/api/inquiries", body(), null, { origin: "https://unrelated.example.test", host: "pam.example.test" }))).status, 403);
});
test("Admin inquiry list and audited updates are role-protected, field-limited and paginated", async () => {
  const store = setup(); await send(request("/api/inquiries", body()));
  assert.equal((await list(request("/api/admin/inquiries"))).status, 401);
  for (const token of ["cashier", "customer"]) { assert.equal((await list(request("/api/admin/inquiries", null, token))).status, 403); assert.equal((await update(request("/api/admin/inquiries", { id: body().requestId, status: "resolved", internalNotes: "Done" }, token))).status, 403); }
  const response = await list(request("/api/admin/inquiries", null, "owner")); assert.match(response.headers.get("cache-control"), /no-store/);
  const data = await response.json(); assert.equal(data.inquiries[0].requestHash, undefined); assert.equal(data.inquiries[0].message, body().message);
  assert.equal((await update(request("/api/admin/inquiries", { id: body().requestId, status: "in-progress", internalNotes: "Called customer", productName: "changed" }, "owner"))).status, 200);
  assert.equal(store.inspect("inquiries", body().requestId).productName, "Storage rack"); assert.equal(store.inspect("inquiries", body().requestId).status, "in-progress");
  assert.equal((await store.collection("admin_audit").get()).docs[0].data().action, "UPDATE_INQUIRY");
  assert.equal((await update(request("/api/admin/inquiries", { id: body().requestId, status: "unknown", internalNotes: "" }, "owner"))).status, 400);
  for (let i = 0; i < 105; i++) await store.collection("inquiries").doc(`00000000-0000-4000-8000-${String(i).padStart(12, "0")}`).create({ createdAt: String(i).padStart(5, "0"), name: "Test", reference: `TEST-${i}` });
  const page = await (await list(request("/api/admin/inquiries", null, "owner"))).json(); assert.equal(page.inquiries.length, 100); assert.ok(page.nextCursor);
  const next = await (await list(request(`/api/admin/inquiries?cursor=${page.nextCursor}`, null, "owner"))).json(); assert.equal(next.inquiries.length, 6); assert.equal(next.nextCursor, null);
});
test("Admin checkbox can be enabled, preserved when omitted, and disabled without changing stock or SKU", async () => {
  const store = setup(), base = store.inspect("products", "rack");
  assert.equal((await saveProduct(request("/api/admin/products", { ...base, contactForPrice: true }, "owner"))).status, 200);
  const { contactForPrice, ...omitted } = base;
  assert.equal((await saveProduct(request("/api/admin/products", omitted, "owner"))).status, 200); assert.equal(store.inspect("products", "rack").contactForPrice, true);
  assert.equal((await saveProduct(request("/api/admin/products", { ...base, contactForPrice: false }, "owner"))).status, 200);
  assert.equal(store.inspect("products", "rack").contactForPrice, false); assert.equal(store.inspect("products", "rack").stock, 5); assert.equal(store.inspect("products", "rack").sku, "RACK-1");
});


test("CSV blank quote price applies atomically and Audit records the cleared price, preserving images/stock/SKU", async () => {
  const store = setup(); await store.collection("products").doc("rack").update({ price: 150, sellable: true, galleryImagePaths: ["existing-image"] });
  const details = { fileName: "update.csv", csv: "SKU,PRICE\nRACK-1,", mode: "preview" };
  const previewResponse = await catalogueImport(request("/api/admin/catalogue-import", details, "owner")); assert.equal(previewResponse.status, 200);
  const preview = await previewResponse.json(); assert.ok(preview.rows[0].changes.some((change) => change.field === "price" && change.after === null));
  const applied = await catalogueImport(request("/api/admin/catalogue-import", { ...details, mode: "apply", previewHash: preview.previewHash, requestId: "47bbd9b4-380d-4123-8bb2-2be59d168a91" }, "owner")); assert.equal(applied.status, 200);
  const product = store.inspect("products", "rack"); assert.equal(product.price, null); assert.equal(product.stock, 5); assert.equal(product.sku, "RACK-1"); assert.deepEqual(product.galleryImagePaths, ["existing-image"]);
  const audit = (await store.collection("admin_audit").get()).docs.find((doc) => doc.data().action === "IMPORT_CATALOGUE_CSV"); assert.equal(audit.data().newValue.products[0].priceBefore, 150); assert.equal(audit.data().newValue.products[0].priceAfter, null);
});
