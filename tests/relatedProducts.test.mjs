import test from "node:test";
import assert from "node:assert/strict";
import { relatedCategoryProducts, centredCarouselPosition } from "../lib/relatedProducts.mjs";

test("all other public category products are retained, including sibling variants and quote products", () => {
  const current = { id: "a", name: "Bottle black", categoryId: "b", subcategoryId: "water", productGroupId: "bottles" };
  const products = [current, ...Array.from({ length: 20 }, (_, i) => ({ id: String(i), name: "Bottle " + String(i).padStart(2,"0"), categoryId: "b", subcategoryId: "water", productGroupId: "bottles" })),
    { id: "quote", name: "Quote bottle", categoryId: "b", contactForPrice: true },
    { id: "other", name: "Pen", categoryId: "p" },
    { id: "hidden", name: "Hidden", categoryId: "b", active: false }];
  const before = JSON.stringify(products);
  const related = relatedCategoryProducts(current, products);
  assert.equal(related.length, 21);
  assert.equal(related[0].id, "0");
  assert.equal(related.at(-1).id, "quote");
  assert.equal(JSON.stringify(products), before);
});

test("legacy category names match without mixing distinct category IDs or unclassified products", () => {
  const product = { id: "a", name: "A", categoryId: "c", category: "Bottles", subcategoryId: "s" };
  const items = [
    { id: "x", name: "Zulu", category: " bottles ", subcategoryId: "s" },
    { id: "y", name: "Alpha", categoryId: "c", subcategoryId: "s" },
    { id: "z", name: "Other group", categoryId: "different", category: "Bottles" },
    { id: "n", name: "No category" }
  ];
  assert.deepEqual(relatedCategoryProducts(product, items).map(p => p.id), ["y","x"]);
  assert.deepEqual(relatedCategoryProducts(null, items), []);
  assert.deepEqual(relatedCategoryProducts({id:"blank"}, items), []);
});

test("loop recentering preserves the exact visible product offset in either scroll direction", () => {
  for (const left of [0, 5, 599, 600, 1200, 1390, -10]) {
    const next = centredCarouselPosition(left, 600);
    assert.ok(next >= 600 && next < 1200);
    assert.equal(((next - left) % 600 + 600) % 600, 0);
  }
  assert.equal(centredCarouselPosition(123, 0), 0);
  assert.equal(centredCarouselPosition(Infinity, 600), 0);
});
