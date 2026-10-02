import test from "node:test";
import assert from "node:assert/strict";
import { memoryFirestore } from "./fixtures/memoryFirestore.mjs";
import { POST } from "../app/api/admin/orders/route.js";

const post = (body) => new Request("http://localhost:8080/api/admin/orders", { method: "POST", headers: { authorization: "Bearer owner", "content-type": "application/json" }, body: JSON.stringify(body) });

test("completion is blocked until every ordered quantity is confirmed", async () => {
  globalThis.__pamTestUsers = new Map([["owner", { uid: "owner", email: "owner@example.com", role: "owner" }]]);
  const store = memoryFirestore({ users: { owner: { role: "owner", active: true } }, orders: { O1: { orderId: "O1", status: "processing", paymentStatus: "paid", popularityCounted: true, items: [{ productId: "A", name: "Pen", quantity: 2 }, { productId: "B", name: "Book", quantity: 1 }] } }, admin_audit: {} });
  globalThis.__pamTestStore = store;
  const blocked = await POST(post({ orderId: "O1", status: "completed" }));
  assert.equal(blocked.status, 409);
  const actionId = "123e4567-e89b-42d3-a456-426614174000";
  const first = await POST(post({ orderId: "O1", action: "confirm-fulfilment-line", lineIndex: 0, confirmedQuantity: 2, actionId }));
  assert.equal(first.status, 200);
  assert.equal((await first.json()).fulfilmentComplete, false);
  assert.equal((await (await POST(post({ orderId: "O1", action: "confirm-fulfilment-line", lineIndex: 0, confirmedQuantity: 2, actionId }))).json()).duplicate, true);
  const second = await POST(post({ orderId: "O1", action: "confirm-fulfilment-line", lineIndex: 1, confirmedQuantity: 1 }));
  assert.equal((await second.json()).fulfilmentComplete, true);
  const completed = await POST(post({ orderId: "O1", status: "completed" }));
  assert.equal(completed.status, 200);
  assert.equal(store.inspect("orders", "O1").status, "completed");
});

test("fulfilment completion does not silently mark an unpaid order as paid", async () => {
  globalThis.__pamTestUsers = new Map([["owner", { uid: "owner", email: "owner@example.com", role: "owner" }]]);
  const store = memoryFirestore({ users: { owner: { role: "owner", active: true } }, orders: { O2: { orderId: "O2", status: "ready", paymentStatus: "pending", items: [{ productId: "A", name: "Pen", quantity: 1 }], fulfilmentCounts: [1] } }, admin_audit: {} });
  globalThis.__pamTestStore = store;
  const result = await POST(post({ orderId: "O2", status: "completed", confirmPayment: false }));
  assert.equal(result.status, 200);
  assert.equal(store.inspect("orders", "O2").paymentStatus, "pending");
});
