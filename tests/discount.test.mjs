import assert from "node:assert/strict";
import test from "node:test";
import { resolveDiscount } from "../lib/discount.mjs";

const product = { id: "A", categoryId: "C", price: 20 };
const bulk = { ruleId: "DISC001", scopeType: "GLOBAL", discountType: "PERCENT", value: 5, minQty: 3, active: true };

test("global 5% quantity rule qualifies each product independently", () => {
  assert.equal(resolveDiscount(product, 1, [bulk]).amount, 0);
  assert.equal(resolveDiscount(product, 2, [bulk]).amount, 0);
  assert.equal(resolveDiscount(product, 3, [bulk]).amount, 3);
  assert.equal(resolveDiscount({ ...product, id: "B" }, 2, [bulk]).amount, 0);
});

test("admin deactivation and specific rule priority are honored", () => {
  assert.equal(resolveDiscount(product, 3, [{ ...bulk, active: false }]).amount, 0);
  assert.equal(resolveDiscount(product, 3, [{ ...bulk, archived: true }]).amount, 0);
  const specific = { ruleId: "A10", scopeType: "PRODUCT", scopeId: "A", discountType: "PERCENT", value: 10, minQty: 1, active: true };
  assert.equal(resolveDiscount(product, 1, [bulk, specific]).amount, 2);
});

test("promotion wins over an eligible bulk rule without stacking", () => {
  const promotion = { ruleId: "PROMO", kind: "promotion", scopeType: "PRODUCT", scopeId: "A", discountType: "PERCENT", value: 10, minQty: 1, active: true };
  assert.deepEqual(resolveDiscount(product, 3, [bulk, promotion]).rule, promotion);
  assert.equal(resolveDiscount(product, 3, [bulk, promotion]).amount, 6);
});

test("scheduled rules switch at the configured minute", () => {
  const timed = { ...bulk, minQty: 1, startDate: "2026-09-27T10:30:00.000Z", endDate: "2026-09-27T12:15:00.000Z" };
  assert.equal(resolveDiscount(product, 1, [timed], new Date("2026-09-27T10:29:00.000Z")).amount, 0);
  assert.equal(resolveDiscount(product, 1, [timed], new Date("2026-09-27T10:30:00.000Z")).amount, 1);
  assert.equal(resolveDiscount(product, 1, [timed], new Date("2026-09-27T12:16:00.000Z")).amount, 0);
});

