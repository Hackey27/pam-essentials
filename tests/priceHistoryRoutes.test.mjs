import test from "node:test";
import assert from "node:assert/strict";
import { GET, POST } from "../app/api/admin/price-history/route.js";
import { POST as importCsv } from "../app/api/admin/catalogue-import/route.js";
import { POST as accounting } from "../app/api/admin/accounting/route.js";
import { POST as bulk } from "../app/api/admin/bulk-products/route.js";
import { defaultAccountingSettings, today } from "../lib/accounting.mjs";
import { memoryFirestore } from "./fixtures/memoryFirestore.mjs";
const id = "123e4567-e89b-42d3-a456-426614174000";
const request = (body, role = "owner", query = "") => new Request(`http://test/api/admin/price-history${query}`, { ...(body ? { method: "POST", body: JSON.stringify(body) } : {}), headers: { ...(role ? { authorization: `Bearer ${role}` } : {}), "content-type": "application/json" } });
function setup(extra = {}) {
  globalThis.__pamTestUsers = new Map(["owner", "admin", "cashier", "supervisor", "customer"].map(role => [role, { uid: role, role, displayName: "Display " + role }]));
  globalThis.__pamTestStore = memoryFirestore({ products: { P: { id: "P", sku: "SKU-P", name: "Pen", price: 10, costPrice: 6, stock: 8, categoryId: "c", imageUrl: "kept-image", barcode: "123" } }, categories: { c: { name: "School", active: true } }, ...extra });
  return globalThis.__pamTestStore;
}
test("history, exports and baseline writes reject anonymous, cashier, supervisor and customer", async () => {
  setup();
  for (const role of [null, "cashier", "supervisor", "customer"]) {
    assert.equal((await GET(request(null, role))).status, role ? 403 : 401);
    assert.equal((await GET(request(null, role, "?format=csv"))).status, role ? 403 : 401);
    assert.equal((await POST(request({ mode: "preview", reason: "Baseline" }, role))).status, role ? 403 : 401);
  }
  assert.equal((await GET(request(null, "admin"))).status, 200);
});
test("baseline preview is read-only; apply preserves product identity, stock, price and images, retry is idempotent", async () => {
  const store = setup(), original = structuredClone(store.inspect("products", "P")), body = { mode: "preview", reason: "Pre-launch baseline" };
  const preview = await (await POST(request(body))).json(); assert.equal(preview.count, 1); assert.equal((await store.collection("product_price_baselines").get()).size, 0);
  const apply = { ...body, mode: "apply", requestId: id, previewHash: preview.previewHash };
  assert.equal((await POST(request(apply))).status, 200); assert.deepEqual(store.inspect("products", "P"), original);
  const rows = (await store.collection("product_price_baselines").get()).docs; assert.equal(rows.length, 1); assert.equal(rows[0].data().values.price, 10); assert.equal(rows[0].data().values.costPrice, 6); assert.equal(rows[0].data().immutable, true);
  assert.equal((await (await POST(request(apply))).json()).duplicate, true); assert.equal((await POST(request({ ...apply, reason: "Different reason" }))).status, 409);
  await store.collection("products").doc("P").update({ price: 20 });
  assert.equal((await (await POST(request(body))).json()).count, 0); assert.equal((await store.collection("product_price_baselines").get()).docs[0].data().values.price, 10);
});
test("stale baseline preview writes nothing", async () => {
  const store = setup(), body = { mode: "preview", reason: "Baseline" }, preview = await (await POST(request(body))).json();
  await store.collection("products").doc("P").update({ costPrice: 7 });
  assert.equal((await POST(request({ ...body, mode: "apply", requestId: id, previewHash: preview.previewHash }))).status, 409);
  assert.equal((await store.collection("product_price_baselines").get()).size, 0); assert.equal((await store.collection("admin_audit").get()).size, 0);
});
test("complete report includes over 500 sales; CSV has private no-store headers and protected names", async () => {
  setup({ sales: Object.fromEntries(Array.from({ length: 605 }, (_, i) => [String(i), { createdAt: "2020-02-02T12:00Z", items: [{ productId: "P", quantity: 1, unitPrice: 10, lineTotal: 10, lineCost: 6, costRecorded: true }] }])) });
  const query = "?productId=P&beforeStart=2020-01-01&beforeEnd=2020-01-31&afterStart=2020-02-01&afterEnd=2020-02-29";
  const response = await GET(request(null, "owner", query)), data = await response.json(); assert.equal(response.status, 200); assert.equal(data.after.receipts, 605); assert.equal(data.after.grossMarginPct, 40); assert.equal(data.coverage.complete, true);
  const csv = await GET(request(null, "owner", query + "&format=csv")); assert.equal(csv.status, 200); assert.match(csv.headers.get("cache-control"), /private, no-store/); assert.match(await csv.text(), /"grossMarginPct","",40/);
  assert.equal((await GET(request(null, "owner", "?productId=missing"))).status, 404);
});
test("CSV imports preserve full cost context without adding per-row history writes", async () => {
  const store = setup(), body = { mode: "preview", fileName: "catalogue.csv", csv: "SKU,NAME,PRICE,CATEGORY\nSKU-P,Renamed Pen,12,School" };
  const preview = await (await importCsv(request(body))).json();
  assert.equal((await importCsv(request({ ...body, mode: "apply", requestId: id, previewHash: preview.previewHash }))).status, 200);
  const audit = (await store.collection("admin_audit").get()).docs[0].data(); assert.equal(audit.newValue.products[0].costBefore, 6); assert.equal(audit.newValue.products[0].costAfter, 6);
  const data = await (await GET(request(null, "owner", "?productId=P"))).json(); assert.equal(data.earliest.price.value, 10); assert.equal(data.earliest.costPrice.value, 6); assert.equal(data.history.length, 1);
});
test("coverage guard refuses a partial history rather than silently truncating", async () => {
  const store = setup(), original = store.collection.bind(store);
  store.collection = name => name === "sales" ? { limit: () => ({ get: async () => ({ docs: Array(50001).fill(null) }) }) } : original(name);
  const response = await GET(request(null, "owner")); assert.equal(response.status, 409); assert.match((await response.json()).error, /No partial/);
});
test("bulk changes retain both prices and costs in the existing Audit transaction", async () => {
  const store = setup(), body = { ids: ["P"], patch: { price: 15 }, reason: "Revised price", mode: "preview" };
  const preview = await (await bulk(request(body))).json();
  assert.equal((await bulk(request({ ...body, mode: "apply", previewHash: preview.previewHash, requestId: id }))).status, 200);
  const data = await (await GET(request(null, "owner", "?productId=P"))).json(); assert.equal(data.history.length, 1); assert.equal(data.history[0].before.costPrice, 6); assert.equal(data.history[0].after.price, 15);
  assert.equal(store.inspect("products", "P").stock, 8);
});
test("reviewed Accounting cost adjustments appear in price history with their original values and reason", async () => {
  const store = setup({ accounting_settings: { config: { ...defaultAccountingSettings(), active: true, startDate: today(), version: 1, openingStock: [{ productId: "P", quantity: 8, unitCost: 600 }] } } });
  const body = { action: "valuation", date: today(), productId: "P", newValue: 64, offsetAccount: "3000", reason: "Reviewed unit cost allocation", requestId: id };
  const response = await accounting(request({ ...body, mode: "preview" })), preview = await response.json(); assert.equal(response.status, 200, JSON.stringify(preview));
  assert.equal(preview.plan.priceChanges[0].before.costPrice, 6); assert.equal(preview.plan.priceChanges[0].after.costPrice, 8);
  assert.equal((await accounting(request({ ...body, mode: "apply", previewHash: preview.previewHash }))).status, 200);
  const data = await (await GET(request(null, "owner", "?productId=P"))).json(); assert.equal(data.history[0].source, "ACCOUNTING_VALUATION"); assert.equal(data.history[0].after.costPrice, 8); assert.equal(data.history[0].reason, body.reason);
  assert.equal(store.inspect("products", "P").stock, 8); assert.equal(store.inspect("products", "P").imageUrl, "kept-image");
});
