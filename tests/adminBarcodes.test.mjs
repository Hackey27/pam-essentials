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


test("barcode deletion requires a reason and leaves product, registry and audit unchanged on rejection", async () => {
  const store = setup();
  await store.collection("barcode_registry").doc("111").create({ productId: "P1", sku: "SKU-1" });
  for (const deleteBarcodes of [[{ code: "111", reason: " " }], [{ code: "111", reason: "x".repeat(1001) }], [{ code: "unassigned", reason: "Wrong label" }], "111"]) {
    assert.equal((await POST(post({ ...base, deleteBarcodes }))).status, 400);
    assert.equal(store.inspect("products", "P1").barcode, "111");
    assert.equal(store.inspect("barcode_registry", "111").productId, "P1");
  }
  assert.equal((await store.collection("admin_audit").get()).docs.length, 0);
});

test("deleting a legacy barcode unlinks its SKU, releases its reservation, and preserves sales with an audited reason", async () => {
  const store = setup();
  await store.collection("barcode_registry").doc("111").create({ code: "111", productId: "P1", sku: "SKU-1", archived: false });
  const pastSale = { items: [{ productId: "P1", sku: "SKU-1", quantity: 1, unitPrice: 10 }] };
  await store.collection("sales").doc("receipt-1").create(pastSale);
  const result = await POST(post({ ...base, deleteBarcodes: [{ code: "111", reason: "  Incorrect supplier label  " }] }));
  assert.equal(result.status, 200);
  assert.equal(store.inspect("products", "P1").barcode, "");
  assert.deepEqual(store.inspect("products", "P1").barcodeEntries, []);
  assert.equal(store.inspect("barcode_registry", "111"), undefined);
  assert.deepEqual(store.inspect("sales", "receipt-1"), pastSale);
  const deletion = (await store.collection("admin_audit").get()).docs.map((doc) => doc.data()).find((entry) => entry.action === "DELETE_BARCODE");
  assert.equal(deletion.admin, "owner");
  assert.equal(deletion.oldValue.sku, "SKU-1");
  assert.equal(deletion.newValue.reason, "Incorrect supplier label");
  assert.match(deletion.description, /111.*SKU-1.*Incorrect supplier label/);
  const reuse = await POST(post({ ...base, id: "P2", sku: "SKU-2", name: "Cup", barcodeAdditions: "111", multipleBarcodes: true }));
  assert.equal(reuse.status, 200);
  assert.equal(store.inspect("barcode_registry", "111").productId, "P2");
});

test("archived barcode can be deleted while remaining codes still scan", async () => {
  const store = setup();
  await POST(post({ ...base, barcodeAdditions: "222", archiveBarcodes: ["111"] }));
  const response = await POST(post({ ...base, deleteBarcodes: [{ code: "111", reason: "Retired label" }] }));
  assert.equal(response.status, 200);
  const product = store.inspect("products", "P1");
  assert.equal(product.barcode, "222");
  assert.deepEqual(product.barcodeEntries.map((entry) => entry.code), ["222"]);
  assert.equal(store.inspect("barcode_registry", "111"), undefined);
  assert.equal(store.inspect("barcode_registry", "222").productId, "P1");
});

test("barcode deletion never removes a registration owned by another SKU", async () => {
  const store = setup();
  await store.collection("barcode_registry").doc("111").create({ productId: "P2", sku: "SKU-2" });
  assert.equal((await POST(post({ ...base, deleteBarcodes: [{ code: "111", reason: "Incorrect code" }] }))).status, 409);
  assert.equal(store.inspect("barcode_registry", "111").productId, "P2");
  assert.equal(store.inspect("products", "P1").barcode, "111");
});

test("concurrent product edit cancels deletion and audit atomically", async () => {
  const store = setup();
  await store.collection("barcode_registry").doc("111").create({ productId: "P1", sku: "SKU-1" });
  const originalBatch = store.batch.bind(store);
  store.batch = () => {
    const batch = originalBatch();
    const commit = batch.commit.bind(batch);
    batch.commit = async () => { await store.collection("products").doc("P1").update({ description: "Another admin edit" }); await commit(); };
    return batch;
  };
  const result = await POST(post({ ...base, deleteBarcodes: [{ code: "111", reason: "Wrong label" }] }));
  assert.equal(result.status, 409);
  assert.equal(store.inspect("products", "P1").barcode, "111");
  assert.equal(store.inspect("products", "P1").description, "Another admin edit");
  assert.equal(store.inspect("barcode_registry", "111").productId, "P1");
  assert.equal((await store.collection("admin_audit").get()).docs.length, 0);
});
