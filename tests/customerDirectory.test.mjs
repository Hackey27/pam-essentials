import test from "node:test";
import assert from "node:assert/strict";
import { customerContact, customerCsv, wishlistSummary } from "../lib/customerDirectory.mjs";

test("wishlist rankings count unique saves, exclude staff and do not mutate stored arrays", () => {
  const accounts = [{ id: "a", wishlist: ["p1", "p1", "p2", null] }, { id: "b", wishlist: ["p1", "gone"] }, { id: "staff", wishlist: ["p2"] }, { id: "c", wishlist: null }];
  const before = JSON.stringify(accounts);
  assert.deepEqual(wishlistSummary(accounts, new Set(["staff"])), { customers: 2, savedItems: 4, products: [{ productId: "p1", count: 2 }, { productId: "gone", count: 1 }, { productId: "p2", count: 1 }] });
  assert.equal(JSON.stringify(accounts), before);
  assert.equal(wishlistSummary([{ id: "a", wishlist: ["p2"] }]).savedItems, 1);
});
test("directory exposes contact fields only; missing preferences are never inferred from an account", () => {
  const customer = customerContact({ uid: "a", email: "a@example.test", displayName: "Ada", passwordHash: "secret", customClaims: { private: "secret" }, metadata: { creationTime: "2026-10-11" } }, { wishlist: ["p1", "p1"] });
  assert.equal(customer.name, "Ada"); assert.equal(customer.wishlistCount, 1);
  assert.equal(customer.marketingEmail, false); assert.equal(customer.marketingPhone, false);
  assert.equal(customer.passwordHash, undefined); assert.equal(customer.customClaims, undefined);
  assert.equal(customerContact({ uid: "a" }, { name: "Chosen", phone: "0207015198", marketingPhone: true }).phone, "0207015198");
});
test("CSV quotes names and protects formula content, preferences remain explicit", () => {
  const csv = customerCsv([{ name: '=HYPERLINK("bad")', email: "a@example.test", phone: "+233207015198", marketingEmail: true, marketingPhone: false, wishlistCount: 2 }]);
  assert.match(csv, /"'=HYPERLINK\(""bad""\)"/); assert.match(csv, /"'\+233207015198"/); assert.match(csv, /"Yes","No"/); assert.match(csv, /Email promotions opted in/);
});
