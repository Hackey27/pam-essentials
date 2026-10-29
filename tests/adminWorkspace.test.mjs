import test from "node:test";
import assert from "node:assert/strict";
import { groupedNavigation, normalizeProductView, productReadiness, waitingLabel } from "../lib/adminWorkspace.mjs";
import { pricingPreview } from "../lib/adminPricingPreview.mjs";
import { draftKey, draftMaxAge, readProductDraft, recoveredDraftChanges, writeProductDraft } from "../lib/productDrafts.mjs";
import { priceCart } from "../lib/cartPricing.mjs";
const hierarchy = { categories: [{ categoryId: "c", name: "School", active: true }], subcategories: [{ subcategoryId: "s", categoryId: "c", name: "Pens" }], subSubcategories: [] };
const product = { id: "p", sku: "SKU-P", name: "Pen", description: "A writing pen", categoryId: "c", imageUrl: "https://example.test/pen.jpg", price: 20, stock: 10, active: true };
test("grouping retains all 18 tabs exactly once and respects supervisor permissions", () => {
  const nav = ["Overview", "Orders", "Products", "Categories", "Inventory", "Discounts", "Promotions", "Announcements", "Appearance", "Staff", "Customers", "Inquiries", "Product Requests", "Reviews", "Analytics", "Transactions", "Settings", "Audit"];
  assert.deepEqual(groupedNavigation(nav).flatMap((g) => g.tabs).sort(), [...nav].sort());
  assert.deepEqual(groupedNavigation(["Overview", "Orders", "Inventory"]).flatMap((g) => g.tabs), ["Overview", "Orders", "Inventory"]);
  assert.equal(groupedNavigation([...nav, "Future tab"]).at(-1).tabs[0], "Future tab");
});
test("readiness uses image fallback, optional children and explicit quote intent", () => {
  assert.deepEqual(productReadiness(product, [product], hierarchy).issues, []);
  const p = { ...product, imageUrl: "", galleryImagePaths: ["products/pen/gallery/angle.webp"], price: null, contactForPrice: true };
  const result = productReadiness(p, [p], hierarchy); assert.equal(result.quote, true); assert.equal(result.issues.includes("photo"), false); assert.equal(result.issues.includes("pricing"), false);
  assert.equal(productReadiness({ ...p, contactForPrice: false }, [p], hierarchy).issues.includes("pricing"), true);
  assert.equal(productReadiness({ ...product, subcategoryId: "missing" }, [product], hierarchy).issues.includes("classification"), true);
  assert.equal(productReadiness({ ...product, description: " " }, [product], hierarchy).issues.includes("description"), true);
});
test("readiness flags duplicate variants and groups crossing final categories", () => {
  const a = { ...product, productGroupId: "g", variantOptions: { colour: "Red" } }, b = { ...a, id: "b" };
  assert.equal(productReadiness(a, [a, b], hierarchy).issues.includes("variants"), true);
  a.variantOptions = { colour: "Red" }; b.variantOptions = { colour: "Blue" };
  assert.equal(productReadiness(a, [a, b], hierarchy).issues.includes("variants"), false);
  b.subcategoryId = "s"; assert.equal(productReadiness(a, [a, b], hierarchy).issues.includes("variants"), true);
});
test("pricing explanations reproduce checkout, precedence, dates and per-SKU thresholds", () => {
  const rules = [{ ruleId: "g", name: "Quantity", scopeType: "GLOBAL", discountType: "PERCENT", value: 5, minQty: 3 }, { ruleId: "promo", name: "School offer", kind: "promotion", scopeType: "PRODUCT", scopeId: "p", discountType: "PERCENT", value: 10, minQty: 2, startDate: "2026-10-01", endDate: "2026-10-12" }, { ruleId: "other", name: "Other", scopeType: "PRODUCT", scopeId: "other", value: 50, minQty: 1 }];
  const result = pricingPreview(product, 3, rules, hierarchy, "2026-10-12T23:59:00Z", "website");
  assert.equal(result.total, priceCart([{ ...product, quantity: 3 }], rules, [], new Date("2026-10-12T23:59:00Z")).total);
  assert.equal(result.ruleResults.find((r) => r.ruleId === "promo").selected, true); assert.match(result.ruleResults.find((r) => r.ruleId === "g").explanation, /higher-ranked/); assert.match(result.ruleResults.find((r) => r.ruleId === "other").explanation, /Different product/);
  const expired = pricingPreview(product, 1, rules, hierarchy, "2026-10-13T00:01:00Z", "walk-in"); assert.match(expired.ruleResults[1].explanation, /Expired/); assert.match(expired.ruleResults[0].explanation, /Needs 3/);
  assert.equal(pricingPreview(product, 3, rules, hierarchy, "2026-10-12T23:59:00Z", "phone").total, result.total);
});
test("preview never authorizes a quote, inactive product or excessive quantity", () => {
  assert.equal(pricingPreview({ ...product, price: null, contactForPrice: true }, 1, [], hierarchy, "2026-10-12T12:00Z", "website").total, undefined);
  assert.equal(pricingPreview({ ...product, active: false }, 1, [], hierarchy, "2026-10-12T12:00Z", "walk-in").purchasable, false);
  assert.equal(pricingPreview(product, 11, [], hierarchy, "2026-10-12T12:00Z", "walk-in").purchasable, false);
});
test("saved views allow bounded filters only; waiting times handle missing dates", () => {
  assert.deepEqual(normalizeProductView({ readiness: "photo" }), { query: "", category: "all", status: "all", readiness: "photo" });
  assert.throws(() => normalizeProductView({ status: "privileged" }));
  assert.equal(waitingLabel("invalid"), "Time unavailable"); assert.equal(waitingLabel("2026-10-10T11:00:00Z", Date.parse("2026-10-12T12:00:00Z")), "2d 1h");
});
test("drafts are account-scoped, expire, and recover only edits while flagging concurrent changes", () => {
  const rows = new Map(), storage = { getItem: (k) => rows.get(k), setItem: (k, v) => rows.set(k, v) }, at = Date.parse("2026-10-12T12:00:00Z");
  const base = { id: "p", create: false, price: 20, name: "Original", expectedVersion: "1" };
  writeProductDraft(storage, "owner", { type: "product", data: { ...base, price: 25 } }, JSON.stringify(base), at);
  const draft = readProductDraft(storage, "owner", "p", at); assert.ok(draft); assert.equal(readProductDraft(storage, "other", "p", at), null); assert.equal(readProductDraft(storage, "owner", "p", at + draftMaxAge + 1), null);
  const changes = recoveredDraftChanges(draft, { ...base, price: 23, name: "Someone else's name", expectedVersion: "2" }); assert.deepEqual(changes.map((c) => c.field), ["price"]); assert.equal(changes[0].conflict, true);
  rows.set(draftKey("owner", "p"), "broken"); assert.equal(readProductDraft(storage, "owner", "p", at), null);
});

test("retired catalogue records and loose components never become readiness tasks or product exports", async () => {
  const { inProductCatalogue, retailEnabled } = await import("../lib/stockUnits.mjs");
  const { wholesaleEnabled } = await import("../lib/wholesale.mjs");
  const { exportCatalogueCsv, parseCatalogueCsv } = await import("../lib/catalogueImport.mjs");
  const { stockMetricProducts } = await import("../lib/adminReporting.mjs");
  const retired = { ...product, id: "old", sku: "OLD", stock: 0, imageUrl: "", catalogueRetirement: { replacements: ["SKU-P"] }, wholesale: { enabled: true, unitPrice: 10, minQty: 1, increment: 1 } };
  const component = { ...product, id: "loose", sku: "LOOSE", imageUrl: "", retailUnit: { unit: "individual", contents: 1, role: "component" } };
  const unpriced = { ...product, id: "unpriced", sku: "UNPRICED", price: null };
  assert.equal(inProductCatalogue(retired), false); assert.equal(retailEnabled(retired), false); assert.equal(wholesaleEnabled(retired), false);
  assert.equal(inProductCatalogue(component), false);
  assert.equal(inProductCatalogue({ ...product, archived: true }), true);
  assert.equal(inProductCatalogue(unpriced), true);
  for (const p of [retired, component]) { const result = productReadiness(p, [product, p], hierarchy); assert.deepEqual(result.issues, []); assert.equal(result.excluded, true); }
  assert.equal(productReadiness(unpriced, [unpriced], hierarchy).issues.includes("pricing"), true);
  assert.deepEqual(parseCatalogueCsv(exportCatalogueCsv([product, retired, component])).map(p => p.sku), ["SKU-P"]);
  assert.deepEqual(stockMetricProducts([product, retired, component], "Out of stock"), []);
  assert.deepEqual(stockMetricProducts([product, retired, component], "Products").map(p => p.id), ["p"]);
});
