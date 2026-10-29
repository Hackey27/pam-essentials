import { inProductCatalogue } from "./stockUnits.mjs";
const DAY = 86400000;
const numeric = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const cents = value => Math.round(numeric(value) * 100);
const stamp = value => value ? new Date(value).getTime() : NaN;
const dayStart = value => { const d = new Date(value); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); };

export function reportingBounds(period, range = {}, now = new Date()) {
  const end = now.getTime(), today = dayStart(end), d = new Date(today);
  if (period === "today") return { start: today, end, previousStart: today - DAY, previousEnd: end - DAY };
  if (period === "week") { const start = today - ((d.getUTCDay() + 6) % 7) * DAY; return { start, end, previousStart: start - 7 * DAY, previousEnd: end - 7 * DAY }; }
  if (period === "month") {
    const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1), previousStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1);
    const previousLastDay = new Date(start - DAY).getUTCDate(), n = new Date(end);
    return { start, end, previousStart, previousEnd: Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, Math.min(d.getUTCDate(), previousLastDay), n.getUTCHours(), n.getUTCMinutes(), n.getUTCSeconds(), n.getUTCMilliseconds()) };
  }
  if (period === "custom") {
    const parse = value => { const at = stamp(`${value}T00:00:00Z`); return /^\d{4}-\d{2}-\d{2}$/.test(value || "") && Number.isFinite(at) && new Date(at).toISOString().slice(0,10) === value ? at : NaN; };
    const start = parse(range.start), finish = parse(range.end);
    if (!Number.isFinite(start) || !Number.isFinite(finish) || finish < start) return null;
    const end = finish + DAY - 1, previousEnd = start - 1;
    return { start, end, previousStart: previousEnd - (end - start), previousEnd };
  }
  return null;
}

export function summarizeActivity(sales = [], expenses = []) {
  const salesCents = sales.reduce((sum, row) => sum + cents(row.total), 0), profitCents = sales.reduce((sum, row) => sum + cents(row.profit), 0), expenseCents = expenses.reduce((sum, row) => sum + cents(row.amount), 0);
  return { sales: salesCents / 100, profit: profitCents / 100, expenses: expenseCents / 100, netProfit: (profitCents - expenseCents) / 100, discounts: sales.reduce((sum, row) => sum + cents(row.discount), 0) / 100, transactions: sales.filter(row => row.saleType !== "reversal").length, reversals: sales.filter(row => row.saleType === "reversal").length, unitsSold: sales.reduce((sum, row) => sum + (row.items || []).reduce((qty, item) => qty + numeric(item.quantity), 0), 0) };
}

export function selectReportingPeriod(sales, expenses, period, range, now = new Date()) {
  const bounds = reportingBounds(period, range, now), valid = period !== "custom" || Boolean(bounds);
  const include = (row, start, end) => { const at = stamp(row.createdAt); return Number.isFinite(at) && at >= start && at <= end; };
  const currentSales = !valid ? [] : bounds ? sales.filter(row => include(row, bounds.start, bounds.end)) : sales;
  const currentExpenses = !valid ? [] : bounds ? expenses.filter(row => include(row, bounds.start, bounds.end)) : expenses;
  const previous = bounds ? summarizeActivity(sales.filter(row => include(row, bounds.previousStart, bounds.previousEnd)), expenses.filter(row => include(row, bounds.previousStart, bounds.previousEnd))) : null;
  const label = ({today:"Today",week:"This week",month:"This month",all:"All time"})[period] || (valid ? `${range.start} to ${range.end}` : "Choose a valid date range");
  return { bounds, valid, label, sales: currentSales, expenses: currentExpenses, current: summarizeActivity(currentSales, currentExpenses), previous };
}

function bucketStart(at, group) { const d = new Date(dayStart(at)); return group === "month" ? Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1) : group === "week" ? d.getTime() - ((d.getUTCDay()+6)%7)*DAY : d.getTime(); }
function nextBucket(at, group) { const d = new Date(at); return group === "month" ? Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1) : at + (group === "week" ? 7 : 1)*DAY; }

export function activityTrend(report, requestedGroup = "day") {
  const records = [...report.sales,...report.expenses].filter(row => Number.isFinite(stamp(row.createdAt)));
  const missingDates=report.sales.length+report.expenses.length-records.length;
  if (!report.valid || !records.length) return {group:requestedGroup,points:[],missingDates,sparse:false};
  const dates = records.map(row => stamp(row.createdAt));
  let start = report.bounds?.start ?? (dates.length ? Math.min(...dates) : null), end = report.bounds?.end ?? (dates.length ? Math.max(...dates) : null);
  if (start === null || end === null) return {group:requestedGroup,points:[],missingDates:0};
  let group = ["day","week","month"].includes(requestedGroup) ? requestedGroup : "day";
  const span = (end-start)/DAY;
  if (group === "day" && span > 90) group = span > 630 ? "month" : "week";
  if (group === "week" && span > 630) group = "month";
  const map = new Map();
  const sparse=group==="month"&&span>3660;
  if(sparse) for(const at of dates.map(value=>bucketStart(value,group)).sort((a,b)=>a-b)) map.set(at,{at,sales:[],expenses:[]});
  else for (let at=bucketStart(start,group);at<=end;at=nextBucket(at,group)) map.set(at,{at,sales:[],expenses:[]});
  for (const kind of ["sales","expenses"]) for (const row of report[kind]) { const at=stamp(row.createdAt); if (Number.isFinite(at)) map.get(bucketStart(at,group))?.[kind].push(row); }
  const points = [...map.values()].map(row => ({at:row.at, end:Math.min(end,nextBucket(row.at,group)-1),label:new Date(row.at).toLocaleDateString("en-GH",{timeZone:"Africa/Accra",day:group==="month"?undefined:"numeric",month:"short",year:"numeric"}),...summarizeActivity(row.sales,row.expenses),salesRecords:row.sales,expenseRecords:row.expenses}));
  return {group,points,missingDates,sparse};
}

export function stockMetricProducts(products, label) {
  products = products.filter(inProductCatalogue);
  if (label === "Low stock") return products.filter(row => Number(row.price)>0 && Number(row.stock)>0 && Number(row.stock)<=Number(row.lowStockLevel||8));
  if (label === "Out of stock") return products.filter(row => Number(row.price)>0 && Number(row.stock)<=0);
  return products;
}
