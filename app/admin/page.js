"use client";

import { useEffect, useMemo, useState } from "react";
import RequireRole from "@/components/RequireRole";
import { signOut, useAuth } from "@/components/AuthProvider";

const money = new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" });
const nav = ["Overview", "Orders", "Products", "Categories", "Inventory", "Discounts", "Staff", "Analytics", "Settings", "Audit"];

function AdminPortal() {
  const { user, role } = useAuth();
  const [section, setSection] = useState("Overview");
  const [data, setData] = useState({ products: [], orders: [], movements: [], metrics: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [seeding, setSeeding] = useState(false);
  const [notice, setNotice] = useState("");

  async function authorizedFetch(url, options = {}) {
    const token = await user.getIdToken();
    return fetch(url, { ...options, headers: { ...(options.headers || {}), authorization: `Bearer ${token}` } });
  }

  async function load() {
    if (!user) return;
    setLoading(true); setError("");
    try {
      const response = await authorizedFetch("/api/admin/catalog");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setData(payload);
    } catch (err) { setError(err.message || "Admin data could not be loaded."); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [user]);

  async function seedCatalogue() {
    setSeeding(true); setNotice(""); setError("");
    try {
      const response = await authorizedFetch("/api/admin/seed", { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setNotice(`${payload.created} products added; ${payload.skipped} already existed.`);
      await load();
    } catch (err) { setError(err.message || "The catalogue could not be imported."); }
    finally { setSeeding(false); }
  }

  const products = useMemo(() => data.products.filter((product) => {
    const matches = `${product.name} ${product.id} ${product.category}`.toLowerCase().includes(query.toLowerCase());
    const state = status === "all" || (status === "priced" && Number(product.price) > 0) || (status === "needs-pricing" && !(Number(product.price) > 0)) || (status === "low" && Number(product.stock) <= Number(product.lowStockLevel || 8));
    return matches && state;
  }), [data.products, query, status]);

  const metricCards = [
    ["Products", data.metrics.products || 0, "Complete catalogue"],
    ["Visible for sale", data.metrics.active || 0, "Storefront and POS"],
    ["Needs pricing", data.metrics.needsPricing || 0, "Admin only"],
    ["Low stock", data.metrics.lowStock || 0, "At or below threshold"],
    ["Out of stock", data.metrics.outOfStock || 0, "Priced products"],
    ["Open orders", data.metrics.openOrders || 0, "All channels"],
  ];

  return <div className="admin-shell">
    <aside className="admin-sidebar"><div><a className="admin-brand" href="/">PAM <span>Essentials & More</span></a><p className="admin-user">{user?.email}<br /><b>{role}</b></p></div><nav>{nav.map((item) => <button key={item} onClick={() => setSection(item)} className={section === item ? "active" : ""}><span className="nav-dot" />{item}{item === "Orders" && data.metrics.openOrders > 0 && <b>{data.metrics.openOrders}</b>}{item === "Inventory" && data.metrics.lowStock > 0 && <b>{data.metrics.lowStock}</b>}</button>)}</nav><div className="sidebar-actions"><a href="/pos">Open till</a><a href="/">View store</a></div></aside>
    <main className="admin-main">
      <header className="admin-topbar"><div><p>PAM Essentials & More Admin</p><span>{user?.email}</span></div><div><button className="icon-button" onClick={load} aria-label="Refresh">↻</button><button className="icon-button" onClick={signOut} aria-label="Sign out">↪</button></div></header>
      <section className="admin-content">
        <div className="page-title"><div><p className="eyebrow">Admin Portal</p><h1>{section}</h1><p>{section === "Overview" ? "Current catalogue, stock and order health." : `Manage ${section.toLowerCase()} across the store and till.`}</p></div>{section === "Products" && <button className="button primary" onClick={seedCatalogue} disabled={seeding}>{seeding ? "Importing…" : "Import initial catalogue"}</button>}</div>
        {notice && <p className="notice success-notice">{notice}</p>}{error && <p className="notice error-notice">{error}</p>}
        {loading ? <div className="empty-state"><div className="spinner" /><p>Loading admin data…</p></div> : <>
          {section === "Overview" && <><div className="metric-grid">{metricCards.map(([label, value, note]) => <article className="metric-card" key={label}><p>{label}</p><strong>{value}</strong><span>{note}</span></article>)}</div><div className="admin-panels"><article className="panel"><div className="panel-title"><h2>Attention needed</h2><button onClick={() => { setSection("Products"); setStatus("needs-pricing"); }}>View products</button></div><div className="attention-row"><span className="status-icon warning">!</span><div><b>{data.metrics.needsPricing || 0} products need pricing</b><p>They are stored in Admin but hidden from the storefront and POS.</p></div></div><div className="attention-row"><span className="status-icon danger">↓</span><div><b>{data.metrics.lowStock || 0} products are low in stock</b><p>Review quantities before the next trading period.</p></div></div></article><article className="panel"><div className="panel-title"><h2>Open orders</h2><button onClick={() => setSection("Orders")}>View queue</button></div>{!data.orders.length ? <p className="muted">No orders yet.</p> : data.orders.slice(0, 5).map((order) => <div className="order-row" key={order.orderId}><div><b>{order.customer}</b><span>{order.orderId}</span></div><strong>{money.format(order.total || 0)}</strong><span className="badge warning">{order.status}</span></div>)}</article></div></>}
          {section === "Products" && <><div className="table-tools"><input placeholder="Search name, SKU or category" value={query} onChange={(e) => setQuery(e.target.value)} /><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All products</option><option value="priced">Visible for sale</option><option value="needs-pricing">Needs pricing</option><option value="low">Low stock</option></select><span>{products.length} results</span></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Cost</th><th>Stock</th><th>Status</th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td><b>{product.name}</b><span>{product.id}</span></td><td>{product.category}</td><td className="num">{Number(product.price) > 0 ? money.format(product.price) : "Not set"}</td><td className="num admin-only">{product.costPrice == null ? "—" : money.format(product.costPrice)}</td><td className="num">{product.stock}</td><td><span className={Number(product.price) > 0 ? "badge success" : "badge warning"}>{Number(product.price) > 0 ? "Sellable" : "Needs pricing"}</span></td></tr>)}</tbody></table></div></>}
          {section === "Orders" && <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Order</th><th>Customer</th><th>Channel</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead><tbody>{data.orders.length ? data.orders.map((order) => <tr key={order.orderId}><td><b>{order.orderId}</b></td><td><b>{order.customer}</b><span>{order.phone}</span></td><td>{order.channel}</td><td className="num">{money.format(order.total || 0)}</td><td><span className="badge warning">{order.paymentStatus}</span></td><td><span className="badge neutral">{order.status}</span></td></tr>) : <tr><td colSpan="6" className="empty-cell">No orders yet.</td></tr>}</tbody></table></div>}
          {section === "Inventory" && <><div className="metric-grid compact"><article className="metric-card"><p>Low stock</p><strong>{data.metrics.lowStock || 0}</strong><span>Review and receive stock</span></article><article className="metric-card"><p>Out of stock</p><strong>{data.metrics.outOfStock || 0}</strong><span>Priced products only</span></article></div><div className="panel"><div className="panel-title"><h2>Recent stock movements</h2></div>{data.movements.length ? data.movements.map((movement) => <div className="order-row" key={movement.id}><div><b>{movement.productId}</b><span>{movement.type} · {movement.reason || movement.supplier || "Stock movement"}</span></div><strong>{movement.quantity || movement.qtyChange}</strong></div>) : <p className="muted">No movements recorded yet.</p>}</div></>}
          {!['Overview','Products','Orders','Inventory'].includes(section) && <div className="empty-state section-placeholder"><span className="status-icon">◎</span><h2>{section} workspace</h2><p>The shared data model and permissions are ready. Detailed {section.toLowerCase()} workflows are scheduled for the next milestone.</p></div>}
        </>}
      </section>
    </main>
  </div>;
}

export default function AdminPage() {
  return <RequireRole allow={["owner", "admin", "supervisor"]}><AdminPortal /></RequireRole>;
}
