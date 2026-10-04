import test from "node:test";
import assert from "node:assert/strict";
import { productOptions, selectVariant, variantDetail, variantTitles } from "../lib/variantDisplay.mjs";
import { matchesSearch } from "../lib/catalogueBrowse.mjs";

const variants = [
  { id: "black-500", stock: 3, price: 35, variantTitles: [{ title: "Colour" }, { title: "Size" }], variantOptions: { colour: "Black", size: "500ml" } },
  { id: "white-500", stock: 0, price: 40, variantOptions: { colour: "White", size: "500ml" } },
  { id: "white-700", stock: 2, price: 45, variantOptions: { colour: "White", size: "700ml" } },
];

test("dynamic titles preserve exact option values and stocked sibling selection", () => {
  assert.deepEqual(variantTitles(variants), [{ title: "Colour", key: "colour" }, { title: "Size", key: "size" }]);
  assert.equal(variantDetail(variants[2], variantTitles(variants)), "White / 700ml");
  assert.equal(selectVariant(variants, variants[0], "colour", "White", true), null);
  assert.equal(selectVariant(variants, variants[0], "size", "700ml")?.id, "white-700");
  assert.deepEqual(productOptions({ colour: "Pink", size: "500ml", variantOptions: { finish: "Matte" } }), { finish: "Matte", colour: "Pink", size: "500ml" });
  assert.equal(matchesSearch({ name: "Bottle", variantOptions: { finish: "Matte" } }, "matte"), true);
});
