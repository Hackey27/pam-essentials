import test from "node:test";
import assert from "node:assert/strict";
import { publicProduct } from "../lib/productData.js";
import { randomSelectionNote } from "../lib/randomSelection.mjs";

test("public random-shape flags keep ordinary products and old records unchanged", () => {
  const ordinary = publicProduct({ id: "A", name: "Bottle", price: 35, stock: 4 });
  assert.equal(ordinary.randomShapes, false);
  assert.equal(randomSelectionNote(ordinary), "");
  for (const flags of [{ randomShapes: true }, { randomColours: true }, { randomShapes: true, randomColours: true }]) {
    const product = publicProduct({ id: "A", name: "Bottle", price: 35, stock: 4, ...flags });
    assert.equal(randomSelectionNote(product), "Random colours or shapes unless you indicate a choice in notes.");
    assert.equal(product.price, 35);
    assert.equal(product.stock, 4);
  }
});
