"use client";

import { useEffect, useMemo, useState } from "react";
import ReceiptPanel from "@/components/ReceiptPanel";

const money = new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" });
const dateLabel = (value) => new Date(value).toLocaleString("en-GH", { dateStyle: "medium", timeStyle: "short" });

export default function PosDashboard({ user, role, onNewSale, onScan, onOrders, onInventory, onExpense }) {
  const [period, setPeriod] = useState("today");
  const [custom, setCustom] = useState({ start: "", end: "" });
  const [applied, setApplied] = useState({ period: "today" });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState("");
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [historyMode, setHistoryMode] = useState("daily");
  const [historyPage, setHistoryPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError(""); setData(null);
      try {
        const params = new URLSearchParams(applied);
        const token = await user.getIdToken();
        const response = await fetch(`/api/pos/dashboard?${params}`, { headers: { authorization: `Bearer ${token}` } });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Dashboard could not be loaded.");
        if (!cancelled) setData(result);
      } catch (err) { if (!cancelled) setError(err.message || "Dashboard could not be loaded."); }
      finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [user, applied, refreshKey]);

  const summary = data?.summary || {};
  const previous = data?.previous || {};
  const cards = [
    ["Sales", "sales", money.format(summary.sales || 0), "Revenue in selected period", "navy"],
    ["Expenses", "expenses", money.format(summary.expenses || 0), "Recorded in selected period", "orange"],
    ["Products", "products", summary.products || 0, "Distinct products sold", "aqua"],
    ["Orders", "orders", summary.orders || 0, "Orders placed in selected period", "navy"],
    ["Channels", "channels", summary.channels || 0, "Sales channels used", "aqua"],
    ["Low stock", "lowStock", summary.lowStock || 0, "Current stock warning", "orange"],
    ["Out of stock", "outOfStock", summary.outOfStock || 0, "Current priced products", "red"],
    ["Transactions / receipts", "transactions", summary.transactions || 0, "Recorded in selected period", "navy"],
    ...(["owner", "admin"].includes(role) ? [["Gross profit", "grossProfit", money.format(summary.grossProfit || 0), "Selected period · Admin only", "aqua"], ["Net profit", "netProfit", money.format(summary.netProfit || 0), "After expenses · Admin only", "aqua"]] : []),
  ];
  const comparison = (key) => {
    if (!(key in previous)) return "Current state";
    const before = Number(previous[key] || 0);
    const now = Number(summary[key] || 0);
    if (!before) return now ? "No previous period activity" : "No change";
    const percent = Math.round((now - before) / Math.abs(before) * 100);
    return `${percent >= 0 ? "+" : ""}${percent}% vs previous period`;
  };
  const history = useMemo(() => {
    const grouped = new Map();
    for (const row of data?.history || []) {
      const date = new Date(`${row.date}T00:00:00Z`);
      const key = historyMode === "monthly" ? row.date.slice(0, 7) : historyMode === "weekly" ? (() => { const monday = new Date(date); monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7); return monday.toISOString().slice(0, 10); })() : row.date;
      const current = grouped.get(key) || { date: key, transactions: 0, sales: 0, expenses: 0 };
      current.transactions += row.transactions;
      current.sales += row.sales;
      current.expenses += row.expenses;
      grouped.set(key, current);
    }
    return [...grouped.values()].sort((a, b) => b.date.localeCompare(a.date));
  }, [data, historyMode]);
  const transactions = data?.transactions || [];
  const unitsSold = transactions.reduce((sum, sale) => sum + sale.items.reduce((count, item) => count + Number(item.quantity || 0), 0), 0);
  const discounts = transactions.reduce((sum, sale) => sum + Number(sale.discount || 0), 0);

  return <main className="pos-dashboard">
    <div className="pos-dashboard-heading"><div><p className="eyebrow">Sales & inventory</p><h1>Dashboard</h1><p>Activity and stock health for the selected period.</p></div><button className="button secondary" onClick={() => setRefreshKey((key) => key + 1)}>Refresh dashboard</button></div>
    <div className="pos-period"><label>Period<select value={period} onChange={(event) => setPeriod(event.target.value)}><option value="today">Today</option><option value="week">This Week</option><option value="month">This Month</option><option value="custom">Custom</option></select></label>{period === "custom" && <><label>Start date<input type="date" value={custom.start} onChange={(event) => setCustom({ ...custom, start: event.target.value })} /></label><label>End date<input type="date" value={custom.end} onChange={(event) => setCustom({ ...custom, end: event.target.value })} /></label></>}<button className="button primary" disabled={period === "custom" && (!custom.start || !custom.end)} onClick={() => setApplied(period === "custom" ? { period, ...custom } : { period })}>Apply</button><strong>Showing: {data ? `${new Date(data.start).toLocaleDateString("en-GH")} – ${new Date(data.end).toLocaleDateString("en-GH")}` : "Loading"}</strong></div>
    {error && <p className="notice error-notice" role="alert">{error}</p>}
    {loading && <div className="pos-loading">Loading dashboard…</div>}
    {!loading && data && <>
      <div className="pos-dashboard-cards">{cards.map(([label, key, value, note, colour]) => <article className={`pos-summary-card ${colour}`} key={key}><span>{label}</span><strong>{value}</strong><p>{note}</p><small>{comparison(key)}</small><button type="button" onClick={() => setDetail(key)}>View details</button></article>)}</div>
      <p className="pos-updated">Last updated {dateLabel(data.lastUpdated)}</p>
      <div className="pos-dashboard-sections"><section className="panel"><h2>Quick start</h2><div className="pos-quick-actions"><button onClick={onNewSale}>Start a sale</button><button onClick={onScan}>Scan barcode</button><button onClick={onExpense}>Add expense</button><button onClick={() => setRefreshKey((key) => key + 1)}>Refresh dashboard</button></div></section><section className="panel"><h2>Fast-selling products</h2>{data.fastSelling.length ? data.fastSelling.map((item) => <div className="pos-stat-row" key={item.id}><span>{item.name}</span><b>{item.quantity} sold</b></div>) : <p>No sales data yet</p>}</section></div>
      <section className="panel pos-history"><div className="panel-title"><h2>Historical activity</h2><select value={historyMode} onChange={(event) => { setHistoryMode(event.target.value); setHistoryPage(1); }}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></div>{history.length ? <><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Period</th><th>Transactions</th><th>Sales</th><th>Expenses</th></tr></thead><tbody>{history.slice((historyPage - 1) * 10, historyPage * 10).map((row) => <tr key={row.date}><td>{row.date}</td><td>{row.transactions}</td><td>{money.format(row.sales)}</td><td>{money.format(row.expenses)}</td></tr>)}</tbody></table></div>{history.length > 10 && <div className="pagination"><button disabled={historyPage === 1} onClick={() => setHistoryPage((page) => page - 1)}>Previous</button><span>{historyPage} / {Math.ceil(history.length / 10)}</span><button disabled={historyPage >= Math.ceil(history.length / 10)} onClick={() => setHistoryPage((page) => page + 1)}>Next</button></div>}</> : <p>No transactions were recorded for the selected period</p>}</section>
    </>}
    {detail && <div className="modal-backdrop" onMouseDown={() => setDetail("")}><div className="modal pos-detail-modal" role="dialog" aria-modal="true" aria-label={`${cards.find((card) => card[1] === detail)?.[0]} details`} onMouseDown={(event) => event.stopPropagation()}><div className="drawer-title"><div><p className="eyebrow">Selected period</p><h2>{cards.find((card) => card[1] === detail)?.[0]}</h2></div><button className="icon-button" aria-label="Close details" onClick={() => setDetail("")}>×</button></div>{detail === "transactions" || detail === "sales" ? <><div className="pos-detail-totals"><b>{money.format(summary.sales || 0)} sales</b><b>{transactions.length} receipts</b><b>{unitsSold} units</b><b>{money.format(discounts)} discounts</b></div>{transactions.length ? transactions.map((sale) => <button className="pos-stat-row pos-receipt-row" key={sale.id || sale.receiptId} onClick={() => setSelectedReceipt(sale)}><span>{sale.receiptId} · {dateLabel(sale.createdAt)}<small>{sale.paymentMethod} · {sale.staffEmail}</small></span><b>{money.format(sale.total)}</b></button>) : <p>No transactions were recorded for the selected period</p>}</> : detail === "channels" ? data.channels.map((channel) => <div className="pos-stat-row" key={channel.name}><span>{channel.name}</span><b>{money.format(channel.total)}</b></div>) : detail === "lowStock" || detail === "outOfStock" ? (["owner", "admin", "supervisor"].includes(role) ? <button className="button secondary" onClick={() => { setDetail(""); onInventory(); }}>Open inventory</button> : <p>Ask a supervisor for inventory access.</p>) : detail === "orders" ? <button className="button secondary" onClick={() => { setDetail(""); onOrders(); }}>Open orders</button> : <p>{cards.find((card) => card[1] === detail)?.[2]} · {cards.find((card) => card[1] === detail)?.[3]}</p>}<p className="pos-updated">Last updated {dateLabel(data.lastUpdated)}</p></div></div>}
    {selectedReceipt && <ReceiptPanel sale={selectedReceipt} onClose={() => setSelectedReceipt(null)} onNewSale={() => { setSelectedReceipt(null); setDetail(""); onNewSale(); }} />}
  </main>;
}

