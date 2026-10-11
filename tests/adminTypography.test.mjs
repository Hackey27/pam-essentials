import test from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/admin/settings/route.js";
import { GET } from "../app/api/appearance/route.js";
import { normalizeTypography, TYPOGRAPHY_KEY } from "../lib/typography.mjs";
import { memoryFirestore } from "./fixtures/memoryFirestore.mjs";
const post = (value, token = "owner") => new Request("http://test/api/admin/settings", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ key: TYPOGRAPHY_KEY, value }) });
test("owner saves validated appearance with audit; public endpoint exposes only typography", async () => {
  globalThis.__pamTestUsers = new Map([["owner", { uid: "owner", role: "owner" }], ["cashier", { uid: "cashier", role: "cashier" }]]);
  const store = memoryFirestore({ users: { owner: { role: "owner" }, cashier: { role: "cashier" } }, settings: { SECRET: { value: "private" } }, admin_audit: {} }); globalThis.__pamTestStore = store;
  assert.equal((await (await GET()).json()).configured, false);
  const theme = normalizeTypography(); theme.website.fontSize = 18;
  assert.equal((await POST(post(theme))).status, 200); assert.equal((await store.collection("admin_audit").get()).docs.length, 1);
  const body = await (await GET()).json(); assert.deepEqual(Object.keys(body), ["typography", "configured"]); assert.equal(body.configured, true); assert.equal(body.typography.website.fontSize, 18);
  assert.equal((await POST(post(theme, "cashier"))).status, 403);
  theme.website.textColor = "<script>"; assert.equal((await POST(post(theme))).status, 400); assert.equal(store.inspect("settings", TYPOGRAPHY_KEY).value.website.fontSize, 18);
});
