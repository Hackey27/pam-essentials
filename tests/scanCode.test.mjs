import test from "node:test";
import assert from "node:assert/strict";
import { matchingProducts, normalizeCode } from "../lib/scanCode.mjs";

const products = [
  { id: "SKU-1", sku: "A-100", barcode: "1234567890123", qrCode: "QR-ONE" },
  { id: "SKU-2", sku: "B-200", productCode: "PROMO-2", barcode: "999" },
  { id: "SKU-3", sku: "A-100", barcode: "888" },
];

test("scanner accepts barcode, QR, SKU and product code without fuzzy matches", () => {
  assert.equal(normalizeCode("  qr-one \n"), "qr-one");
  assert.deepEqual(matchingProducts(products, "1234567890123").map((item) => item.id), ["SKU-1"]);
  assert.deepEqual(matchingProducts(products, "qr-one").map((item) => item.id), ["SKU-1"]);
  assert.deepEqual(matchingProducts(products, "promo-2").map((item) => item.id), ["SKU-2"]);
  assert.deepEqual(matchingProducts(products, "a-100").map((item) => item.id), ["SKU-1", "SKU-3"]);
  assert.deepEqual(matchingProducts(products, "unknown"), []);
});
