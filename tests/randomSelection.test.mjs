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
    const expected = flags.randomColours && flags.randomShapes ? "colours or shapes" : flags.randomColours ? "colours" : "shapes";
    assert.equal(randomSelectionNote(product), `Random ${expected} unless you indicate a choice in notes.`);
    assert.equal(product.price, 35);
    assert.equal(product.stock, 4);
  }
});

test("random sizes are additive and nonblank order notes suppress the cart notice", () => {
  const product = publicProduct({ id: "A", name: "Bottle", randomSizes: true, randomColours: true, randomShapes: true });
  assert.equal(product.randomSizes, true);
  assert.equal(randomSelectionNote(product), "Random colours, sizes or shapes unless you indicate a choice in notes.");
  assert.equal(randomSelectionNote(product, "  Please choose green  "), "");
  assert.notEqual(randomSelectionNote(product, "   "), "");
  assert.equal(randomSelectionNote({ randomSizes: true }), "Random sizes unless you indicate a choice in notes.");
});
