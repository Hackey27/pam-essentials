"use client";

import { useEffect, useMemo, useState } from "react";
import RequireRole from "@/components/RequireRole";
import { signOut, useAuth } from "@/components/AuthProvider";
import { resolveDiscount } from "@/lib/commerce";

const money = new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" });

function Till() {
  const { user, role } = useAuth();
  const [products, setProducts] = useState([]);
  const [discountRules, setDiscountRules] = useState([]);
  const [orders, setOrders] = useState([]);
  const [view, setView] = useState("sale");
  const [orderQuery, setOrderQuery] = useState("");
  const [orderStatus, setOrderStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [cart, setCart] = useState([]);
  const [online, setOnline] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [receipt, setReceipt] = useState(null);

  async function request(url, options = {}) {
    const token = await user.getIdToken();
    return fetch(url, { ...options, headers: { ...(options.headers || {}), authorization: `Bearer ${token}` } });
  }

  async function loadProducts() {
    try {
      const response = await request("/api/pos/products");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setProducts(data.products || []);
      setDiscountRules(data.discountRules || []);
      localStorage.setItem("pam-pos-catalogue", JSON.stringify({ products: data.products || [], discountRules: data.discountRules || [] }));
    } catch (err) {
      const cached = JSON.parse(localStorage.getItem("pam-pos-catalogue") || "{}");
      setProducts(cached.products || []);
      setDiscountRules(cached.discountRules || []);
      if (!cached.products?.length) setError(err.message || "Products could not be loaded.");
    }
  }

  async function loadOrders() {
    try {
      const response = await request("/api/pos/orders");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setOrders(data.orders || []);
    } catch (err) { setError(err.message || "Orders could not be loaded."); }
  }

  async function flushQueue() {
    const queued = JSON.parse(localStorage.getItem("pam-pos-queue") || "[]");
    if (!queued.length) return;

    setSyncing(true);
    for (let index = 0; index < queued.length; index += 1) {
      try {
        const response = await request("/api/pos/sales", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(queued[index]),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        localStorage.setItem("pam-pos-queue", JSON.stringify(queued.slice(index + 1)));
      } catch (err) {
        setError(`An offline sale still needs attention: ${err.message || "sync failed."}`);
        setSyncing(false);
        return;
      }
    }
    setError("");
    setSyncing(false);
    await loadProducts();
  }

  useEffect(() => {
    if (!user) return;
    loadProducts(); loadOrders();
    const update = () => {
      const connected = navigator.onLine;
      setOnline(connected);
      if (connected) flushQueue();
    };
    update(); window.addEventListener("online", update); window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, [user]);

  const categories = useMemo(() => ["All", ...new Set(products.map((product) => product.category))], [products]);
  const visible = useMemo(() => products.filter((product) => (category === "All" || product.category === category) && `${product.name} ${product.id}`.toLowerCase().includes(query.toLowerCase())), [products, query, category]);
  const visibleOrders = useMemo(() => orders.filter((order) => {
    const matches = `${order.customer} ${order.phone} ${order.orderId} ${order.createdAt}`.toLowerCase().includes(orderQuery.toLowerCase());
    const state = orderStatus === "all" || order.status === orderStatus || (orderStatus === "pending-payment" && order.paymentStatus !== "paid");
    return matches && state;
  }), [orders, orderQuery, orderStatus]);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discount = cart.reduce((sum, item) => sum + resolveDiscount(item, item.quantity, discountRules).amount, 0);
  const total = subtotal - discount;

  function add(product) {
    if (product.stock <= 0) return;
    setCart((current) => {
      const found = current.find((item) => item.id === product.id);
      if (found && found.quantity < product.stock) return current.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      return found ? current : [...current, { ...product, quantity: 1 }];
    });
  }

  function change(id, delta) {
    setCart((current) => current.map((item) => item.id === id ? { ...item, quantity: Math.min(item.stock, Math.max(0, item.quantity + delta)) } : item).filter((item) => item.quantity));
  }

  async function checkout() {
    if (!cart.length) return;
    setBusy(true); setError("");
    const payload = { transactionId: crypto.randomUUID(), paymentMethod: "cash", salesChannel: "walk-in", amountPaid: total, items: cart.map(({ id, quantity }) => ({ id, quantity })) };
    if (!online) {
      const queue = JSON.parse(localStorage.getItem("pam-pos-queue") || "[]");
      localStorage.setItem("pam-pos-queue", JSON.stringify([...queue, payload]));
      setReceipt({ receiptId: `OFFLINE-${payload.transactionId.slice(0, 8).toUpperCase()}`, total, queued: true });
      setCart([]); setBusy(false); return;
    }
    try {
      const response = await request("/api/pos/sales", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setReceipt(data); setCart([]); await loadProducts();
    } catch (err) { setError(err.message || "Checkout failed."); }
    finally { setBusy(false); }
  }

  async function updateOrder(orderId, status) {
    setBusy(true); setError("");
    try {
      const response = await request("/api/admin/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId, status, confirmPayment: status === "completed" }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      await loadOrders();
    } catch (err) { setError(err.message || "Order could not be updated."); }
    finally { setBusy(false); }
  }

  return <div className="pos-shell">
    <header className="pos-header"><div><a href="/" className="admin-brand">PAM <span>Essentials & More</span></a><p>{user?.email} · {role}</p></div><div className="pos-view-tabs"><button className={view === "sale" ? "active" : ""} onClick={() => setView("sale")}>New sale</button><button className={view === "orders" ? "active" : ""} onClick={() => setView("orders")}>Orders {orders.filter((order) => !["completed", "cancelled"].includes(order.status)).length > 0 && <b>{orders.filter((order) => !["completed", "cancelled"].includes(order.status)).length}</b>}</button></div><div className="pos-actions"><span className={online ? "connection online" : "connection offline"}>{syncing ? "Syncing sales…" : online ? "Online" : "Offline"}</span><button className="icon-button" onClick={() => { loadProducts(); loadOrders(); }}>↻</button><button className="icon-button" onClick={signOut}>↪</button></div></header>
    {!online && <div className="offline-banner">Working offline. Cash sales will be queued on this device and synced when the connection returns.</div>}
    {view === "sale" ? <main className="pos-main">
      <section className="pos-catalogue"><div className="pos-title"><div><p className="eyebrow">Point of sale</p><h1>New sale</h1></div>{["owner", "admin"].includes(role) && <a className="button secondary" href="/admin">Admin Portal</a>}</div><input className="pos-search" autoFocus placeholder="Search product name, SKU or scan barcode" value={query} onChange={(event) => setQuery(event.target.value)} /><div className="category-pills">{categories.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div>{error && <p className="notice error-notice">{error}</p>}<div className="pos-grid">{visible.map((product) => <button key={product.id} className="pos-product" onClick={() => add(product)} disabled={product.stock <= 0}><span className="product-monogram">{product.name.slice(0, 2).toUpperCase()}</span><b>{product.name}</b><small>{product.id}</small><div><strong>{money.format(product.price)}</strong><span className={product.stock <= product.lowStockLevel ? "low" : ""}>{product.stock} left</span></div></button>)}</div></section>
      <aside className="till-cart"><div className="drawer-title"><div><p className="eyebrow">Current basket</p><h2>{cart.reduce((sum, item) => sum + item.quantity, 0)} items</h2></div><button className="text-button" onClick={() => setCart([])}>Clear</button></div><div className="till-lines">{cart.length ? cart.map((item) => <div className="till-line" key={item.id}><div><b>{item.name}</b><small>{money.format(item.price)} each</small></div><div className="stepper"><button onClick={() => change(item.id, -1)}>−</button><span>{item.quantity}</span><button onClick={() => change(item.id, 1)}>+</button></div><strong>{money.format(item.price * item.quantity - resolveDiscount(item, item.quantity, discountRules).amount)}</strong></div>) : <div className="empty-state"><span className="status-icon">+</span><h3>No items yet</h3><p>Select products to begin a sale.</p></div>}</div><div className="till-summary"><div><span>Subtotal</span><strong>{money.format(subtotal)}</strong></div><div><span>Discount</span><strong>−{money.format(discount)}</strong></div><div className="grand-total"><span>Total</span><strong>{money.format(total)}</strong></div><button className="button accent full" onClick={checkout} disabled={!cart.length || busy}>{busy ? "Completing sale…" : online ? "Cash checkout" : "Queue cash sale"}</button></div></aside>
    </main> : <main className="pos-orders"><div className="pos-title"><div><p className="eyebrow">All channels</p><h1>Orders</h1></div>{["owner", "admin", "supervisor"].includes(role) && <a className="button secondary" href="/admin">Admin Portal</a>}</div><div className="table-tools"><input placeholder="Search client, phone, reference or time" value={orderQuery} onChange={(event) => setOrderQuery(event.target.value)} /><select value={orderStatus} onChange={(event) => setOrderStatus(event.target.value)}><option value="all">All orders</option><option value="pending-payment">Pending payment</option><option value="pending">Pending</option><option value="processing">Processing</option><option value="ready">Ready</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select><span>{visibleOrders.length} orders</span></div>{error && <p className="notice error-notice">{error}</p>}<div className="order-card-grid">{visibleOrders.map((order) => <article className="panel pos-order" key={order.orderId}><div className="panel-title"><div><b>{order.orderId}</b><p>{new Date(order.createdAt).toLocaleString("en-GH")}</p></div><span className={order.status === "completed" ? "badge success" : order.status === "cancelled" ? "badge danger" : "badge warning"}>{order.status}</span></div><h3>{order.customer}</h3><p>{order.phone} · {order.deliveryMethod}</p>{order.landmark && <p>{order.landmark}</p>}<div className="order-items">{(order.items || []).map((item) => <span key={item.productId}>{item.quantity} × {item.name}</span>)}</div><div className="order-total"><span>{order.paymentStatus === "paid" ? "Paid" : "Pending payment"}</span><strong>{money.format(order.total || 0)}</strong></div><select disabled={busy} value={order.status} onChange={(event) => updateOrder(order.orderId, event.target.value)}>{["pending", "confirmed", "paid", "processing", "ready", "completed", "cancelled"].map((status) => <option key={status}>{status}</option>)}</select>{order.pickupCode && <strong className="pickup-code">Code {order.pickupCode}</strong>}</article>)}</div></main>}
    {receipt && <div className="modal-backdrop"><div className="modal"><span className="success-mark">✓</span><h2>{receipt.queued ? "Sale queued" : "Payment complete"}</h2><p>{receipt.queued ? "This sale will sync when the device reconnects." : "The sale was recorded and stock was updated."}</p><strong className="order-reference">{receipt.receiptId}</strong><p className="receipt-total">{money.format(receipt.total || total)}</p><button className="button primary full" onClick={() => setReceipt(null)}>New sale</button></div></div>}
  </div>;
}

export default function PosPage() {
  return <RequireRole allow={["owner", "admin", "supervisor", "cashier"]}><Till /></RequireRole>;
}
