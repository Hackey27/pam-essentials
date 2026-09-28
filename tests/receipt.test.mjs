import test from "node:test";
import assert from "node:assert/strict";
import { formatReceiptText, receiptSnapshot } from "../lib/receiptData.mjs";

test("80 mm receipt preserves exact variant and saved tender totals without cost fields", () => {
  const sale = receiptSnapshot({ receiptId: "PAM-260928-0042", createdAt: "2026-09-28T20:57:00.000Z", staffEmail: "Gloria", salesChannel: "walk-in", paymentMethod: "mobile-money", subtotal: 130, discount: 2.5, total: 127.5, amountPaid: 130, change: 2.5, cost: 80, profit: 47.5, items: [{ name: "Insulated Bottle", sku: "PAM-WB001-PNK-750", variantId: "PAM-WB001-PNK-750", colour: "Pink", size: "750ml", quantity: 1, unitPrice: 65, lineTotal: 65, lineCost: 40 }] });
  const text = formatReceiptText(sale);
  assert.match(text, /PAM-260928-0042/);
  assert.match(text, /Pink \/ 750ml/);
  assert.match(text, /PAM-WB001-PNK-750/);
  assert.match(text, /GH₵127\.50/);
  assert.match(text, /Mobile Money/);
  assert.match(text, /Goods sold are NOT returnable/);
  assert.equal("cost" in sale, false);
  assert.equal("lineCost" in sale.items[0], false);
});

