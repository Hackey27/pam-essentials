import test from "node:test";
import assert from "node:assert/strict";
import { adminScanConflict, barcodeOwner, createScanGate, planPosScan, planScannedProduct } from "../lib/scannerWorkflow.mjs";

const bottle = { id: "B1", name: "Pink Bottle", sku: "SKU-PINK", price: 35, stock: 3, barcode: "111", variantOptions: { colour: "Pink", size: "500ml" } };
const pencil = { id: "P1", name: "Pencil Case", sku: "SKU-CASE", price: 20, stock: 5, barcodeEntries: [{ code: "222", archived: false }, { code: "OLD", archived: true }] };

test("Admin names the owning product and catches own, pending and archived duplicates", () => {
  assert.equal(adminScanConflict(bottle, [bottle, pencil], " 222 "), "This barcode is already assigned to Pencil Case.");
  assert.equal(adminScanConflict(bottle, [bottle, pencil], "111"), "Already scanned for this product.");
  assert.equal(adminScanConflict(bottle, [bottle, pencil], "QR-New", ["qr-new"]), "Already scanned for this product.");
  assert.equal(adminScanConflict(bottle, [bottle, pencil], "old"), "This barcode is already assigned to Pencil Case.");
  assert.equal(adminScanConflict(bottle, [bottle, pencil], "new-code"), "");
  assert.equal(barcodeOwner([bottle, pencil], "sku-case").id, "P1");
});

test("camera gate ignores repeated frames but accepts a removed and re-presented code", () => {
  let time = 0;
  const gate = createScanGate(() => time);
  assert.equal(gate("111"), true);
  time = 100;
  assert.equal(gate("111"), false);
  assert.equal(gate(""), false);
  time = 350;
  assert.equal(gate("111"), false);
  assert.equal(gate(""), false);
  time = 1100;
  assert.equal(gate("111"), true);
  assert.equal(gate("222"), true);
  assert.equal(gate("111"), true);
});

test("POS first scan adds exact variant; the second asks before increasing", () => {
  const first = planPosScan([bottle, pencil], [], "111");
  assert.equal(first.type, "add");
  assert.equal(first.product.sku, "SKU-PINK");
  assert.deepEqual(first.product.variantOptions, { colour: "Pink", size: "500ml" });
  const cart = [{ ...bottle, quantity: 1 }];
  const second = planPosScan([bottle, pencil], cart, "111");
  assert.equal(second.type, "increase");
  assert.equal(second.quantity, 1);
  assert.equal(cart[0].quantity, 1);
});

test("POS scan and manual selection recheck current availability and stock caps", () => {
  assert.match(planScannedProduct({ ...bottle, stock: 0 }, []).message, /out of stock/);
  assert.match(planScannedProduct({ ...bottle, active: false }, []).message, /not available/);
  assert.match(planScannedProduct({ ...bottle, stock: 1 }, [{ ...bottle, quantity: 1 }]).message, /No more stock/);
  assert.equal(planScannedProduct(pencil, []).type, "add");
  assert.match(planPosScan([bottle], [], "unknown").message, /Use Search/);
  assert.equal(planPosScan([bottle, { ...pencil, barcode: "111" }], [], "111").type, "add");
  assert.equal(planPosScan([bottle, { ...pencil, barcodeEntries: [{ code: "111" }] }], [], "111").type, "choices");
});
