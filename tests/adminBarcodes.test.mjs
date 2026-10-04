import test from "node:test";
import assert from "node:assert/strict";
import { memoryFirestore } from "./fixtures/memoryFirestore.mjs";
import { POST } from "../app/api/admin/products/route.js";

const post = (body) => new Request("http://localhost:8080/api/admin/products", { method: "POST", headers: { authorization: "Bearer owner", "content-type": "application/json" }, body: JSON.stringify(body) });
const base = { id: "P1", name: "Bottle", categoryId: "Bottles", sku: "SKU-1", price: 10, active: true, barcode: "111" };

function setup() {
  globalThis.__pamTestUsers = new Map([["owner", { uid: "owner", email: "owner@example.com", role: "owner" }]]);
  const store = memoryFirestore({ users: { owner: { role: "owner", active: true } }, products: { P1: base, P2: { id: "P2", name: "Cup", sku: "SKU-2", barcode: "999" } }, categories: { Bottles: { name: "Bottles" } }, admin_audit: {} });
  globalThis.__pamTestStore = store;
  return store;
}

test("Admin adds and archives codes without deleting the legacy barcode record", async () => {
  const store = setup();
  const added = await POST(post({ ...base, create: false, barcodeAdditions: "222, 333", archiveBarcodes: [], multipleBarcodes: true }));
  assert.equal(added.status, 200);
  assert.deepEqual(store.inspect("products", "P1").barcodeEntries.map((entry) => entry.code), ["111", "222", "333"]);
  const archived = await POST(post({ ...base, create: false, barcodeAdditions: "", archiveBarcodes: ["111"], multipleBarcodes: true, barcode: "" }));
  assert.equal(archived.status, 200);
  assert.equal(store.inspect("products", "P1").barcode, "222");
  assert.equal(store.inspect("products", "P1").barcodeEntries[0].archived, true);
  assert.equal(store.inspect("products", "P1").barcodeEntries[0].sku, "SKU-1");
  assert.equal(store.inspect("barcode_registry", "111").archived, true);
  assert.equal(store.inspect("barcode_registry", "222").sku, "SKU-1");
  assert.ok(store.inspect("admin_audit", "test-auto-2"));
});

test("Admin refuses another product's barcode, including archived history", async () => {
  const store = setup();
  assert.equal((await POST(post({ ...base, create: false, barcodeAdditions: "999", multipleBarcodes: true }))).status, 409);
  assert.equal(store.inspect("products", "P1").barcode, "111");
  assert.equal((await POST(post({ ...base, create: false, barcodeAdditions: "SKU-2", multipleBarcodes: true }))).status, 409);
});

test("archived barcode remains reserved even after its product record is absent", async () => {
  const store = setup();
  await store.collection("barcode_registry").doc("old-code").create({ code: "old-code", productId: "REMOVED", archived: true });
  const response = await POST(post({ ...base, create: false, barcodeAdditions: "old-code", multipleBarcodes: true }));
  assert.equal(response.status, 409);
  assert.equal(store.inspect("products", "P1").barcode, "111");
});
