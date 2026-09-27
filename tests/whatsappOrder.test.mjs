import test from "node:test";
import assert from "node:assert/strict";
import { whatsappOrderMessage } from "../lib/whatsappOrder.mjs";

test("WhatsApp order uses server-priced variant lines and totals", () => {
  const message = whatsappOrderMessage({
    orderId: "ORD-ABC-123", subtotal: 90, discount: 4.5, total: 85.5,
    deliveryMethod: "delivery-self", originAddress: "PAM, Awoshie", deliveryAddress: "Customer address",
    items: [{ name: "Cartoon Water Bottle", sku: "PAM-WB001-PNK-500", colour: "Pink", size: "500ml", quantity: 2, unitPrice: 45, lineTotal: 85.5 }],
  }, "Ada", "+233207015198");
  assert.match(message, /Colour: Pink\nSize: 500ml\nSKU: PAM-WB001-PNK-500\nQty: 2/);
  assert.match(message, /Subtotal: GH₵90\.00\nDiscount: GH₵4\.50\nTotal: GH₵85\.50/);
  assert.match(message, /Shop collection address: PAM, Awoshie\nDelivery destination: Customer address/);
});

