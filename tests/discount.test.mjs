import assert from "node:assert/strict";
import test from "node:test";
import { resolveDiscount } from "../lib/discount.mjs";

const product = { id: "A", categoryId: "C", price: 20 };
const bulk = { ruleId: "DISC001", scopeType: "GLOBAL", discountType: "PERCENT", value: 5, minQty: 3, active: true };

test("global 5% rule uses total cart units across products", () => {
  assert.equal(resolveDiscount(product, 1, [bulk], new Date(), 2).amount, 0);
  assert.equal(resolveDiscount(product, 1, [bulk], new Date(), 3).amount, 1);
  assert.equal(resolveDiscount({ ...product, id: "B" }, 2, [bulk], new Date(), 3).amount, 2);
});

test("admin deactivation and specific rule priority are honored", () => {
  assert.equal(resolveDiscount(product, 3, [{ ...bulk, active: false }], new Date(), 3).amount, 0);
  const specific = { ruleId: "A10", scopeType: "PRODUCT", scopeId: "A", discountType: "PERCENT", value: 10, minQty: 1, active: true };
  assert.equal(resolveDiscount(product, 1, [bulk, specific], new Date(), 3).amount, 2);
});

test("scheduled rules switch at the configured minute", () => {
  const timed = { ...bulk, minQty: 1, startDate: "2026-09-27T10:30:00.000Z", endDate: "2026-09-27T12:15:00.000Z" };
  assert.equal(resolveDiscount(product, 1, [timed], new Date("2026-09-27T10:29:00.000Z")).amount, 0);
  assert.equal(resolveDiscount(product, 1, [timed], new Date("2026-09-27T10:30:00.000Z")).amount, 1);
  assert.equal(resolveDiscount(product, 1, [timed], new Date("2026-09-27T12:16:00.000Z")).amount, 0);
});

