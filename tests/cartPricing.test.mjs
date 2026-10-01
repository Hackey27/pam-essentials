import test from "node:test";
import assert from "node:assert/strict";
import { priceCart } from "../lib/cartPricing.mjs";

const products = [
  { id: "BOTTLE-PINK-500", categoryId: "bottles", price: 35, quantity: 2 },
  { id: "BOX-BLUE", categoryId: "lunch", price: 45, quantity: 2 },
];
const deal = { dealId: "DEAL-SCHOOL", productIds: ["BOTTLE-PINK-500", "BOX-BLUE"], finalPrice: 65, active: true };

test("PAM Deal prices exact SKU combinations and repeats without changing product quantities", () => {
  const priced = priceCart(products, [], [deal]);
  assert.equal(priced.subtotal, 160);
  assert.equal(priced.discount, 30);
  assert.equal(priced.total, 130);
  assert.equal(priced.lines.reduce((sum, line) => sum + line.lineTotal, 0), 130);
  assert.deepEqual(priced.lines.map((line) => line.quantity), [2, 2]);
  assert.equal(priceCart([{ ...products[0], quantity: 1 }, products[1]], [], [deal]).total, 110);
  assert.equal(priceCart([products[0]], [], [deal]).discount, 0);
});

test("mixed products never combine to earn the per-product 5% discount", () => {
  const bulk = { ruleId: "Q5", scopeType: "GLOBAL", discountType: "PERCENT", value: 5, minQty: 3, active: true };
  assert.equal(priceCart(products, [bulk], []).discount, 0);
  const eligible = priceCart([{ ...products[0], quantity: 3 }, products[1]], [bulk], []);
  assert.equal(eligible.discount, 5.25);
  assert.equal(eligible.lines[1].ruleDiscountCents, 0);
  const bothEligible = priceCart(products.map((product) => ({ ...product, quantity: 3 })), [bulk], []);
  assert.equal(bothEligible.discount, 12);
});

test("bundle units override quantity discounts rather than stacking", () => {
  const bulk = { ruleId: "Q5", scopeType: "GLOBAL", discountType: "PERCENT", value: 5, minQty: 3, active: true };
  const priced = priceCart(products, [bulk], [deal]);
  assert.equal(priced.total, 130);
  assert.equal(priced.discount, 30);
  assert.equal(priceCart(products, [bulk], [{ ...deal, active: false }]).total, 160);
  const remainder = priceCart([{ ...products[0], quantity: 4 }, { ...products[1], quantity: 1 }], [bulk], [deal]);
  assert.equal(remainder.discount, 15);
  assert.equal(remainder.total, 170);
  assert.equal(remainder.lines[0].ruleDiscountCents, 0);
});

