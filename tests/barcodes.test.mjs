import test from "node:test";
import assert from "node:assert/strict";
import { activeBarcodes, planBarcodes } from "../lib/barcodes.mjs";
import { matchingProducts } from "../lib/scanCode.mjs";
import { matchingOrderLine } from "../lib/fulfilment.mjs";

test("legacy barcode is retained and new codes share the SKU", () => {
  const original = { id: "P1", sku: "SKU-1", barcode: "111" };
  const result = planBarcodes(original, { additions: "222, 333", sku: "SKU-1", multiple: true });
  assert.deepEqual(result.entries.map((entry) => [entry.code, entry.sku]), [["111", "SKU-1"], ["222", "SKU-1"], ["333", "SKU-1"]]);
  assert.deepEqual(activeBarcodes({ ...original, barcodeEntries: result.entries }), ["111", "222", "333"]);
});

test("archiving preserves history and removes the code from scanning", () => {
  const original = { id: "P1", sku: "SKU-1", barcode: "111", barcodeEntries: [{ code: "111", sku: "SKU-1", archived: false }, { code: "222", sku: "SKU-1", archived: false }] };
  const result = planBarcodes(original, { archive: ["111"], sku: "SKU-1", multiple: true });
  const product = { ...original, barcode: result.barcode, barcodeEntries: result.entries };
  assert.equal(result.barcode, "222");
  assert.equal(result.entries[0].archived, true);
  assert.ok(result.entries[0].archivedAt);
  assert.deepEqual(matchingProducts([product], "111"), []);
  assert.deepEqual(matchingProducts([product], "222").map((item) => item.id), ["P1"]);
  assert.equal(matchingOrderLine({ items: [{ productId: "P1", quantity: 1 }] }, "222", [product]), 0);
  assert.equal(matchingOrderLine({ items: [{ productId: "P1", quantity: 1 }] }, "111", [product]), -1);
});

test("barcode operations reject duplicate codes and SKU reassignment without archival", () => {
  const product = { id: "P1", sku: "SKU-1", barcode: "111" };
  assert.match(planBarcodes(product, { additions: "222, 222", sku: "SKU-1", multiple: true }).error, /duplicates/i);
  assert.match(planBarcodes(product, { additions: "222", sku: "SKU-1" }).error, /Multiple barcodes/i);
  assert.match(planBarcodes(product, { sku: "SKU-2" }).error, /Archive active/i);
  assert.match(planBarcodes(product, { archive: ["999"], sku: "SKU-1" }).error, /Only assigned/i);
  assert.match(planBarcodes(product, { additions: "111", sku: "SKU-1", multiple: true }).error, /cannot be added again/i);
});


test("deletion removes exact codes from POS and fulfilment lookup without changing SKU or remaining codes", () => {
  const original = { id: "P1", sku: "SKU-1", barcodeEntries: [{ code: "111", sku: "SKU-1" }, { code: "222", sku: "SKU-1" }] };
  const result = planBarcodes(original, { deletions: [{ code: "111", reason: "Wrong label" }], sku: "SKU-1" });
  assert.equal(result.error, undefined);
  const product = { ...original, barcode: result.barcode, barcodeEntries: result.entries };
  assert.deepEqual(matchingProducts([product], "111"), []);
  assert.deepEqual(matchingProducts([product], "222").map((item) => item.id), ["P1"]);
  assert.equal(matchingOrderLine({ items: [{ productId: "P1", quantity: 1 }] }, "111", [product]), -1);
  assert.equal(result.deleted[0].reason, "Wrong label");
  assert.equal(original.barcodeEntries.length, 2);
  assert.match(planBarcodes(original, { deletions: [{ code: "111", reason: "Wrong label" }], archive: ["111"], sku: "SKU-1" }).error, /cannot be archived and deleted/);
  assert.match(planBarcodes(original, { deletions: [{ code: "111", reason: "Wrong label" }], additions: "111", sku: "SKU-1" }).error, /cannot be deleted and added/);
});
