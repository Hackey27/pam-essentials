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

test("bundle savings replace smaller overlapping quantity discount", () => {
  const bulk = { ruleId: "Q5", scopeType: "GLOBAL", discountType: "PERCENT", value: 5, minQty: 3, active: true };
  const priced = priceCart(products, [bulk], [deal]);
  assert.equal(priced.total, 130);
  assert.equal(priced.discount, 30);
  assert.equal(priceCart(products, [bulk], [{ ...deal, active: false }]).total, 152);
});

