import { Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb, requireRole } from "@/lib/admin";
import { receiptSnapshot } from "@/lib/receiptData.mjs";

export const dynamic = "force-dynamic";

function bounds(url) {
  const now = new Date();
  const period = url.searchParams.get("period") || "today";
  let start;
  let end = now;
  if (period === "today") start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  else if (period === "week") {
    start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
  } else if (period === "month") start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  else if (period === "custom") {
    const from = url.searchParams.get("start");
    const to = url.searchParams.get("end");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from || "") || !/^\d{4}-\d{2}-\d{2}$/.test(to || "")) return null;
    start = new Date(`${from}T00:00:00.000Z`);
    end = new Date(`${to}T23:59:59.999Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start || start > now) return null;
    if (end > now) end = now;
  } else return null;
  const duration = end.getTime() - start.getTime() + 1;
  return { period, start, end, previousStart: new Date(start.getTime() - duration), previousEnd: new Date(start.getTime() - 1) };
}

const iso = (value) => value?.toDate?.()?.toISOString?.() || value || null;
const sum = (rows, field) => rows.reduce((total, row) => total + Number(row[field] || 0), 0);

export async function GET(request) {
  const access = await requireRole(request, ["owner", "admin", "supervisor", "cashier"]);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  const range = bounds(new URL(request.url));
  if (!range) return NextResponse.json({ error: "Choose a valid reporting period." }, { status: 400 });
  const store = adminDb();
  const rangeQuery = (collection, start, end) => store.collection(collection).where("createdAt", ">=", Timestamp.fromDate(start)).where("createdAt", "<=", Timestamp.fromDate(end)).get();
  const [salesSnap, previousSalesSnap, expensesSnap, previousExpensesSnap, ordersSnap, previousOrdersSnap, productsSnap] = await Promise.all([
    rangeQuery("sales", range.start, range.end), rangeQuery("sales", range.previousStart, range.previousEnd),
    rangeQuery("expenses", range.start, range.end), rangeQuery("expenses", range.previousStart, range.previousEnd),
    rangeQuery("orders", range.start, range.end), rangeQuery("orders", range.previousStart, range.previousEnd),
    store.collection("products").get(),
  ]);
  const sales = salesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const expenses = expensesSnap.docs.map((doc) => doc.data());
  const products = productsSnap.docs.map((doc) => doc.data());
  const priced = products.filter((product) => Number(product.price) > 0 && product.active !== false && !product.archived);
  const quantities = new Map();
  const channels = new Map();
  for (const sale of sales) {
    const channel = sale.salesChannel || "walk-in";
    channels.set(channel, (channels.get(channel) || 0) + Number(sale.total || 0));
    for (const item of sale.items || []) {
      const current = quantities.get(item.productId) || { name: item.name, quantity: 0 };
      current.quantity += Number(item.quantity || 0);
      quantities.set(item.productId, current);
    }
  }
  const isAdmin = ["owner", "admin"].includes(access.user.role);
  const summary = { sales: sum(sales, "total"), expenses: sum(expenses, "amount"), products: new Set(sales.flatMap((sale) => (sale.items || []).map((item) => item.productId))).size, orders: ordersSnap.size, channels: channels.size, lowStock: priced.filter((product) => Number(product.stock) > 0 && Number(product.stock) < Number(product.lowStockLevel ?? 8)).length, outOfStock: priced.filter((product) => Number(product.stock) <= 0).length, transactions: sales.length };
  const previous = { sales: sum(previousSalesSnap.docs.map((doc) => doc.data()), "total"), expenses: sum(previousExpensesSnap.docs.map((doc) => doc.data()), "amount"), orders: previousOrdersSnap.size, transactions: previousSalesSnap.size };
  if (isAdmin) { summary.grossProfit = sum(sales, "profit"); summary.netProfit = summary.grossProfit - summary.expenses; previous.grossProfit = sum(previousSalesSnap.docs.map((doc) => doc.data()), "profit"); previous.netProfit = previous.grossProfit - previous.expenses; }
  const transactions = sales.sort((a, b) => String(iso(b.createdAt)).localeCompare(String(iso(a.createdAt)))).map((sale) => receiptSnapshot({ ...sale, createdAt: iso(sale.createdAt) }));
  const history = new Map();
  for (const sale of sales) { const date = iso(sale.createdAt)?.slice(0, 10); if (!date) continue; const row = history.get(date) || { date, transactions: 0, sales: 0, expenses: 0 }; row.transactions += 1; row.sales += Number(sale.total || 0); history.set(date, row); }
  for (const expense of expenses) { const date = iso(expense.createdAt)?.slice(0, 10); if (!date) continue; const row = history.get(date) || { date, transactions: 0, sales: 0, expenses: 0 }; row.expenses += Number(expense.amount || 0); history.set(date, row); }
  return NextResponse.json({ period: range.period, start: range.start.toISOString(), end: range.end.toISOString(), summary, previous, transactions, channels: [...channels].map(([name, total]) => ({ name, total })), fastSelling: [...quantities].map(([id, item]) => ({ id, ...item })).sort((a, b) => b.quantity - a.quantity).slice(0, 10), history: [...history.values()].sort((a, b) => b.date.localeCompare(a.date)), currentCatalogueProducts: priced.length, lastUpdated: new Date().toISOString() });
}

