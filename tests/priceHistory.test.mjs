import test from "node:test";
import assert from "node:assert/strict";
import { pricingMargins, priceChange, priceEvents, earliestPrices, comparisonPeriods, productPerformance, priceHistoryReport, priceHistoryCsv } from "../lib/priceHistory.mjs";
const p = { id: "P", sku: "P-SKU", name: "Bottle", price: 12, costPrice: 6 };
const now = "2026-10-16T00:00:00.000Z", bounds = { start: Date.parse("2026-10-01T00:00Z"), end: Date.parse(now) };
const sale = (id, date, patch = {}) => ({ id, createdAt: date, items: [{ productId: "P", sku: "P-SKU", quantity: 1, unitPrice: 12, lineTotal: 12, unitCost: 6, lineCost: 6, costRecorded: true }], ...patch });

test("margin, markup and cost share use distinct denominators; zero/missing values are not invented", () => {
  const m = pricingMargins(100, 60); assert.equal(m.marginPct, 40); assert.equal(m.markupPct, 40 / 60 * 100); assert.equal(m.costPct, 60); assert.equal(m.unitProfit, 40);
  assert.equal(pricingMargins(0, 0).marginPct, null); assert.equal(pricingMargins(10, 0).markupPct, null); assert.equal(pricingMargins(10, null).unitProfit, null);
  assert.equal(pricingMargins(120, 60, 100).marginPct, 40); assert.equal(pricingMargins(5, 6).marginPct, -20);
});
test("history resolves editor, CSV, bulk and accounting paths without inventing unchanged fields", () => {
  const audit = [
    { id: "a", timestamp: "2026-09-01T00:00Z", action: "UPDATE_PRODUCT", entityId: "P", oldValue: { price: 10, costPrice: 6 }, newValue: { ...p, price: 11 } },
    { id: "b", timestamp: "2026-09-02T00:00Z", action: "IMPORT_CATALOGUE_CSV", newValue: { products: [{ id: "P", sku: p.sku, priceBefore: 11, priceAfter: 12, status: "update" }] } },
    { id: "c", timestamp: "2026-09-03T00:00Z", action: "ACCOUNTING_DOCUMENT", newValue: { priceChanges: [priceChange(p, { ...p, costPrice: 7 })] } },
    { id: "d", timestamp: "2026-09-04T00:00Z", action: "BULK_UPDATE_PRODUCT", entityId: "P", oldValue: { price: 12, costPrice: 7 }, newValue: { price: 13, costPrice: 7 } },
  ];
  const events = priceEvents(p, audit); assert.equal(events.length, 4); assert.equal(events[1].before.costPrice, undefined); assert.equal(events[2].after.costPrice, 7); assert.equal(earliestPrices(events).price.value, 10);
  assert.equal(priceChange({ price: 1 }, { ...p, price: 1, costPrice: null }), null);
  assert.equal(priceEvents(p, [{ ...audit[0], entityId: "Q" }]).length, 0);
});
test("preserved baseline never masquerades as the original purchase date; creation history stays earlier", () => {
  const events = priceEvents(p, [{ id: "first", timestamp: "2026-09-01T00:00Z", action: "CREATE_PRODUCT", entityId: "P", newValue: { ...p, price: 9 } }], [{ id: "baseline", productId: "P", values: p, createdAt: now }]);
  assert.equal(earliestPrices(events).price.value, 9); assert.equal(earliestPrices(events).price.evidence, "Product creation");
  const baseline = priceEvents(p, [], [{ id: "b", productId: "P", values: p, createdAt: now }]); assert.equal(earliestPrices(baseline).costPrice.evidence, "Preserved baseline");
});
test("before/after windows match observed duration; exact change time belongs only to After", () => {
  const periods = comparisonPeriods({ anchor: "2026-10-10T00:00Z", days: 30, now });
  assert.equal(periods.before.end, periods.after.start); assert.equal(periods.before.end - periods.before.start, 6 * 86400000); assert.equal(periods.after.end, Date.parse(now));
  const s = sale("on-change", "2026-10-10T00:00Z"); assert.equal(productPerformance(p, [s], periods.before).receipts, 0); assert.equal(productPerformance(p, [s], periods.after).receipts, 1);
  assert.throws(() => comparisonPeriods({ now, custom: { beforeStart: "2026-02-30", beforeEnd: "2026-03-01", afterStart: "2026-03-02", afterEnd: "2026-03-03" } }));
  assert.throws(() => comparisonPeriods({ now, custom: { beforeStart: "2026-10-01", beforeEnd: "2026-10-10", afterStart: "2026-10-09", afterEnd: "2026-10-15" } }));
});
test("actual revenue uses captured discounts and allocated tax, never today's price/cost", () => {
  const s = sale("one", "2026-10-05T12:00Z", { items: [{ productId: "P", quantity: 2, unitPrice: 15, lineTotal: 24, lineCost: 12, costRecorded: true }], taxSnapshot: { enabled: true, tax: 4, productLines: [{ tax: 4 }] } });
  const r = productPerformance({ ...p, price: 999, costPrice: 888 }, [s], bounds); assert.equal(r.netRevenue, 20); assert.equal(r.discounts, 6); assert.equal(r.cogs, 12); assert.equal(r.grossProfit, 8); assert.equal(r.grossMarginPct, 40);
  assert.equal(r.markupPct, 8 / 12 * 100); assert.equal(r.averageSellingPrice, 10);
});
test("linked corrections offset stock costs only when stock is restored", () => {
  const s = sale("one", "2026-10-05T12:00Z", { taxSnapshot: { enabled: true, tax: 2, productLines: [{ tax: 2 }] } });
  const reversal = { ...s, id: "rev", saleType: "reversal", restoreStock: true, items: s.items.map(i => ({ ...i, quantity: -1, lineTotal: -12, lineCost: -6 })) };
  const r = productPerformance(p, [s, reversal], bounds); assert.equal(r.netRevenue, 0); assert.equal(r.cogs, 0); assert.equal(r.grossProfit, 0); assert.equal(r.grossMarginPct, null); assert.equal(r.unitsReturned, 1);
  assert.equal(productPerformance(p, [s, { ...reversal, restoreStock: false }], bounds).grossProfit, -6);
});
test("unknown and legacy zero costs or missing tax suppress misleading margins", () => {
  const s = sale("missing", "2026-10-02T00:00Z", { items: [{ productId: "P", quantity: 1, unitPrice: 10, lineTotal: 10, unitCost: 0, lineCost: 0 }] });
  assert.equal(productPerformance(p, [s], bounds).grossProfit, null); assert.equal(productPerformance(p, [s], bounds).missingCosts, 1);
  assert.equal(productPerformance(p, [{ ...s, items: s.items.map(i => ({ ...i, costRecorded: true })) }], bounds).grossProfit, 10);
  assert.equal(productPerformance(p, [{ ...sale("tax", "2026-10-02T00:00Z"), taxSnapshot: { enabled: true, tax: 2 } }], bounds).netRevenue, null);
});
test("complete per-SKU report handles more than 500 receipts, missing dates and safe CSV text", () => {
  const sales = Array.from({ length: 605 }, (_, i) => sale(String(i), "2026-10-05T00:00Z"));
  sales.push(sale("undated", null));
  const report = priceHistoryReport({ product: { ...p, name: "=FORMULA()" }, products: [p], audit: [], baselines: [], sales, now, custom: { beforeStart: "2026-09-01", beforeEnd: "2026-09-30", afterStart: "2026-10-01", afterEnd: "2026-10-15" } });
  assert.equal(report.after.receipts, 605); assert.equal(report.after.netRevenue, 7260); assert.equal(report.after.grossMarginPct, 50); assert.equal(report.missingDates, 1); assert.equal(report.periods.matched, false);
  const csv = priceHistoryCsv(report); assert.ok(csv.startsWith("\uFEFF")); assert.ok(csv.includes("'=FORMULA()")); assert.ok(csv.includes("percentage points"));
});
