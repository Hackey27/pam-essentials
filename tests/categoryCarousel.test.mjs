import test from "node:test";
import assert from "node:assert/strict";
import { carouselCategories, CATEGORY_HOLD_MS, PHOTO_HOLD_MS } from "../lib/categoryCarousel.mjs";
import { groupProductsByType } from "../lib/productTypes.mjs";
import { sortProducts } from "../lib/catalogueSort.mjs";

const categories = [{ categoryId: "b", name: "Bottles", sortOrder: 2 }, { categoryId: "w", name: "Writing", sortOrder: 1 }];
const subs = [{ subcategoryId: "pen", categoryId: "w", name: "Pens", sortOrder: 2 }, { subcategoryId: "pencil", categoryId: "w", name: "Pencils", sortOrder: 1 }, { subcategoryId: "b-pen", categoryId: "b", name: "Pens", sortOrder: 1 }];
const products = [{ id: "p1", name: "Zulu pen", categoryId: "w", category: "Writing", subcategoryId: "pen", subcategory: "Pens", imageUrl: "https://example.com/pen.jpg" }, { id: "p2", name: "Alpha pen", categoryId: "w", category: "Writing", subcategoryId: "pen", subcategory: "Pens", imageUrl: "https://example.com/pen.jpg" }, { id: "c", name: "Pencil", categoryId: "w", category: "Writing", subcategoryId: "pencil", subcategory: "Pencils" }, { id: "f", name: "Folder", categoryId: "w", category: "Writing" }, { id: "b", name: "Bottle", categoryId: "b", category: "Bottles", subcategoryId: "b-pen", subcategory: "Pens" }];

test("carousel follows Admin order, skips inactive/empty categories and deduplicates existing photos", () => {
  const before = JSON.stringify({ categories, products });
  const result = carouselCategories([...categories, { categoryId: "e", name: "Empty", sortOrder: 0 }, { categoryId: "x", name: "Hidden", active: false }], products);
  assert.deepEqual(result.map((item) => item.id), ["w", "b"]);
  assert.equal(result[0].count, 4);
  assert.equal(result[0].photos.length, 1);
  assert.equal(result[0].photos[0].url, products[0].imageUrl);
  assert.equal(result[1].photos.length, 0);
  assert.equal(JSON.stringify({ categories, products }), before);
  assert.equal(CATEGORY_HOLD_MS, 6000);
  assert.equal(PHOTO_HOLD_MS, 2000);
});

test("Product Type completes each Admin-ordered subcategory row alphabetically, then category fallback", () => {
  const sorted = sortProducts(products, "types", [], categories, subs);
  assert.deepEqual(sorted.map((item) => item.id), ["c", "p2", "p1", "f", "b"]);
  const groups = groupProductsByType(sorted, subs);
  assert.deepEqual(groups.map((item) => item.name), ["Pencils", "Pens", "Writing", "Pens"]);
  assert.notEqual(groups[1].key, groups[3].key);
  assert.equal(groups[1].products[0], products[1]);
  assert.deepEqual(groups.flatMap((item) => item.products), sorted);
  subs[0].sortOrder = 0;
  assert.deepEqual(sortProducts(products, "types", [], categories, subs).slice(0, 3).map((item) => item.id), ["p2", "p1", "c"]);
  subs[0].sortOrder = 2;
});

test("type grouping resolves names for ID-only products and repeats a heading for paginated continuations", () => {
  const item = { id: "id-only", name: "Pen", categoryId: "w", category: "Writing", subcategoryId: "pen" };
  const groups = groupProductsByType([item], subs);
  assert.equal(groups[0].name, "Pens");
  assert.equal(groups[0].products[0].id, "id-only");
  assert.deepEqual(sortProducts([{ ...item, name: "Alpha pen" }, products[0]], "types", [], categories, subs).map((p) => p.id), ["id-only", "p1"]);
  assert.equal(groupProductsByType([products[0]], subs)[0].name, "Pens");
});


test("explicit CSV Product Type overrides allocations without moving hierarchy; same names share a complete row", () => {
  const marked = [{ ...products[0], name: "Alpha custom", productType: "Accessories" }, { ...products[1], name: "Zulu custom", productType: "accessories" }, { ...products[2], productType: "Pens" }, products[3]];
  const original = JSON.stringify(marked);
  const sorted = sortProducts(marked, "types", [], categories, subs);
  assert.deepEqual(sorted.map((p) => p.id), ["c", "p1", "p2", "f"]);
  assert.deepEqual(groupProductsByType(sorted, subs).map((g) => [g.name, g.products.length]), [["Pens", 1], ["Accessories", 2], ["Writing", 1]]);
  assert.equal(marked[2].subcategoryId, "pencil");
  assert.equal(JSON.stringify(marked), original);
  assert.equal(groupProductsByType([{ ...products[0], productType: "Pens" }, products[1]], subs).length, 1);
});


test("a named category type and automatic category fallback remain one alphabetical group", () => {
  const mixed = [{ ...products[0], productType: "Writing", name: "Alpha item" }, { ...products[3], name: "Zulu item" }, { ...products[1], productType: "Accessories" }];
  const sorted = sortProducts(mixed, "types", [], categories, subs);
  const groups = groupProductsByType(sorted, subs);
  assert.deepEqual(groups.map((group) => group.name), ["Accessories", "Writing"]);
  assert.deepEqual(groups[1].products.map((product) => product.name), ["Alpha item", "Zulu item"]);
  assert.deepEqual(groups.flatMap((group) => group.products), sorted);
});
