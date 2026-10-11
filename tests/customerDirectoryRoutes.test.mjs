import test from "node:test";
import assert from "node:assert/strict";
import { memoryFirestore } from "./fixtures/memoryFirestore.mjs";
import { GET as directory } from "../app/api/admin/customers/route.js";
import { GET as profile, POST as saveProfile } from "../app/api/customer/profile/route.js";
const request = (path, token, body) => new Request(`http://test${path}`, { method: body ? "POST" : "GET", headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { "content-type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
function setup() {
  const tokens = new Map([["owner", { uid: "owner", role: "owner" }], ["cashier", { uid: "cashier", role: "cashier" }], ["a", { uid: "a", email: "a@example.test" }], ["b", { uid: "b", email: "b@example.test" }]]);
  globalThis.__pamTestAuth = {
    async verifyIdToken(token) { const user = tokens.get(token); if (!user) throw new Error("Invalid"); return user; },
    async listUsers(limit, pageToken) { assert.equal(limit, 1000); return pageToken ? { users: [{ uid: "b", email: "b@example.test" }] } : { users: [{ uid: "owner", email: "private@staff.test" }, { uid: "claim-staff", customClaims: { role: "cashier" } }, { uid: "a", email: "a@example.test", passwordHash: "secret", emailVerified: true }], pageToken: "second" }; },
  };
  globalThis.__pamTestStore = memoryFirestore({ users: { owner: { role: "owner" }, cashier: { role: "cashier" } }, customer_accounts: { a: { name: "Ada", phone: "0207015198", wishlist: ["p1", "p1"], marketingPhone: true }, owner: { wishlist: ["p1"] } } });
  return globalThis.__pamTestStore;
}
test("directory is admin-only, includes accounts without profile records, paginates, excludes staff and returns no secrets", async () => {
  setup();
  for (const [token, status] of [[null, 401], ["a", 403], ["cashier", 403]]) assert.equal((await directory(request("/api/admin/customers", token))).status, status);
  const response = await directory(request("/api/admin/customers", "owner")); assert.equal(response.status, 200); assert.match(response.headers.get("cache-control"), /no-store/);
  const data = await response.json(); assert.equal(data.customers.length, 1); assert.equal(data.nextPageToken, "second"); assert.equal(data.customers[0].phone, "0207015198"); assert.equal(data.customers[0].passwordHash, undefined);
  const second = await (await directory(request("/api/admin/customers?pageToken=second", "owner"))).json(); assert.equal(second.customers[0].uid, "b"); assert.equal(second.customers[0].marketingEmail, false); assert.equal(second.nextPageToken, null);
  const analytics = await (await directory(request("/api/admin/customers?view=wishlist", "owner"))).json(); assert.equal(analytics.customers, 1); assert.equal(analytics.savedItems, 1); assert.equal(analytics.products[0].count, 1); assert.equal(analytics.customers?.email, undefined);
});
test("profile saves only the signed-in customer; preserves wishlist and rejects staff, mass assignment and bad contacts", async () => {
  const store = setup();
  const body = { name: "New name", phone: "+233207015198", marketingEmail: true, marketingPhone: true, wishlist: ["evil"], uid: "b", email: "spoof@test" };
  assert.equal((await saveProfile(request("/api/customer/profile", "a", body))).status, 200);
  assert.deepEqual(store.inspect("customer_accounts", "a").wishlist, ["p1", "p1"]); assert.equal(store.inspect("customer_accounts", "a").email, "a@example.test"); assert.equal(store.inspect("customer_accounts", "b"), undefined);
  assert.equal((await (await profile(request("/api/customer/profile", "b"))).json()).profile.phone, "");
  assert.equal((await profile(request("/api/customer/profile", "cashier"))).status, 403); assert.equal((await profile(request("/api/customer/profile"))).status, 401);
  assert.equal((await saveProfile(request("/api/customer/profile", "a", { ...body, phone: "not a phone" }))).status, 400);
  assert.equal((await saveProfile(request("/api/customer/profile", "a", { ...body, phone: "" }))).status, 400);
  assert.equal((await saveProfile(request("/api/customer/profile", "a", { ...body, marketingPhone: "yes" }))).status, 400);
  assert.equal((await saveProfile(request("/api/customer/profile", "a", { ...body, marketingEmail: false, marketingPhone: false }))).status, 200);
  assert.equal(store.inspect("customer_accounts", "a").marketingPhone, false);
});
test("Firebase account-list failure is explicit; no partial successful response", async () => {
  setup(); globalThis.__pamTestAuth.listUsers = async () => { throw new Error("permission/internal secret"); };
  const response = await directory(request("/api/admin/customers", "owner")); assert.equal(response.status, 503); assert.doesNotMatch(JSON.stringify(await response.json()), /internal secret/);
});
