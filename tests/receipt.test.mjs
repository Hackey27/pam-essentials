import test from "node:test";
import assert from "node:assert/strict";
import { formatReceiptText, receiptSnapshot } from "../lib/receiptData.mjs";

test("80 mm receipt preserves exact variant and saved tender totals without cost fields", () => {
  const sale = receiptSnapshot({ receiptId: "PAM-260928-0042", createdAt: "2026-09-28T20:57:00.000Z", staffEmail: "gloria@example.com", staffName: "Gloria", salesChannel: "walk-in", paymentMethod: "mobile-money", subtotal: 130, discount: 2.5, total: 127.5, amountPaid: 130, change: 2.5, cost: 80, profit: 47.5, items: [{ name: "Insulated Bottle", sku: "PAM-WB001-PNK-750", variantId: "PAM-WB001-PNK-750", colour: "Pink", size: "750ml", quantity: 1, unitPrice: 65, lineTotal: 65, lineCost: 40 }] });
  const text = formatReceiptText(sale);
  assert.match(text, /PAM-260928-0042/);
  assert.match(text, /Pink \/ 750ml/);
  assert.doesNotMatch(text, /PAM-WB001-PNK-750|SKU:/);
  assert.match(text, /GH₵127\.50/);
  assert.match(text, /Mobile Money/);
  assert.match(text, /Goods sold are NOT returnable/);
  assert.match(text, /Cashier: Gloria/);
  assert.match(text, /Discount:\s+GH₵2\.50/);
  assert.match(text, /Your Trusted Neighbourhood Mall/);
  assert.match(text, /Atlas Station - Awoshie, Accra/);
  assert.match(text, /Tel: 0596 661 439/);
  assert.match(text, /Customer Type: Walk-In/);
  assert.ok(text.split("\n").every((line) => line.length <= 40));
  assert.equal("cost" in sale, false);
  assert.equal("lineCost" in sale.items[0], false);
});

test("receipt omits zero discount and wraps long item data within four columns", () => {
  const text = formatReceiptText({ staffName: "Ama", discount: 0, items: [{ name: "Extra Long Cartoon Pencil Case", sku: "PAM-VERY-LONG-PENCIL-CASE-SKU", quantity: 12, unitPrice: 123456.78, lineTotal: 1481481.36 }] });
  assert.doesNotMatch(text, /Discount:/);
  assert.match(text, /Extra Long\s*\nCartoon Pencil\s*\nCase\s+12\s+123456\.78\s+1481481\.36/);
  assert.doesNotMatch(text, /PAM-VERY-LONG|SKU:/);
  assert.ok(text.split("\n").every((line) => line.length <= 40));
});

test("receipt keeps long pickup and customer details within 80 mm paper", () => {
  const text = formatReceiptText({ salesChannel: "website", customerName: "An exceptionally long customer name for pickup", orderReference: "PAM-ONLINE-2026-VERY-LONG-REFERENCE", fulfilmentSnapshot: { deliveryMethod: "delivery-self", originAddress: "Atlas Bus Station, 37 Atankpa Tettey Street, Awoshie, Accra" } });
  assert.match(text, /Shop address: Atlas Bus Station/);
  assert.match(text, /Awoshie, Accra/);
  assert.ok(text.split("\n").every((line) => line.length <= 40));
});
