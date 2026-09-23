"use client";

import { useEffect, useMemo, useState } from "react";
import RequireRole from "@/components/RequireRole";
import { signOut, useAuth } from "@/components/AuthProvider";

const money = new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" });
const whole = new Intl.NumberFormat("en-GH");
const allNav = ["Overview", "Orders", "Products", "Categories", "Inventory", "Discounts", "Staff", "Analytics", "Settings", "Audit"];
const supervisorNav = ["Overview", "Orders", "Inventory"];
const settingKeys = ["STORE_NAME", "STORE_LOCATION", "OPENING_HOURS", "WHATSAPP_NUMBER", "RECEIPT_FOOTER", "DELIVERY_OPTIONS", "DELIVERY_FEE"];
const emptyData = { products: [], orders: [], movements: [], categories: [], discounts: [], settings: {}, users: [], audit: [], sales: [], expenses: [], metrics: {}, permissions: {} };

function dateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-GH", { dateStyle: "medium", timeStyle: "short" });
}

function periodBounds(period) {
  const now = new Date();
  const end = now;
  let start;
  if (period === "today") start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  else if (period === "week") { start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); }
  else if (period === "month") start = new Date(now.getFullYear(), now.getMonth(), 1);
  else return null;
  const duration = end.getTime() - start.getTime();
  return { start, end, previousStart: new Date(start.getTime() - duration), previousEnd: start };
}

function AdminPortal() {
  const { user, role } = useAuth();
  const [section, setSection] = useState("Overview");
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [seeding, setSeeding] = useState(false);
  const [editor, setEditor] = useState(null);
  const [saving, setSaving] = useState(false);
  const [inventory, setInventory] = useState({ type: "receive", productId: "", quantity: "", supplier: "", reason: "", notes: "" });
  const [period, setPeriod] = useState("today");
  const isAdmin = ["owner", "admin"].includes(role);
  const nav = isAdmin ? allNav : supervisorNav;

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
      setData({ ...emptyData, ...payload });
    } catch (err) { setError(err.message || "Admin data could not be loaded."); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [user]);

  async function mutate(url, payload, successMessage) {
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await authorizedFetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setNotice(successMessage);
      setEditor(null);
      await load();
      return result;
    } catch (err) { setError(err.message || "The change could not be saved."); return null; }
    finally { setSaving(false); }
  }

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

  function openEditor(type, item = null) {
    const defaults = {
      product: { create: true, id: "", sku: "", barcode: "", name: "", description: "", categoryId: data.categories[0]?.categoryId || "", price: "", costPrice: "", lowStockLevel: "", openingStock: 0, active: true, archived: false, pinned: false, imageUrl: "" },
      category: { create: true, name: "", description: "", sortOrder: data.categories.length + 1, active: true, archived: false },
      discount: { create: true, ruleId: "", name: "", scopeType: "GLOBAL", scopeId: "", discountType: "PERCENT", value: 5, minQty: 1, priority: 1, active: true, startDate: "", endDate: "" },
      staff: { create: true, email: "", displayName: "", role: "cashier", active: true, temporaryPassword: "" },
      setting: { create: true, key: settingKeys.find((key) => !data.settings[key]) || "STORE_NAME", value: "", description: "" },
      expense: { amount: "", category: "Operating expense", description: "", paymentMethod: "cash" },
    };
    setEditor({ type, data: item ? { ...item, create: false } : defaults[type] });
  }

  function updateEditor(key, value) {
    setEditor((current) => ({ ...current, data: { ...current.data, [key]: value } }));
  }

  async function saveEditor(event) {
    event.preventDefault();
    const paths = { product: "products", category: "categories", discount: "discounts", staff: "staff", setting: "settings", expense: "expenses" };
    const labels = { product: "Product saved.", category: "Category saved.", discount: "Discount rule saved.", staff: "Staff account saved.", setting: "Setting saved.", expense: "Expense recorded." };
    await mutate(`/api/admin/${paths[editor.type]}`, editor.data, labels[editor.type]);
  }

  async function saveInventory(event) {
    event.preventDefault();
    const result = await mutate("/api/admin/inventory", inventory, "Stock movement recorded.");
    if (result) setInventory((current) => ({ ...current, quantity: "", supplier: "", reason: "", notes: "" }));
  }

  async function updateOrder(orderId, nextStatus) {
    await mutate("/api/admin/orders", { orderId, status: nextStatus, confirmPayment: nextStatus === "completed" }, `Order ${orderId} moved to ${nextStatus}.`);
  }

  const products = useMemo(() => data.products.filter((product) => {
    const matches = `${product.name} ${product.id} ${product.sku || ""} ${product.barcode || ""} ${product.category}`.toLowerCase().includes(query.toLowerCase());
    const state = status === "all" || (status === "priced" && Number(product.price) > 0) || (status === "needs-pricing" && !(Number(product.price) > 0)) || (status === "low" && Number(product.stock) <= Number(product.lowStockLevel || 8)) || (status === "archived" && product.archived);
    return matches && state;
  }), [data.products, query, status]);

  const performance = useMemo(() => {
    const bounds = periodBounds(period);
    const productMap = new Map();
    const categoryMap = new Map();
    const sales = bounds ? data.sales.filter((sale) => {
      const createdAt = new Date(sale.createdAt);
      return !Number.isNaN(createdAt.getTime()) && createdAt >= bounds.start && createdAt <= bounds.end;
    }) : data.sales;
    for (const sale of sales) for (const line of sale.items || []) {
      const product = productMap.get(line.productId) || { name: line.name, quantity: 0, revenue: 0 };
      product.quantity += Number(line.quantity || 0); product.revenue += Number(line.lineTotal || 0); productMap.set(line.productId, product);
      const category = line.categorySnapshot?.name || line.categorySnapshot || "Uncategorised";
      const summary = categoryMap.get(category) || { quantity: 0, revenue: 0 };
      summary.quantity += Number(line.quantity || 0); summary.revenue += Number(line.lineTotal || 0); categoryMap.set(category, summary);
    }
    return { products: [...productMap].sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 10), categories: [...categoryMap].sort((a, b) => b[1].revenue - a[1].revenue) };
  }, [data.sales, period]);

  const periodReport = useMemo(() => {
    const bounds = periodBounds(period);
    const include = (item, start, end) => {
      const value = new Date(item.createdAt);
      return !Number.isNaN(value.getTime()) && value >= start && value <= end;
    };
    const summarize = (sales, expenses) => ({
      sales: sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0),
      profit: sales.reduce((sum, sale) => sum + Number(sale.profit || 0), 0),
      expenses: expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
      transactions: sales.length,
      unitsSold: sales.reduce((sum, sale) => sum + (sale.items || []).reduce((qty, item) => qty + Number(item.quantity || 0), 0), 0),
    });
    const current = bounds ? summarize(data.sales.filter((item) => include(item, bounds.start, bounds.end)), data.expenses.filter((item) => include(item, bounds.start, bounds.end))) : summarize(data.sales, data.expenses);
    const previous = bounds ? summarize(data.sales.filter((item) => include(item, bounds.previousStart, bounds.previousEnd)), data.expenses.filter((item) => include(item, bounds.previousStart, bounds.previousEnd))) : null;
    current.netProfit = current.profit - current.expenses;
    return { current, previous };
  }, [data.sales, data.expenses, period]);

  function comparison(key) {
    if (!periodReport.previous) return "All recorded activity";
    const previous = Number(periodReport.previous[key] || 0);
    const current = Number(periodReport.current[key] || 0);
    if (!previous) return current ? "No activity in previous period" : "No change";
    const change = Math.round(((current - previous) / Math.abs(previous)) * 100);
    return `${change >= 0 ? "+" : ""}${change}% vs previous period`;
  }

  const metricCards = isAdmin ? [
    ["Sales", money.format(periodReport.current.sales), comparison("sales")],
    ["Gross profit", money.format(periodReport.current.profit), comparison("profit")],
    ["Expenses", money.format(periodReport.current.expenses), comparison("expenses")],
    ["Net profit", money.format(periodReport.current.netProfit), "Profit less expenses"],
    ["Transactions", whole.format(periodReport.current.transactions), comparison("transactions")],
    ["Units sold", whole.format(periodReport.current.unitsSold), comparison("unitsSold")],
  ] : [
    ["Products", data.metrics.products || 0, "Catalogue records"],
    ["Low stock", data.metrics.lowStock || 0, "At or below threshold"],
    ["Out of stock", data.metrics.outOfStock || 0, "Priced products"],
    ["Open orders", data.metrics.openOrders || 0, "Needs fulfilment"],
  ];

  const primaryAction = {
    Products: <><button className="button secondary" onClick={seedCatalogue} disabled={seeding}>{seeding ? "Importing…" : "Import catalogue"}</button><button className="button primary" onClick={() => openEditor("product")}>New product</button></>,
    Categories: <button className="button primary" onClick={() => openEditor("category")}>New category</button>,
    Discounts: <button className="button primary" onClick={() => openEditor("discount")}>New rule</button>,
    Staff: <button className="button primary" onClick={() => openEditor("staff")}>New staff account</button>,
    Settings: <button className="button primary" onClick={() => openEditor("setting")}>Add store setting</button>,
    Analytics: <button className="button primary" onClick={() => openEditor("expense")}>Record expense</button>,
  }[section];

  return <div className="admin-shell">
    <aside className="admin-sidebar"><div><a className="admin-brand" href="/">PAM <span>Essentials & More</span></a><p className="admin-user">{user?.email}<br /><b>{role}</b></p></div><nav>{nav.map((item) => <button key={item} onClick={() => setSection(item)} className={section === item ? "active" : ""}><span className="nav-dot" /><span>{item}</span>{item === "Orders" && data.metrics.openOrders > 0 && <b>{data.metrics.openOrders}</b>}{item === "Inventory" && data.metrics.lowStock > 0 && <b>{data.metrics.lowStock}</b>}</button>)}</nav><div className="sidebar-actions"><a href="/pos">Open till</a><a href="/">View store</a></div></aside>
    <main className="admin-main">
      <header className="admin-topbar"><div><p>PAM Essentials & More Admin</p><span>{user?.email}</span></div><div><button className="icon-button" onClick={load} aria-label="Refresh">↻</button><button className="icon-button" onClick={signOut} aria-label="Sign out">↪</button></div></header>
      <section className="admin-content">
        <div className="page-title"><div><p className="eyebrow">Admin Portal</p><h1>{section}</h1><p>{section === "Overview" ? "Current sales, stock and order health." : `Manage ${section.toLowerCase()} across the store and till.`}</p></div><div className="page-actions">{isAdmin && ["Overview", "Analytics"].includes(section) && <select aria-label="Reporting period" value={period} onChange={(event) => setPeriod(event.target.value)}><option value="today">Today</option><option value="week">This week</option><option value="month">This month</option><option value="all">All time</option></select>}{primaryAction}</div></div>
        {notice && <p className="notice success-notice">{notice}</p>}{error && <p className="notice error-notice">{error}</p>}
        {loading ? <div className="empty-state"><div className="spinner" /><p>Loading admin data…</p></div> : <>
          {section === "Overview" && <><div className="metric-grid">{metricCards.map(([label, value, note]) => <article className="metric-card" key={label}><p>{label}</p><strong>{value}</strong><span>{note}</span></article>)}</div><div className="admin-panels"><article className="panel"><div className="panel-title"><h2>Attention needed</h2>{isAdmin && <button onClick={() => { setSection("Products"); setStatus("needs-pricing"); }}>View products</button>}</div>{isAdmin && <div className="attention-row"><span className="status-icon warning">!</span><div><b>{data.metrics.needsPricing || 0} products need pricing</b><p>Stored in Admin; hidden from storefront and POS.</p></div></div>}<div className="attention-row"><span className="status-icon danger">↓</span><div><b>{data.metrics.lowStock || 0} products are low in stock</b><p>Review quantities before the next trading period.</p></div></div></article><article className="panel"><div className="panel-title"><h2>Open orders</h2><button onClick={() => setSection("Orders")}>View queue</button></div>{!data.orders.length ? <p className="muted">No orders yet.</p> : data.orders.filter((order) => !["completed", "cancelled"].includes(order.status)).slice(0, 5).map((order) => <div className="order-row" key={order.orderId}><div><b>{order.customer}</b><span>{order.orderId}</span></div><strong>{money.format(order.total || 0)}</strong><span className="badge warning">{order.status}</span></div>)}</article></div></>}

          {section === "Products" && <><div className="table-tools"><input placeholder="Search name, SKU or barcode" value={query} onChange={(event) => setQuery(event.target.value)} /><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All products</option><option value="priced">Visible for sale</option><option value="needs-pricing">Needs pricing</option><option value="low">Low stock</option><option value="archived">Archived</option></select><span>{products.length} results</span></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Cost</th><th>Stock</th><th>Status</th><th>Action</th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td><b>{product.name}</b><span>{product.id}{product.barcode ? ` · ${product.barcode}` : ""}</span></td><td>{product.category}</td><td className="num">{Number(product.price) > 0 ? money.format(product.price) : "Not set"}</td><td className="num admin-only">{product.costPrice == null ? "—" : money.format(product.costPrice)}</td><td className="num">{product.stock}</td><td><span className={product.archived ? "badge danger" : Number(product.price) > 0 ? "badge success" : "badge warning"}>{product.archived ? "Archived" : Number(product.price) > 0 ? "Sellable" : "Needs pricing"}</span></td><td><button className="table-action" onClick={() => openEditor("product", product)}>Edit</button></td></tr>)}</tbody></table></div></>}

          {section === "Categories" && <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Category</th><th>Description</th><th>Sort</th><th>Status</th><th>Action</th></tr></thead><tbody>{data.categories.map((category) => <tr key={category.categoryId}><td><b>{category.name}</b><span>{category.categoryId}</span></td><td>{category.description || "—"}</td><td className="num">{category.sortOrder}</td><td><span className={category.active ? "badge success" : "badge danger"}>{category.active ? "Active" : "Inactive"}</span></td><td><button className="table-action" onClick={() => openEditor("category", category)}>Edit</button></td></tr>)}</tbody></table></div>}

          {section === "Inventory" && <><div className="inventory-layout"><form className="panel admin-form" onSubmit={saveInventory}><div className="panel-title"><h2>{inventory.type === "receive" ? "Receive stock" : "Adjust stock"}</h2></div><div className="segmented"><button type="button" className={inventory.type === "receive" ? "active" : ""} onClick={() => setInventory({ ...inventory, type: "receive" })}>Receive</button>{isAdmin && <button type="button" className={inventory.type === "adjust" ? "active" : ""} onClick={() => setInventory({ ...inventory, type: "adjust" })}>Adjust</button>}</div><label>Product<select required value={inventory.productId} onChange={(event) => setInventory({ ...inventory, productId: event.target.value })}><option value="">Choose product</option>{data.products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.stock} in stock</option>)}</select></label><label>{inventory.type === "receive" ? "Quantity received" : "Quantity change (+ or −)"}<input required type="number" value={inventory.quantity} onChange={(event) => setInventory({ ...inventory, quantity: event.target.value })} /></label>{inventory.type === "receive" ? <label>Supplier<input required value={inventory.supplier} onChange={(event) => setInventory({ ...inventory, supplier: event.target.value })} /></label> : <label>Reason<select required value={inventory.reason} onChange={(event) => setInventory({ ...inventory, reason: event.target.value })}><option value="">Choose reason</option><option>Damage</option><option>Shrinkage</option><option>Count correction</option><option>Return</option></select></label>}<label>Notes<textarea value={inventory.notes} onChange={(event) => setInventory({ ...inventory, notes: event.target.value })} /></label><button className="button primary" disabled={saving}>{saving ? "Saving…" : "Record movement"}</button></form><div className="metric-grid compact"><article className="metric-card"><p>Low stock</p><strong>{data.metrics.lowStock || 0}</strong><span>At or below threshold</span></article><article className="metric-card"><p>Out of stock</p><strong>{data.metrics.outOfStock || 0}</strong><span>Priced products</span></article>{isAdmin && <article className="metric-card"><p>Stock valuation</p><strong>{money.format(data.metrics.stockValuation || 0)}</strong><span>Admin only</span></article>}</div></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Date</th><th>Product</th><th>Type</th><th>Change</th><th>Stock</th><th>Staff</th></tr></thead><tbody>{data.movements.length ? data.movements.map((movement) => <tr key={movement.id}><td>{dateTime(movement.createdAt)}</td><td><b>{movement.productName || movement.productId}</b><span>{movement.productId}</span></td><td>{movement.type}</td><td className="num">{Number(movement.quantity || movement.qtyChange) > 0 ? "+" : ""}{movement.quantity || movement.qtyChange}</td><td className="num">{movement.oldStock ?? "—"} → {movement.newStock ?? "—"}</td><td>{movement.staffEmail || movement.staff}</td></tr>) : <tr><td colSpan="6" className="empty-cell">No movements recorded yet.</td></tr>}</tbody></table></div></>}

          {section === "Orders" && <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Order</th><th>Customer</th><th>Fulfilment</th><th>Total</th><th>Payment</th><th>Status</th><th>Update</th></tr></thead><tbody>{data.orders.length ? data.orders.map((order) => <tr key={order.orderId}><td><b>{order.orderId}</b><span>{dateTime(order.createdAt)}{order.pickupCode ? ` · Code ${order.pickupCode}` : ""}</span></td><td><b>{order.customer}</b><span>{order.phone}</span></td><td>{order.deliveryMethod}<span>{order.landmark || order.channel}</span></td><td className="num">{money.format(order.total || 0)}</td><td><span className={order.paymentStatus === "paid" ? "badge success" : "badge neutral"}>{order.paymentStatus}</span></td><td><span className={order.status === "completed" ? "badge success" : order.status === "cancelled" ? "badge danger" : "badge warning"}>{order.status}</span></td><td><select aria-label={`Update ${order.orderId}`} value={order.status} onChange={(event) => updateOrder(order.orderId, event.target.value)}>{["pending", "confirmed", "paid", "processing", "ready", "completed", "cancelled"].map((value) => <option key={value}>{value}</option>)}</select></td></tr>) : <tr><td colSpan="7" className="empty-cell">No orders yet.</td></tr>}</tbody></table></div>}

          {section === "Discounts" && <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Rule</th><th>Scope</th><th>Discount</th><th>Minimum</th><th>Priority</th><th>Status</th><th>Action</th></tr></thead><tbody>{data.discounts.map((rule) => <tr key={rule.ruleId}><td><b>{rule.name}</b><span>{rule.ruleId}</span></td><td>{rule.scopeType}<span>{rule.scopeId || "All products"}</span></td><td>{rule.discountType === "PERCENT" ? `${rule.value}%` : money.format(rule.value)}</td><td className="num">{rule.minQty}</td><td className="num">{rule.priority}</td><td><span className={rule.active ? "badge success" : "badge danger"}>{rule.active ? "Active" : "Inactive"}</span></td><td><button className="table-action" onClick={() => openEditor("discount", rule)}>Edit</button></td></tr>)}</tbody></table></div>}

          {section === "Staff" && <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Staff member</th><th>Role</th><th>Status</th><th>Action</th></tr></thead><tbody>{data.users.map((staff) => <tr key={staff.id}><td><b>{staff.displayName || staff.email}</b><span>{staff.email}</span></td><td>{staff.role}</td><td><span className={staff.active ? "badge success" : "badge danger"}>{staff.active ? "Active" : "Inactive"}</span></td><td><button className="table-action" onClick={() => openEditor("staff", { ...staff, uid: staff.id })}>Edit</button></td></tr>)}</tbody></table></div>}

          {section === "Analytics" && <><div className="metric-grid">{metricCards.map(([label, value, note]) => <article className="metric-card" key={label}><p>{label}</p><strong>{value}</strong><span>{note}</span></article>)}</div><div className="admin-panels"><article className="panel"><div className="panel-title"><h2>Top products</h2></div>{performance.products.length ? performance.products.map(([id, value]) => <div className="order-row" key={id}><div><b>{value.name}</b><span>{value.quantity} units</span></div><strong>{money.format(value.revenue)}</strong></div>) : <p className="muted">Sales will appear here after checkout.</p>}</article><article className="panel"><div className="panel-title"><h2>Category performance</h2></div>{performance.categories.length ? performance.categories.map(([name, value]) => <div className="order-row" key={name}><div><b>{name}</b><span>{value.quantity} units</span></div><strong>{money.format(value.revenue)}</strong></div>) : <p className="muted">No category sales yet.</p>}</article><article className="panel"><div className="panel-title"><h2>Recent expenses</h2></div>{data.expenses.length ? data.expenses.slice(0, 10).map((expense) => <div className="order-row" key={expense.id}><div><b>{expense.description}</b><span>{expense.category} · {dateTime(expense.createdAt)}</span></div><strong>{money.format(expense.amount)}</strong></div>) : <p className="muted">No expenses recorded.</p>}</article></div></>}

          {section === "Settings" && <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Setting</th><th>Value</th><th>Description</th><th>Action</th></tr></thead><tbody>{Object.values(data.settings).map((setting) => <tr key={setting.key}><td><b>{setting.key}</b></td><td>{String(setting.value ?? "")}</td><td>{setting.description || "—"}</td><td><button className="table-action" onClick={() => openEditor("setting", setting)}>Edit</button></td></tr>)}</tbody></table></div>}

          {section === "Audit" && <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Timestamp</th><th>Admin</th><th>Action</th><th>Entity</th><th>Description</th></tr></thead><tbody>{data.audit.map((entry) => <tr key={entry.id}><td>{dateTime(entry.timestamp)}</td><td>{entry.adminEmail || entry.admin}</td><td>{entry.action}</td><td><b>{entry.entityType}</b><span>{entry.entityId}</span></td><td>{entry.description}</td></tr>)}</tbody></table></div>}
        </>}
      </section>
    </main>
    {editor && <div className="modal-backdrop"><form className="modal editor-modal admin-form" onSubmit={saveEditor}><div className="drawer-title"><div><p className="eyebrow">{editor.data.create ? "Create" : "Edit"}</p><h2>{editor.type}</h2></div><button type="button" className="icon-button" onClick={() => setEditor(null)}>×</button></div><EditorFields editor={editor} update={updateEditor} data={data} currentRole={role} /><div className="editor-actions"><button type="button" className="button secondary" onClick={() => setEditor(null)}>Cancel</button><button className="button primary" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button></div></form></div>}
  </div>;
}

function EditorFields({ editor, update, data, currentRole }) {
  const value = editor.data;
  if (editor.type === "product") return <>
    <fieldset><legend>Identity</legend><label>Product ID<input required disabled={!value.create} value={value.id || ""} onChange={(event) => update("id", event.target.value)} /></label><label>Name<input required value={value.name || ""} onChange={(event) => update("name", event.target.value)} /></label><div className="form-grid"><label>SKU<input value={value.sku || ""} onChange={(event) => update("sku", event.target.value)} /></label><label>Barcode<input value={value.barcode || ""} onChange={(event) => update("barcode", event.target.value)} /></label></div><label>Description<textarea value={value.description || ""} onChange={(event) => update("description", event.target.value)} /></label></fieldset>
    <fieldset><legend>Pricing · Admin only</legend><div className="form-grid"><label>Selling price<input type="number" min="0" step="0.01" value={value.price ?? ""} onChange={(event) => update("price", event.target.value)} /></label><label>Cost price<input type="number" min="0" step="0.01" value={value.costPrice ?? ""} onChange={(event) => update("costPrice", event.target.value)} /></label></div></fieldset>
    <fieldset><legend>Classification</legend><label>Category<select required value={value.categoryId || ""} onChange={(event) => update("categoryId", event.target.value)}>{data.categories.map((category) => <option key={category.categoryId} value={category.categoryId}>{category.name}</option>)}</select></label><div className="form-grid"><label>Low-stock level<input type="number" min="0" value={value.lowStockLevel ?? ""} onChange={(event) => update("lowStockLevel", event.target.value)} /></label>{value.create && <label>Opening stock<input type="number" min="0" value={value.openingStock || 0} onChange={(event) => update("openingStock", event.target.value)} /></label>}</div><label>Primary image URL<input type="url" value={value.imageUrl || ""} onChange={(event) => update("imageUrl", event.target.value)} /></label><div className="toggle-row"><label><input type="checkbox" checked={value.pinned || false} onChange={(event) => update("pinned", event.target.checked)} /> Pinned / high-demand</label><label><input type="checkbox" checked={value.active !== false} onChange={(event) => update("active", event.target.checked)} /> Active</label><label><input type="checkbox" checked={value.archived || false} onChange={(event) => update("archived", event.target.checked)} /> Archived</label></div></fieldset>
  </>;
  if (editor.type === "category") return <><label>Name<input required value={value.name || ""} onChange={(event) => update("name", event.target.value)} /></label><label>Description<textarea value={value.description || ""} onChange={(event) => update("description", event.target.value)} /></label><label>Sort order<input type="number" min="0" value={value.sortOrder || 0} onChange={(event) => update("sortOrder", event.target.value)} /></label><div className="toggle-row"><label><input type="checkbox" checked={value.active !== false} onChange={(event) => update("active", event.target.checked)} /> Active</label><label><input type="checkbox" checked={value.archived || false} onChange={(event) => update("archived", event.target.checked)} /> Archived</label></div></>;
  if (editor.type === "discount") return <><div className="form-grid"><label>Rule ID<input disabled={!value.create} value={value.ruleId || ""} onChange={(event) => update("ruleId", event.target.value)} /></label><label>Name<input required value={value.name || ""} onChange={(event) => update("name", event.target.value)} /></label></div><div className="form-grid"><label>Scope<select value={value.scopeType} onChange={(event) => update("scopeType", event.target.value)}><option>GLOBAL</option><option>CATEGORY</option><option>PRODUCT</option></select></label>{value.scopeType !== "GLOBAL" && <label>Scope item<select required value={value.scopeId || ""} onChange={(event) => update("scopeId", event.target.value)}><option value="">Choose item</option>{(value.scopeType === "CATEGORY" ? data.categories : data.products).map((item) => <option key={item.categoryId || item.id} value={item.categoryId || item.id}>{item.name}</option>)}</select></label>}</div><div className="form-grid"><label>Type<select value={value.discountType} onChange={(event) => update("discountType", event.target.value)}><option>PERCENT</option><option>FIXED_AMOUNT</option></select></label><label>Value<input required type="number" min="0" step="0.01" value={value.value ?? ""} onChange={(event) => update("value", event.target.value)} /></label></div><div className="form-grid"><label>Minimum quantity<input type="number" min="1" value={value.minQty || 1} onChange={(event) => update("minQty", event.target.value)} /></label><label>Priority<input type="number" value={value.priority || 0} onChange={(event) => update("priority", event.target.value)} /></label></div><div className="form-grid"><label>Start date<input type="date" value={value.startDate?.slice?.(0, 10) || ""} onChange={(event) => update("startDate", event.target.value)} /></label><label>End date<input type="date" value={value.endDate?.slice?.(0, 10) || ""} onChange={(event) => update("endDate", event.target.value)} /></label></div><div className="toggle-row"><label><input type="checkbox" checked={value.active !== false} onChange={(event) => update("active", event.target.checked)} /> Active</label></div></>;
  if (editor.type === "staff") return <><label>Email<input required disabled={!value.create} type="email" value={value.email || ""} onChange={(event) => update("email", event.target.value)} /></label><label>Display name<input required value={value.displayName || ""} onChange={(event) => update("displayName", event.target.value)} /></label>{value.create && <label>Temporary password<input required minLength="8" type="password" autoComplete="new-password" value={value.temporaryPassword || ""} onChange={(event) => update("temporaryPassword", event.target.value)} /></label>}<label>Role<select value={value.role || "cashier"} onChange={(event) => update("role", event.target.value)}><option value="cashier">Cashier</option><option value="supervisor">Supervisor</option><option value="admin">Admin</option>{currentRole === "owner" && <option value="owner">Owner</option>}</select></label><div className="toggle-row"><label><input type="checkbox" checked={value.active !== false} onChange={(event) => update("active", event.target.checked)} /> Active account</label></div></>;
  if (editor.type === "setting") return <><label>Key{value.create ? <select value={value.key || ""} onChange={(event) => update("key", event.target.value)}>{settingKeys.filter((key) => !data.settings[key]).map((key) => <option key={key}>{key}</option>)}</select> : <input disabled value={value.key || ""} />}</label><label>Value{typeof value.value === "boolean" ? <select value={String(value.value)} onChange={(event) => update("value", event.target.value === "true")}><option value="true">True</option><option value="false">False</option></select> : <input value={value.value ?? ""} onChange={(event) => update("value", event.target.value)} />}</label><label>Description<textarea value={value.description || ""} onChange={(event) => update("description", event.target.value)} /></label></>;
  if (editor.type === "expense") return <><div className="form-grid"><label>Amount<input required type="number" min="0.01" step="0.01" value={value.amount || ""} onChange={(event) => update("amount", event.target.value)} /></label><label>Payment method<select value={value.paymentMethod || "cash"} onChange={(event) => update("paymentMethod", event.target.value)}><option value="cash">Cash</option><option value="mobile-money">Mobile money</option><option value="bank">Bank</option><option value="other">Other</option></select></label></div><label>Category<input required value={value.category || ""} onChange={(event) => update("category", event.target.value)} /></label><label>Description<textarea required value={value.description || ""} onChange={(event) => update("description", event.target.value)} /></label></>;
  return null;
}

export default function AdminPage() {
  return <RequireRole allow={["owner", "admin", "supervisor"]}><AdminPortal /></RequireRole>;
}
