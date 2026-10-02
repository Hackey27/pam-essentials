import test from "node:test";
import assert from "node:assert/strict";
import { sortProducts } from "../lib/catalogueSort.mjs";
import { readCompare, toggleCompare } from "../lib/compare.mjs";
import { appliedOfferBadge, appliedOfferLabel, orderOfferLabel, quantityOfferMessage } from "../lib/quantityOffer.mjs";

const products = [
  { id: "B", name: "B item", category: "Home", categoryId: "home", price: 20, clickCount: 2, rating: 0, createdAt: "2026-09-01" },
  { id: "A", name: "A item", category: "School", categoryId: "school", price: 10, clickCount: 10, rating: 4, createdAt: "2026-10-01" },
];

test("catalogue sorting offers categories, price, popularity, rating, latest and promotions", () => {
  assert.deepEqual(sortProducts(products, "categories").map((item) => item.id), ["B", "A"]);
  assert.deepEqual(sortProducts(products, "price-low").map((item) => item.id), ["A", "B"]);
  assert.deepEqual(sortProducts(products, "popularity").map((item) => item.id), ["A", "B"]);
  assert.deepEqual(sortProducts(products, "rating").map((item) => item.id), ["A", "B"]);
  assert.deepEqual(sortProducts(products, "latest").map((item) => item.id), ["A", "B"]);
  assert.deepEqual(sortProducts(products, "promotions", [{ ruleId: "P", scopeType: "PRODUCT", scopeId: "A", kind: "promotion" }]).map((item) => item.id), ["A", "B"]);
});

test("comparison persists at most four distinct product IDs", () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) };
  for (const id of ["A", "B", "C", "D", "E"]) toggleCompare(storage, id);
  assert.deepEqual(readCompare(storage), ["A", "B", "C", "D"]);
  assert.deepEqual(toggleCompare(storage, "B"), ["A", "C", "D"]);
});

test("quantity offer follows the same per-product threshold as pricing", () => {
  const rule = { ruleId: "Q5", scopeType: "GLOBAL", discountType: "PERCENT", value: 5, minQty: 3, active: true };
  assert.match(quantityOfferMessage(products[0], 1, [rule]), /Add 2 more units.*5%/);
  assert.match(quantityOfferMessage(products[0], 2, [rule]), /Add 1 more unit.*5%/);
  assert.equal(quantityOfferMessage(products[0], 3, [rule]), "5% discount applied");
  assert.equal(quantityOfferMessage(products[0], 5, [rule]), "5% discount applied");
  assert.equal(quantityOfferMessage(products[0], 2, []), "");
});

test("applied discount labels work for POS lines and saved orders", () => {
  const line = { rule: { discountType: "PERCENT", value: 5 }, ruleDiscountCents: 150, dealDiscountCents: 0 };
  assert.equal(appliedOfferLabel(line), "5% discount applied");
  assert.equal(appliedOfferBadge(line), "−5%");
  assert.equal(orderOfferLabel({ quantity: 3, unitPrice: 10, lineTotal: 28.5, discountRuleSnapshot: { amount: 1.5 } }), "5% discount applied");
  assert.equal(orderOfferLabel({ quantity: 2, unitPrice: 10, lineTotal: 18, discountRuleSnapshot: { discountType: "PERCENT", value: 10, amount: 2 } }), "10% discount applied");
  assert.equal(orderOfferLabel({ quantity: 3, unitPrice: 10, lineTotal: 27, dealBundleSnapshot: { amount: 3 } }), "Deal applied");
});
