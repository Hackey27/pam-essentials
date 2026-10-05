import test from "node:test";
import assert from "node:assert/strict";
import { memoryFirestore } from "./fixtures/memoryFirestore.mjs";
import { POST } from "../app/api/admin/barcodes/check/route.js";

function setup() {
  globalThis.__pamTestUsers = new Map([["owner", { uid: "owner", role: "owner" }], ["cashier", { uid: "cashier", role: "cashier" }]]);
  const store = memoryFirestore({ users: { owner: { role: "owner" }, cashier: { role: "cashier" } }, products: { P1: { id: "P1", name: "Bottle", sku: "SKU-1", barcode: "111" } }, barcode_registry: { "222": { productId: "P1", sku: "SKU-1", archived: true }, "old": { productId: "Removed", sku: "OLD-SKU", archived: true } } });
  globalThis.__pamTestStore = store;
  return store;
}
const request = (code, token = "owner") => new Request("http://localhost/api/admin/barcodes/check", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ code }) });

test("authenticated barcode lookup names registry, legacy and reserved archived owners without writes", async () => {
  const store = setup();
  for (const code of ["111", "222", "sku-1"]) {
    const response = await POST(request(code));
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.assigned, true);
    assert.equal(result.name, "Bottle");
    assert.equal(result.productId, "P1");
  }
  assert.equal((await (await POST(request("old"))).json()).name, "OLD-SKU");
  assert.deepEqual(await (await POST(request("new"))).json(), { assigned: false });
  assert.equal(store.inspect("products", "P1").barcode, "111");
  assert.equal((await store.collection("admin_audit").get()).docs.length, 0);
});

test("barcode lookup validates codes and rejects cashier and anonymous access", async () => {
  setup();
  assert.equal((await POST(request("111", "cashier"))).status, 403);
  assert.equal((await POST(new Request("http://localhost/api/admin/barcodes/check", { method: "POST" }))).status, 401);
  for (const code of ["", "111,222", "x".repeat(101), 123]) assert.equal((await POST(request(code))).status, 400);
});
