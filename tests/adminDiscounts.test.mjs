import test from "node:test";
import assert from "node:assert/strict";
import { memoryFirestore } from "./fixtures/memoryFirestore.mjs";
import { POST as saveDiscount } from "../app/api/admin/discounts/route.js";
import { POST as saveDeal } from "../app/api/admin/deals/route.js";
import { POST as saveSetting } from "../app/api/admin/settings/route.js";

const post = (path, body) => new Request(`http://localhost:8080${path}`, {
  method: "POST", headers: { authorization: "Bearer owner", "content-type": "application/json" }, body: JSON.stringify(body),
});
const result = async (response) => ({ status: response.status, body: await response.json() });
const product = (id, categoryId) => ({ id, categoryId, active: true, price: 10 });

function setup() {
  globalThis.__pamTestUsers = new Map([["owner", { uid: "owner", role: "owner" }]]);
  globalThis.__pamTestStore = memoryFirestore({
    users: { owner: { role: "owner", active: true } },
    products: { A: product("A", "school"), B: product("B", "school") },
    categories: { school: { name: "School" } },
    discount_rules: { BULK: { ruleId: "BULK", name: "Bulk 5%", scopeType: "GLOBAL", discountType: "PERCENT", value: 5, minQty: 3, active: true } },
    deal_bundles: {}, admin_audit: {}, settings: {},
  });
  return globalThis.__pamTestStore;
}

test("admin must acknowledge an overlapping promotion; archived rules stay inactive", async () => {
  const store = setup();
  const promotion = { create: true, ruleId: "PROMO", name: "School promo", kind: "promotion", scopeType: "CATEGORY", scopeId: "school", discountType: "PERCENT", value: 10, minQty: 1, active: true };
  const blocked = await result(await saveDiscount(post("/api/admin/discounts", promotion)));
  assert.equal(blocked.status, 409);
  assert.deepEqual(blocked.body.overlaps.map(({ id }) => id), ["BULK"]);
  assert.equal(store.inspect("discount_rules", "PROMO"), undefined);

  const saved = await result(await saveDiscount(post("/api/admin/discounts", { ...promotion, acknowledgeOverlap: true })));
  assert.equal(saved.status, 200);
  assert.equal(store.inspect("discount_rules", "PROMO").kind, "promotion");

  const archived = await result(await saveDiscount(post("/api/admin/discounts", { ...promotion, create: false, archived: true, active: true })));
  assert.equal(archived.status, 200);
  assert.equal(store.inspect("discount_rules", "PROMO").active, false);
  assert.equal(store.inspect("discount_rules", "PROMO").archived, true);
});

test("admin bundle warns on discount overlap, and stacking cannot be enabled", async () => {
  const store = setup();
  const deal = { create: true, dealId: "DEAL", name: "A and B", productIds: ["A", "B"], finalPrice: 17, active: true };
  const blocked = await result(await saveDeal(post("/api/admin/deals", deal)));
  assert.equal(blocked.status, 409);
  assert.deepEqual(blocked.body.overlaps.map(({ id }) => id), ["BULK"]);
  assert.equal((await result(await saveDeal(post("/api/admin/deals", { ...deal, acknowledgeOverlap: true })))).status, 200);
  assert.equal(store.inspect("deal_bundles", "DEAL").archived, false);
  assert.equal((await result(await saveDeal(post("/api/admin/deals", { ...deal, create: false, archived: true })))).status, 200);
  assert.equal(store.inspect("deal_bundles", "DEAL").active, false);
  assert.equal((await result(await saveSetting(post("/api/admin/settings", { key: "DISCOUNT_STACKING", value: true })))).status, 409);
});
