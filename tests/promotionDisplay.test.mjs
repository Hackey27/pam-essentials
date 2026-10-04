import test from "node:test";
import assert from "node:assert/strict";
import { isPromotion, promotionPrice } from "../lib/catalogueBrowse.mjs";
import { priceCart } from "../lib/cartPricing.mjs";
import { activeRule } from "../lib/discount.mjs";

test("active product promotion appears on storefront and POS at the same price used for checkout", () => {
  const product = { id: "PAM-3D-PENCIL-CASE", name: "3D pencil case", categoryId: "CAT-WRITING", price: 40, quantity: 1 };
  const rule = { ruleId: "PROMO-3D", kind: "promotion", scopeType: "PRODUCT", scopeId: product.id, discountType: "PERCENT", value: 20, minQty: 1, active: true };
  assert.equal(isPromotion(product, [rule]), true);
  assert.equal(promotionPrice(product, [rule]), 32);
  assert.equal(priceCart([product], [rule]).total, 32);
  assert.equal(isPromotion({ ...product, id: "OTHER" }, [rule]), false);
  assert.equal(promotionPrice(product, [{ ...rule, active: false }]), null);
});

test("a promotion ending 04/10 remains active through that calendar day", () => {
  const rule = { active: true, startDate: "2026-10-01T00:00:00.000Z", endDate: "2026-10-04T00:00:00.000Z" };
  assert.equal(activeRule(rule, new Date("2026-10-04T18:00:00.000Z")), true);
  assert.equal(activeRule(rule, new Date("2026-10-05T00:00:00.000Z")), false);
  assert.equal(activeRule({ ...rule, endDate: "2026-10-04T14:30:00.000Z" }, new Date("2026-10-04T15:00:00.000Z")), false);
});

test("Bottles & Accessories category promotion covers its products and not another category", () => {
  const now = new Date("2026-10-04T12:00:00Z");
  const rule = { ruleId: "promo", kind: "promotion", scopeType: "CATEGORY", scopeId: "bottles-accessories", discountType: "PERCENT", value: 10, minQty: 1, active: true, startDate: "2026-10-01T00:00:00Z", endDate: "2026-10-04T00:00:00Z" };
  const bottle = { id: "PAM-WB-001", categoryId: "bottles-accessories", price: 50, quantity: 1 };
  const pencil = { id: "PAM-PN-001", categoryId: "writing-materials", price: 50, quantity: 1 };
  assert.equal(activeRule(rule, now), true);
  assert.equal(priceCart([bottle], [rule], [], now).total, 45);
  assert.equal(priceCart([pencil], [rule], [], now).total, 50);
});
