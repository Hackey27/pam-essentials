import test from "node:test";
import assert from "node:assert/strict";
import { publicProduct } from "../lib/productData.js";
import { POST } from "../app/api/admin/catalogue-import/route.js";
import { memoryFirestore } from "./fixtures/memoryFirestore.mjs";
const post = (body, role = "owner") => new Request("http://test/api/admin/catalogue-import", { method: "POST", headers: { authorization: `Bearer ${role}`, "content-type": "application/json" }, body: JSON.stringify(body) });
function setup() {
  globalThis.__pamTestUsers = new Map([["owner", { uid: "owner", role: "owner" }], ["cashier", { uid: "cashier", role: "cashier" }]]);
  globalThis.__pamTestStore = memoryFirestore({ users: { owner: { role: "owner" }, cashier: { role: "cashier" } }, products: { ID1: { id: "ID1", sku: "SKU1", name: "Old", price: 10, stock: 9, active: true, archived: false, sellable: true, categoryId: "c", category: "School", cardPreviewImagePath: "products/original/card-preview/photo.png", barcode: "123", productGroupId: "G" } }, categories: { c: { name: "School", sortOrder: 7, active: true } }, subcategories: {}, sub_subcategories: {}, catalogue_imports: {}, admin_audit: {} });
  return globalThis.__pamTestStore;
}
const file = { fileName: "products.csv", csv: "SKU,NAME,PRICE,CATEGORY\nSKU1,Renamed,12.50,School\nNEW,New pen,5,School" };
const requestId = "123e4567-e89b-42d3-a456-426614174000";
test("preview is read-only; apply preserves images/stock/IDs and repeat submission is idempotent", async () => {
  const store = setup(); const previewResponse = await POST(post({ ...file, mode: "preview" })); assert.equal(previewResponse.status, 200); const preview = await previewResponse.json();
  assert.equal(store.inspect("products", "ID1").name, "Old");
  const body = { ...file, mode: "apply", previewHash: preview.previewHash, requestId };
  const applied = await POST(post(body)); assert.equal(applied.status, 200);
  const product = store.inspect("products", "ID1"); assert.equal(product.name, "Renamed"); assert.equal(product.stock, 9); assert.equal(product.cardPreviewImagePath, "products/original/card-preview/photo.png"); assert.equal(product.productGroupId, "G"); assert.equal(product.barcode, "123");
  assert.equal(store.inspect("products", "NEW").stock, 0); assert.equal(store.inspect("categories", "c").sortOrder, 7);
  assert.equal((await (await POST(post(body))).json()).duplicate, true); assert.equal((await store.collection("admin_audit").get()).docs.length, 1);
});
test("stale preview and invalid rows write nothing; non-admin cannot import", async () => {
  const store = setup(); const preview = await (await POST(post({ ...file, mode: "preview" }))).json();
  await store.collection("products").doc("ID1").update({ stock: 8 });
  const stale = await POST(post({ ...file, mode: "apply", previewHash: preview.previewHash, requestId })); assert.equal(stale.status, 409); assert.equal(store.inspect("products", "ID1").name, "Old"); assert.equal(store.inspect("products", "NEW"), undefined);
  assert.equal((await POST(post({ ...file, mode: "preview", csv: file.csv + "\nBROKEN,Product,-1,School" }))).status, 400);
  assert.equal((await POST(post({ ...file, mode: "preview" }, "cashier"))).status, 403);
  assert.equal((await store.collection("admin_audit").get()).docs.length, 0);
});


test("CSV Product Type applies as audited optional metadata without changing identity, stock or hierarchy", async () => {
  const store = setup();
  const typed = { fileName: "types.csv", csv: "SKU,PRODUCT_TYPE\nSKU1,Accessories", mode: "preview" };
  const response = await POST(post(typed)); assert.equal(response.status, 200);
  const preview = await response.json(); assert.equal(preview.rows[0].changes[0].field, "productType");
  assert.equal(store.inspect("products", "ID1").productType, undefined);
  const result = await POST(post({ ...typed, mode: "apply", previewHash: preview.previewHash, requestId })); assert.equal(result.status, 200);
  const saved = store.inspect("products", "ID1"); assert.equal(saved.productType, "Accessories"); assert.equal(saved.sku, "SKU1"); assert.equal(saved.categoryId, "c"); assert.equal(saved.stock, 9); assert.equal(saved.productGroupId, "G"); assert.equal(saved.cardPreviewImagePath, "products/original/card-preview/photo.png");
  assert.equal(publicProduct(saved).productType, "Accessories");
  const audit = (await store.collection("admin_audit").get()).docs[0].data(); assert.match(JSON.stringify(audit), /productType/);
});
