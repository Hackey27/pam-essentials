import test from "node:test";
import assert from "node:assert/strict";
import { fulfilmentComplete, fulfilmentCounts, matchingOrderLine } from "../lib/fulfilment.mjs";

test("each order line requires its full counted quantity", () => {
  const order = { items: [{ productId: "A", quantity: 2 }, { productId: "B", quantity: 1 }], fulfilmentCounts: [2, 0] };
  assert.deepEqual(fulfilmentCounts(order), [2, 0]);
  assert.equal(fulfilmentComplete(order), false);
  assert.equal(fulfilmentComplete({ ...order, fulfilmentCounts: [2, 1] }), true);
  assert.equal(fulfilmentComplete({ ...order, fulfilmentCounts: [99, 1] }), true);
  assert.equal(fulfilmentComplete({ items: [] }), false);
});

test("order scan matches a SKU or catalogue barcode but not unrelated codes", () => {
  const order = { items: [{ productId: "A", sku: "SKU-A", quantity: 2 }] };
  assert.equal(matchingOrderLine(order, "sku-a"), 0);
  assert.equal(matchingOrderLine(order, "12345", [{ id: "A", barcode: "12345" }]), 0);
  assert.equal(matchingOrderLine(order, "other"), -1);
});
