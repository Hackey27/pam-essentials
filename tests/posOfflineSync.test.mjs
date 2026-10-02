import test from "node:test";
import assert from "node:assert/strict";
import { memoryFirestore } from "./fixtures/memoryFirestore.mjs";
import { POST } from "../app/api/pos/sales/route.js";
import { offlineReceiptId } from "../lib/offlineSale.mjs";

const id = "123e4567-e89b-42d3-a456-426614174000";
const post = (body) => new Request("http://localhost:8080/api/pos/sales", { method: "POST", headers: { authorization: "Bearer cashier", "content-type": "application/json" }, body: JSON.stringify(body) });

test("finalized offline sale preserves receipt ID, syncs once and exposes conflicts", async () => {
  globalThis.__pamTestUsers = new Map([["cashier", { uid: "cashier", role: "cashier" }]]);
  const store = memoryFirestore({
    users: { cashier: { role: "cashier", active: true } },
    categories: { school: { name: "School", active: true } }, subcategories: {}, sub_subcategories: {},
    discount_rules: {}, deal_bundles: {}, settings: {},
    products: { A: { id: "A", name: "Pen", categoryId: "school", category: "School", price: 10, stock: 5, active: true } },
    shifts: { S1: { shiftId: "S1", staffId: "cashier", status: "open" } },
    sales: {}, stock_movements: {}, receipt_sequences: {},
  });
  globalThis.__pamTestStore = store;
  const payload = { transactionId: id, offlineFinal: true, offlineTotal: 20, shiftId: "S1", deviceId: "TILL", salesChannel: "phone", paymentMethod: "cash", amountPaid: 20, items: [{ id: "A", quantity: 2 }] };
  const first = await POST(post(payload));
  assert.equal(first.status, 200);
  assert.equal((await first.json()).receiptId, offlineReceiptId(id));
  assert.equal(store.inspect("products", "A").stock, 3);
  const duplicate = await POST(post(payload));
  assert.equal((await duplicate.json()).duplicate, true);
  assert.equal(store.inspect("products", "A").stock, 3);
  const changedTotal = await POST(post({ ...payload, transactionId: "123e4567-e89b-42d3-a456-426614174001", offlineTotal: 1 }));
  assert.equal(changedTotal.status, 409);
  assert.equal(store.inspect("products", "A").stock, 3);
});
