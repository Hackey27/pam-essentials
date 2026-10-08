import test from "node:test";
import assert from "node:assert/strict";
import { matchesSearch } from "../lib/catalogueBrowse.mjs";
import { productSearchKeywords } from "../lib/productSearch.mjs";
import { publicProduct } from "../lib/productData.js";

test("a name word returns all matching products across categories", () => {
  const products = [{ name: "3D Pencil Case", category: "School" }, { name: "Cartoon pencil case", category: "Gifts" }, { name: "Water bottle", category: "Home" }];
  assert.deepEqual(products.filter((product) => matchesSearch(product, "PENCIL")).map((product) => product.name), ["3D Pencil Case", "Cartoon pencil case"]);
  assert.equal(matchesSearch(products[0], "3D-pencil"), true);
  assert.equal(matchesSearch(products[2], "pencil"), false);
});

test("legacy keyword strings and tag arrays reach public catalogue and suggestions", () => {
  const stored = { name: "Travel cup", keywords: "hydration, drinkware; reusable", tags: ["school supplies", "hydration"] };
  const original = structuredClone(stored);
  const product = publicProduct(stored);
  assert.deepEqual(product.keywords, ["hydration", "drinkware", "reusable", "school supplies"]);
  for (const term of ["hydration", "drinkware", "school supplies"]) assert.equal(matchesSearch(product, term), true);
  assert.equal(matchesSearch(product, "drinkware reusable"), true);
  assert.deepEqual(stored, original);
  assert.deepEqual(productSearchKeywords({ keywords: ["pen", "ink"], tags: "stationery" }), ["pen", "ink", "stationery"]);
});

test("existing SKU, variant and curated searches remain available", () => {
  assert.equal(matchesSearch({ sku: "PAM-WB001", variantOptions: { colour: "Rock gray" } }, "pam-wb001"), true);
  assert.equal(matchesSearch({ name: "Heat bottle", variantOptions: { colour: "Rock gray" } }, "rock gray"), true);
  assert.equal(matchesSearch({ name: "HB pencil", category: "Writing Materials & Accessories" }, "school supplies"), true);
  assert.equal(matchesSearch({ name: "Water bottle" }, "water bottles"), true);
  assert.equal(matchesSearch({ name: "Lunch box" }, "lunch boxes"), true);
});
