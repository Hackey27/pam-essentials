import assert from "node:assert/strict";
import test from "node:test";
import { catalogueContext, resolveDiscount } from "../lib/commerce.js";
import { memoryFirestore } from "./fixtures/memoryFirestore.mjs";

test("catalogue includes active dated promotions and excludes expired rules", async () => {
  const now = Date.now();
  const store = memoryFirestore({
    categories: { "bottles-accessories": { name: "Bottles & Accessories", active: true } },
    subcategories: {}, sub_subcategories: {}, deal_bundles: {}, settings: {},
    discount_rules: {
      PROMO: { name: "Promo", kind: "promotion", scopeType: "CATEGORY", scopeId: "bottles-accessories", discountType: "PERCENT", value: 15, minQty: 1, startDate: new Date(now - 3600000), endDate: new Date(now + 3600000), active: true },
      OLD: { name: "Old", scopeType: "GLOBAL", discountType: "PERCENT", value: 5, minQty: 1, endDate: new Date(now - 86400000), active: true },
    },
  });
  const context = await catalogueContext(store);
  assert.deepEqual(context.rules.map((rule) => rule.ruleId), ["PROMO"]);
  assert.equal(resolveDiscount({ id: "BOTTLE", categoryId: "bottles-accessories", price: 40 }, 1, context.rules).amount, 6);
});
