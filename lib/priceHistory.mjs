const DAY = 86400000;
const has = (value, key) => Boolean(value && Object.hasOwn(value, key));
const time = value => { const n = Date.parse(value); return Number.isFinite(n) ? n : null; };
const amount = value => value == null || value === "" || !Number.isFinite(Number(value)) ? null : Math.round(Number(value) * 100) / 100;
const cents = value => Math.round(Number(value) * 100);
export const changePercent = (before, after) => before != null && after != null && before > 0 ? (after - before) / before * 100 : null;

export function pricingMargins(price, cost, netPrice = price) {
  price = amount(price); cost = amount(cost); netPrice = amount(netPrice);
  const profit = netPrice != null && cost != null ? (cents(netPrice) - cents(cost)) / 100 : null;
  return { price, cost, netPrice, unitProfit: profit, marginPct: netPrice > 0 && profit != null ? profit / netPrice * 100 : null,
    markupPct: cost > 0 && profit != null ? profit / cost * 100 : null, costPct: netPrice > 0 && cost != null ? cost / netPrice * 100 : null };
}

// Keep absence distinct from an explicitly unpriced product or missing cost.
export function priceValues(product = {}) {
  return Object.fromEntries(["price", "costPrice"].filter(key => has(product, key)).map(key => [key, amount(product[key])]));
}
export function priceChange(before, after) {
  const old = before ? priceValues(before) : null, next = priceValues(after);
  if (!Object.keys(next).length) return null;
  const fields = Object.keys(next).filter(key => !old || (has(old, key) ? old[key] !== next[key] : next[key] != null));
  return fields.length ? { productId: String(after.id || before?.id || after.sku || before?.sku || ""), sku: String(after.sku || before?.sku || after.id || before?.id || ""), name: after.name || before?.name || "", before: old, after: next, fields, kind: before ? "change" : "created" } : null;
}

export function priceEvents(product, audit = [], baselines = []) {
  const events = [], matches = row => row.productId === product.id || !row.productId && row.sku === product.sku;
  const add = (auditRow, change, suffix = "") => {
    if (!change || !matches(change)) return;
    events.push({ ...change, id: `${auditRow.id}${suffix}`, at: auditRow.timestamp || null, source: auditRow.action,
      reason: (auditRow.reason || auditRow.description || "Reason not recorded")+(change.unitChanged ? ` · Stock unit changed: ${change.unitBefore.contents} piece(s) → ${change.unitAfter.contents} piece(s) per selling unit; direct price-change percentages do not apply.` : ""), actor: auditRow.adminName || auditRow.adminEmail || auditRow.admin || "Not recorded" });
  };
  for (const row of audit) {
    if (["CREATE_PRODUCT", "UPDATE_PRODUCT", "BULK_UPDATE_PRODUCT"].includes(row.action) && row.entityId === product.id) {
      add(row, priceChange(row.oldValue, { ...row.newValue, id: product.id, sku: row.newValue?.sku || product.sku, name: row.newValue?.name || product.name }));
    } else if (["IMPORT_CATALOGUE_CSV", "REPLACE_SOURCE_CATALOGUE"].includes(row.action)) {
      for (const item of row.newValue?.products || []) {
        if (item.id !== product.id) continue;
        const before = item.status === "new" ? null : { ...(has(item, "priceBefore") ? { price: item.priceBefore } : {}), ...(has(item, "costBefore") ? { costPrice: item.costBefore } : {}) };
        const after = { id: item.id, sku: item.sku, name: item.nameAfter || product.name, ...(has(item, "priceAfter") ? { price: item.priceAfter } : {}), ...(has(item, "costAfter") ? { costPrice: item.costAfter } : {}) };
        // Old imports may include rows with no financial change; do not invent a change.
        const change=priceChange(before, after);if(change&&item.unitBefore&&item.unitAfter){change.unitChanged=item.unitBefore.unit!==item.unitAfter.unit||item.unitBefore.contents!==item.unitAfter.contents;change.unitBefore=item.unitBefore;change.unitAfter=item.unitAfter;}add(row, change, `:${item.id}`);
      }
    } else if (row.action?.startsWith("ACCOUNTING_")) {
      for (const [index, change] of (row.newValue?.priceChanges || []).entries()) add(row, change, `:${index}`);
    }
  }
  for (const row of baselines.filter(matches)) events.push({ ...row, id: `baseline:${row.id}`, kind: "baseline", before: null, after: priceValues(row.values), fields: [], at: row.createdAt || null, source: "PRESERVED_BASELINE", reason: row.reason, actor: row.staffName || row.staffId });
  return events.sort((a, b) => (time(a.at) ?? Infinity) - (time(b.at) ?? Infinity) || a.id.localeCompare(b.id));
}

export function earliestPrices(events) {
  const result = {};
  for (const event of events) for (const key of ["price", "costPrice"]) {
    if (result[key]) continue;
    const values = has(event.before, key) ? event.before : event.after;
    if (has(values, key)) result[key] = { value: values[key], at: event.at, evidence: event.kind === "created" ? "Product creation" : event.kind === "baseline" ? "Preserved baseline" : has(event.before, key) ? "Recorded before this change" : "First available record" };
  }
  return result;
}

export function comparisonPeriods({ anchor, days = 30, now = new Date().toISOString(), custom } = {}) {
  const atNow = time(now); if (atNow == null) throw new Error("Invalid reporting time.");
  if (custom) {
    const read = (value, end = false) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) throw new Error("Choose valid comparison dates.");
      const n = time(value + "T00:00:00.000Z");
      if (n == null || new Date(n).toISOString().slice(0, 10) !== value) throw new Error("Choose valid comparison dates.");
      return end ? Math.min(n + DAY, atNow) : n;
    };
    const before = { start: read(custom.beforeStart), end: read(custom.beforeEnd, true) }, after = { start: read(custom.afterStart), end: read(custom.afterEnd, true) };
    if (before.end <= before.start || after.end <= after.start || before.end > after.start) throw new Error("Choose two non-overlapping periods, with Before preceding After. Future periods are unavailable.");
    return { before, after, matched: before.end - before.start === after.end - after.start, mode: "custom" };
  }
  if (![7, 14, 30, 60, 90].includes(Number(days))) throw new Error("Choose a 7, 14, 30, 60 or 90 day window.");
  const changeAt = anchor ? time(anchor) : atNow - Number(days) * DAY;
  if (changeAt == null || changeAt > atNow) throw new Error("The selected change has no usable date.");
  // Compare equal observed durations. A new change must accumulate actual sales first.
  const duration = Math.min(Number(days) * DAY, atNow - changeAt);
  return { before: { start: changeAt - duration, end: changeAt }, after: { start: changeAt, end: changeAt + duration }, matched: true, mode: anchor ? "change" : "recent" };
}

export function productPerformance(product, sales, bounds) {
  let revenue = 0, cost = 0, discount = 0, sold = 0, returned = 0, missingCosts = 0, missingTax = 0, invalidLines = 0, missingDiscounts = 0;
  const receipts = new Set(), corrections = new Set();
  for (const sale of sales) {
    const at = time(sale.createdAt); if (at == null || at < bounds.start || at >= bounds.end) continue;
    for (const [index, item] of (sale.items || []).entries()) {
      if ((item.productId || item.id) !== product.id && ((item.productId || item.id) || !product.sku || item.sku !== product.sku)) continue;
      const quantity = Number(item.quantity), total = amount(item.lineTotal);
      if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || !quantity || total == null) { invalidLines++; continue; }
      const reversal = sale.saleType === "reversal", sign = quantity < 0 ? -1 : 1;
      if (quantity > 0) { sold += quantity; receipts.add(sale.id); } else { returned -= quantity; corrections.add(sale.id); }
      const allocatedTax = sale.taxSnapshot?.productLines?.[index]?.tax;
      let tax = 0;
      if (sale.taxSnapshot?.enabled && Number(sale.taxSnapshot.tax) !== 0) {
        if (amount(allocatedTax) == null) missingTax++;
        else tax = cents(Math.abs(Number(allocatedTax))) * sign;
      }
      revenue += cents(total) - tax;
      const unit = amount(item.unitPrice);
      if (unit == null) missingDiscounts++; else discount += cents(unit * quantity) - cents(total);
      const lineCost = amount(item.lineCost), unitCost = amount(item.unitCost);
      const known = item.costRecorded !== false && (item.costRecorded === true && (lineCost != null || unitCost != null) || Math.abs(lineCost || unitCost || 0) > 0);
      if (!known) missingCosts++;
      else if (!(reversal && sale.restoreStock === false)) cost += lineCost != null ? cents(lineCost) : cents(unitCost * quantity);
    }
  }
  const reliable = !missingCosts && !missingTax && !invalidLines, netUnits = sold - returned, days = (bounds.end - bounds.start) / DAY;
  const netRevenue = !missingTax && !invalidLines ? revenue / 100 : null, cogs = !missingCosts && !invalidLines ? cost / 100 : null, grossProfit = reliable ? (revenue - cost) / 100 : null;
  return { unitsSold: sold, unitsReturned: returned, netUnits, receipts: receipts.size, corrections: corrections.size, netRevenue, cogs, grossProfit,
    grossMarginPct: reliable && revenue > 0 ? (revenue - cost) / revenue * 100 : null, markupPct: reliable && cost > 0 ? (revenue - cost) / cost * 100 : null,
    discounts: missingDiscounts || invalidLines ? null : discount / 100, averageSellingPrice: netUnits > 0 && netRevenue != null ? netRevenue / netUnits : null,
    profitPerUnit: netUnits > 0 && grossProfit != null ? grossProfit / netUnits : null, revenuePerDay: days > 0 && netRevenue != null ? netRevenue / days : null,
    unitsPerDay: days > 0 ? netUnits / days : null, days, missingCosts, missingTax, invalidLines, missingDiscounts };
}

export function priceHistoryReport({ product, products, audit, baselines, sales, now, days, changeId, custom, netPrice }) {
  const history = priceEvents(product, audit, baselines), changes = history.filter(e => e.kind === "change" && time(e.at) != null);
  const selected = custom || changeId === "recent" ? null : changes.find(e => e.id === changeId) || (!changeId ? changes.at(-1) : null);
  if (changeId && changeId !== "recent" && !custom && !selected) throw new Error("The selected price change is unavailable. Refresh the history.");
  const periods = comparisonPeriods({ anchor: selected?.at, now, days, custom });
  const before = productPerformance(product, sales, periods.before), after = productPerformance(product, sales, periods.after);
  const missingDates = sales.filter(s => time(s.createdAt) == null && (s.items || []).some(i => (i.productId || i.id) === product.id || !(i.productId || i.id) && i.sku === product.sku)).length;
  return { product: { id: product.id, sku: product.sku || product.id, name: product.name }, products: products.map(p => ({ id: p.id, sku: p.sku || p.id, name: p.name })),
    current: pricingMargins(product.price, product.costPrice, netPrice), earliest: earliestPrices(history), history, selectedChange: selected, periods, before, after,
    priceChangePct: selected?.unitChanged ? null : changePercent(selected?.before?.price, selected?.after?.price), costChangePct: selected?.unitChanged ? null : changePercent(selected?.before?.costPrice, selected?.after?.costPrice),
    marginChangePoints: before.grossMarginPct != null && after.grossMarginPct != null ? after.grossMarginPct - before.grossMarginPct : null,
    revenueChangePct: changePercent(before.netRevenue, after.netRevenue), unitsChangePct: changePercent(before.netUnits, after.netUnits), profitChangePct: changePercent(before.grossProfit, after.grossProfit),
    missingDates, baselineCount: baselines.length, baselineMissing: products.filter(p => !baselines.some(b => b.productId === p.id)).length, updatedAt: now };
}

export function priceHistoryCsv(report) {
  const row = values => values.map(v => { if (v == null) return '""'; if (typeof v === "number") return String(v); let s = String(v); if (/^[\s]*[=+\-@]|^[\t\r\n]/.test(s)) s = "'" + s; return '"' + s.replaceAll('"', '""') + '"'; }).join(",");
  const rows = [["PAM Price & Cost History — GHS", report.product.sku, report.product.name], ["Updated", report.updatedAt], ["Scope", "POS receipts and corrections; standalone invoices and operating expenses remain in Accounting"],
    ["Periods", "Start (inclusive)", "End (exclusive)"], ...["before", "after"].map(k => [k, new Date(report.periods[k].start).toISOString(), new Date(report.periods[k].end).toISOString()]),
    ["Current pricing", "Amount / percent"], ...Object.entries(report.current).map(([key, value]) => [key, value]),
    ["Earliest recorded", "Value", "Date", "Evidence"], ...Object.entries(report.earliest).map(([key, record]) => [key, record.value, record.at, record.evidence]),
    ["Metric", "Before", "After"], ...Object.keys(report.before).map(k => [k, report.before[k], report.after[k]]), ["Margin change (percentage points)", report.marginChangePoints],
    ["History", "Date", "Source", "Selling price before", "Selling price after", "Recorded cost before", "Recorded cost after", "Reason", "Recorded by"],
    ...report.history.map(e => [e.id, e.at, e.source, e.before?.price, e.after?.price, e.before?.costPrice, e.after?.costPrice, e.reason, e.actor]),
    ["Definitions", "Gross margin = gross profit / net revenue × 100; markup = gross profit / cost × 100. Missing costs/tax prevent complete margin figures. Recorded cost is landed cost only when all landing costs were entered."]];
  return "\uFEFF" + rows.map(row).join("\r\n");
}
