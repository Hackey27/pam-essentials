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
  const [shift, setShift] = useState(null);
  const [deviceId, setDeviceId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [amountPaid, setAmountPaid] = useState("");
  const [orderReference, setOrderReference] = useState("");
  const [orderChannel, setOrderChannel] = useState("walk-in");

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

  async function loadShift() {
    try {
      const response = await request("/api/pos/shifts");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setShift(data.shift || null);
    } catch (err) { setError(err.message || "Shift status could not be loaded."); }
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
    let storedDevice = localStorage.getItem("pam-pos-device");
    if (!storedDevice) { storedDevice = `PAM-${crypto.randomUUID().slice(0, 8).toUpperCase()}`; localStorage.setItem("pam-pos-device", storedDevice); }
    setDeviceId(storedDevice);
    loadProducts(); loadOrders(); loadShift();
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
  const tendered = paymentMethod === "cash" ? Number(amountPaid || total) : total;
  const changeDue = paymentMethod === "cash" && Number.isFinite(tendered) ? Math.max(0, tendered - total) : 0;

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

  function openOrderAtTill(order) {
    const nextCart = [];
    for (const line of order.items || []) {
      const product = products.find((item) => item.id === line.productId);
      if (!product) { setError(`${line.name} is not available in the current till catalogue.`); return; }
      if (Number(product.stock) < Number(line.quantity)) { setError(`Only ${product.stock} × ${product.name} remain. Resolve stock before taking payment.`); return; }
      nextCart.push({ ...product, quantity: Number(line.quantity) });
    }
    setCart(nextCart);
    setOrderReference(order.orderId);
    setOrderChannel(order.channel || "website");
    setPaymentMethod("cash");
    setAmountPaid("");
    setError("");
    setView("sale");
  }

  async function checkout() {
    if (!cart.length) return;
    if (!shift) { setError("Open a till shift before checkout."); return; }
    if (!online && paymentMethod !== "cash") { setError("Offline sales must be paid in cash. Reconnect before confirming an electronic payment."); return; }
    if (paymentMethod === "cash" && (!Number.isFinite(tendered) || tendered < total)) { setError("Amount paid cannot be less than the total."); return; }
    setBusy(true); setError("");
    const receiptItems = cart.map(({ id, name, quantity, price }) => ({ id, name, quantity, price }));
    const payload = { transactionId: crypto.randomUUID(), paymentMethod, salesChannel: orderChannel, orderReference: orderReference || null, amountPaid: tendered, shiftId: shift.shiftId, deviceId, items: cart.map(({ id, quantity }) => ({ id, quantity })) };
    if (!online) {
      const queue = JSON.parse(localStorage.getItem("pam-pos-queue") || "[]");
      localStorage.setItem("pam-pos-queue", JSON.stringify([...queue, payload]));
      setReceipt({ receiptId: `OFFLINE-${payload.transactionId.slice(0, 8).toUpperCase()}`, total, subtotal, discount, paymentMethod, amountPaid: tendered, change: changeDue, items: receiptItems, orderReference, queued: true });
      setCart([]); setOrderReference(""); setOrderChannel("walk-in"); setAmountPaid(""); setBusy(false); return;
    }
    try {
      const response = await request("/api/pos/sales", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setReceipt({ ...data, subtotal, discount, items: receiptItems, orderReference });
      if (orderReference) {
        const orderResponse = await request("/api/admin/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId: orderReference, status: "paid" }) });
        const orderResult = await orderResponse.json();
        if (!orderResponse.ok) setError(`Sale completed, but the linked order needs attention: ${orderResult.error}`);
      }
      setCart([]); setOrderReference(""); setOrderChannel("walk-in"); setAmountPaid(""); await loadProducts(); await loadOrders();
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

  async function toggleShift() {
    if (shift && JSON.parse(localStorage.getItem("pam-pos-queue") || "[]").length) {
      setError("Sync queued offline sales before closing this shift."); return;
    }
    setBusy(true); setError("");
    try {
      const response = await request("/api/pos/shifts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(shift ? { action: "close", shiftId: shift.shiftId } : { action: "open", deviceId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setShift(shift ? null : data.shift);
      if (shift) setReceipt({ receiptId: "Shift closed", total: data.shift.summary?.salesTotal || 0, shiftSummary: data.shift.summary });
    } catch (err) { setError(err.message || "Shift could not be updated."); }
    finally { setBusy(false); }
  }

  return <div className="pos-shell">
    <header className="pos-header"><div><a href="/" className="admin-brand">PAM <span>Essentials & More</span></a><p>{user?.email} · {role}</p></div><div className="pos-view-tabs"><button className={view === "sale" ? "active" : ""} onClick={() => setView("sale")}>New sale</button><button className={view === "orders" ? "active" : ""} onClick={() => setView("orders")}>Orders {orders.filter((order) => !["completed", "cancelled"].includes(order.status)).length > 0 && <b>{orders.filter((order) => !["completed", "cancelled"].includes(order.status)).length}</b>}</button></div><div className="pos-actions"><button className={shift ? "shift-button open" : "shift-button"} onClick={toggleShift} disabled={busy}>{shift ? "Close shift" : "Open shift"}</button><span className={online ? "connection online" : "connection offline"}>{syncing ? "Syncing sales…" : online ? "Online" : "Offline"}</span><button className="icon-button" onClick={() => { loadProducts(); loadOrders(); loadShift(); }}>↻</button><button className="icon-button" onClick={signOut}>↪</button></div></header>
    {!online && <div className="offline-banner">Working offline. Cash sales will be queued on this device and synced when the connection returns.</div>}
    {view === "sale" ? <main className="pos-main">
      <section className="pos-catalogue"><div className="pos-title"><div><p className="eyebrow">Point of sale · {shift ? shift.shiftId : "No open shift"}</p><h1>New sale</h1></div>{["owner", "admin"].includes(role) && <a className="button secondary" href="/admin">Admin Portal</a>}</div><input className="pos-search" autoFocus placeholder="Search product name, SKU or scan barcode" value={query} onChange={(event) => setQuery(event.target.value)} /><div className="category-pills">{categories.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div>{error && <p className="notice error-notice">{error}</p>}<div className="pos-grid">{visible.map((product) => <button key={product.id} className="pos-product" onClick={() => add(product)} disabled={product.stock <= 0}><span className="product-monogram">{product.name.slice(0, 2).toUpperCase()}</span><b>{product.name}</b><small>{product.id}</small><div><strong>{money.format(product.price)}</strong><span className={product.stock <= product.lowStockLevel ? "low" : ""}>{product.stock} left</span></div></button>)}</div></section>
      <aside className="till-cart"><div className="drawer-title"><div><p className="eyebrow">Current basket</p><h2>{cart.reduce((sum, item) => sum + item.quantity, 0)} items</h2></div><button className="text-button" onClick={() => { setCart([]); setOrderReference(""); setOrderChannel("walk-in"); }}>Clear</button></div>{orderReference && <div className="linked-order"><span>Linked order</span><b>{orderReference}</b><button onClick={() => { setOrderReference(""); setOrderChannel("walk-in"); }}>Detach</button></div>}<div className="till-lines">{cart.length ? cart.map((item) => <div className="till-line" key={item.id}><div><b>{item.name}</b><small>{money.format(item.price)} each</small></div><div className="stepper"><button onClick={() => change(item.id, -1)}>−</button><span>{item.quantity}</span><button onClick={() => change(item.id, 1)}>+</button></div><strong>{money.format(item.price * item.quantity - resolveDiscount(item, item.quantity, discountRules).amount)}</strong></div>) : <div className="empty-state"><span className="status-icon">+</span><h3>No items yet</h3><p>Select products to begin a sale.</p></div>}</div><div className="till-summary"><div><span>Subtotal</span><strong>{money.format(subtotal)}</strong></div><div><span>Discount</span><strong>−{money.format(discount)}</strong></div><div className="grand-total"><span>Total</span><strong>{money.format(total)}</strong></div><div className="payment-methods"><button className={paymentMethod === "cash" ? "active" : ""} onClick={() => setPaymentMethod("cash")}>Cash</button><button className={paymentMethod === "mobile-money" ? "active" : ""} onClick={() => setPaymentMethod("mobile-money")} disabled={!online}>Mobile money</button><button className={paymentMethod === "card" ? "active" : ""} onClick={() => setPaymentMethod("card")} disabled={!online}>Card</button></div>{paymentMethod === "cash" && <label className="amount-paid">Amount paid<input type="number" min={total} step="0.01" placeholder={total.toFixed(2)} value={amountPaid} onChange={(event) => setAmountPaid(event.target.value)} /></label>}{paymentMethod === "cash" && changeDue > 0 && <div className="change-due"><span>Change due</span><strong>{money.format(changeDue)}</strong></div>}<button className="button accent full" onClick={checkout} disabled={!cart.length || busy}>{busy ? "Completing sale…" : online ? `Complete ${paymentMethod.replace("-", " ")} sale` : "Queue cash sale"}</button></div></aside>
    </main> : <main className="pos-orders"><div className="pos-title"><div><p className="eyebrow">All channels</p><h1>Orders</h1></div>{["owner", "admin", "supervisor"].includes(role) && <a className="button secondary" href="/admin">Admin Portal</a>}</div><div className="table-tools"><input placeholder="Search client, phone, reference or time" value={orderQuery} onChange={(event) => setOrderQuery(event.target.value)} /><select value={orderStatus} onChange={(event) => setOrderStatus(event.target.value)}><option value="all">All orders</option><option value="pending-payment">Pending payment</option><option value="pending">Pending</option><option value="processing">Processing</option><option value="ready">Ready</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select><span>{visibleOrders.length} orders</span></div>{error && <p className="notice error-notice">{error}</p>}<div className="order-card-grid">{visibleOrders.map((order) => <article className="panel pos-order" key={order.orderId}><div className="panel-title"><div><b>{order.orderId}</b><p>{new Date(order.createdAt).toLocaleString("en-GH")}</p></div><span className={order.status === "completed" ? "badge success" : order.status === "cancelled" ? "badge danger" : "badge warning"}>{order.status}</span></div><h3>{order.customer}</h3><p>{order.phone} · {order.deliveryMethod}</p>{order.landmark && <p>{order.landmark}</p>}<div className="order-items">{(order.items || []).map((item) => <span key={item.productId}>{item.quantity} × {item.name}</span>)}</div><div className="order-total"><span>{order.paymentStatus === "paid" ? "Paid" : "Pending payment"}</span><strong>{money.format(order.total || 0)}</strong></div><div className="order-actions"><button className="button primary" disabled={busy || ["completed", "cancelled"].includes(order.status)} onClick={() => openOrderAtTill(order)}>Open at till</button><select disabled={busy} value={order.status} onChange={(event) => updateOrder(order.orderId, event.target.value)}>{["pending", "confirmed", "paid", "processing", "ready", "completed", "cancelled"].map((status) => <option key={status}>{status}</option>)}</select></div>{order.pickupCode && <strong className="pickup-code">Code {order.pickupCode}</strong>}</article>)}</div></main>}
    {receipt && <div className="modal-backdrop receipt-backdrop"><div className="modal receipt-modal"><div className="receipt-print"><p className="receipt-brand">PAM Essentials & More</p><span className="success-mark">✓</span><h2>{receipt.shiftSummary ? "Shift closed" : receipt.queued ? "Sale queued" : "Payment complete"}</h2><p>{receipt.shiftSummary ? `${receipt.shiftSummary.transactions} transactions recorded.` : receipt.queued ? "This sale will sync when the device reconnects." : "The sale was recorded and stock was updated."}</p><strong className="order-reference">{receipt.receiptId}</strong>{receipt.orderReference && <p>Order {receipt.orderReference}</p>}{receipt.items?.length > 0 && <div className="receipt-lines">{receipt.items.map((item) => <div key={item.id}><span>{item.quantity} × {item.name}</span><b>{money.format(item.price * item.quantity)}</b></div>)}</div>}{receipt.discount > 0 && <div className="receipt-row"><span>Discount</span><b>−{money.format(receipt.discount)}</b></div>}<div className="receipt-row total"><span>Total</span><b>{money.format(receipt.total || total)}</b></div>{!receipt.shiftSummary && <><div className="receipt-row"><span>{String(receipt.paymentMethod || "cash").replace("-", " ")}</span><b>{money.format(receipt.amountPaid || receipt.total || 0)}</b></div><div className="receipt-row"><span>Change</span><b>{money.format(receipt.change || 0)}</b></div></>}{receipt.shiftSummary?.paymentMix && <div className="receipt-lines">{Object.entries(receipt.shiftSummary.paymentMix).map(([method, value]) => <div key={method}><span>{method.replace("-", " ")}</span><b>{money.format(value)}</b></div>)}</div>}<p className="receipt-thanks">Thank you for shopping with us.</p></div><div className="receipt-actions">{!receipt.queued && <button className="button secondary" onClick={() => window.print()}>Print receipt</button>}<button className="button primary" onClick={() => setReceipt(null)}>{receipt.shiftSummary ? "Done" : "New sale"}</button></div></div></div>}
  </div>;
}

export default function PosPage() {
  return <RequireRole allow={["owner", "admin", "supervisor", "cashier"]}><Till /></RequireRole>;
}
