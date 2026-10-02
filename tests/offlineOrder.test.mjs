import test from "node:test";
import assert from "node:assert/strict";
import { applyPendingOrderActions } from "../lib/offlineOrder.mjs";

test("cached order shows locally finalized confirmations and completion until sync", () => {
  const orders = [{ orderId: "O1", status: "processing", items: [{ productId: "A", quantity: 2 }] }];
  const actions = [{ orderId: "O1", action: "confirm-fulfilment-line", lineIndex: 0, confirmedQuantity: 2 }, { orderId: "O1", status: "completed" }];
  const result = applyPendingOrderActions(orders, actions);
  assert.deepEqual(result[0].fulfilmentCounts, [2]);
  assert.equal(result[0].status, "completed");
  assert.equal(result[0].localUnsynced, true);
  assert.equal(orders[0].status, "processing");
});
