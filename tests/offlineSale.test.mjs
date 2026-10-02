import test from "node:test";
import assert from "node:assert/strict";
import { offlineReceiptId, offlineSaleReceipt } from "../lib/offlineSale.mjs";
import { formatReceiptText } from "../lib/receiptData.mjs";

test("offline sale has a stable unique receipt and captured final totals", () => {
  const id = "123e4567-e89b-42d3-a456-426614174000";
  const receipt = offlineSaleReceipt({ transactionId: id, cart: [{ id: "A", sku: "A", name: "Pen", price: 10, quantity: 3 }], pricing: { subtotal: 30, discount: 1.5, total: 28.5, lines: [{ id: "A", lineTotal: 28.5 }] }, shift: { shiftId: "S1" }, staffEmail: "cashier@example.com", paymentMethod: "cash", amountPaid: 30, salesChannel: "walk-in" });
  assert.equal(receipt.receiptId, offlineReceiptId(id));
  assert.equal(receipt.total, 28.5);
  assert.equal(receipt.change, 1.5);
  assert.equal(receipt.items[0].lineTotal, 28.5);
  assert.equal(receipt.syncPending, true);
  assert.match(formatReceiptText(receipt), /OFFLINE FINAL AT TILL - SYNC PENDING/);
  assert.ok(formatReceiptText(receipt).split("\n").every((line) => line.length <= 40));
});
