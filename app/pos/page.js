"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import RequireRole from "@/components/RequireRole";
import { signOut, useAuth } from "@/components/AuthProvider";
import PosDashboard from "@/components/PosDashboard";
import PosTill from "@/components/PosTill";
import { priceCart } from "@/lib/commerce";
import { SHOP_ADDRESS } from "@/lib/shop";

const money = new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" });

function Till() {
  const { user, role } = useAuth();
  const [products, setProducts] = useState([]);
  const [categoryList, setCategoryList] = useState([]);
  const [discountRules, setDiscountRules] = useState([]);
  const [dealBundles, setDealBundles] = useState([]);
  const [orders, setOrders] = useState([]);
  const [view, setView] = useState("dashboard");
  const [shiftLoaded, setShiftLoaded] = useState(false);
  const [locked, setLocked] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);
  const [staffEmail, setStaffEmail] = useState(user?.email || "");
  const [staffPassword, setStaffPassword] = useState("");
  const [confirmEndShift, setConfirmEndShift] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [clock, setClock] = useState(new Date());
  const shiftAction = useRef(false);
  const checkoutAction = useRef(false);
  const saleAttempt = useRef(null);
  const barcodeInput = useRef(null);
  const [orderQuery, setOrderQuery] = useState("");
  const [orderStatus, setOrderStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [barcode, setBarcode] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [category, setCategory] = useState("All");
  const [cart, setCart] = useState([]);
  const [cartNotice, setCartNotice] = useState("");
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
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [transactionVerified, setTransactionVerified] = useState(false);
  const [confirmSale, setConfirmSale] = useState(false);

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
      setCategoryList(data.categories || []);
      setDiscountRules(data.discountRules || []);
      setDealBundles(data.dealBundles || []);
      localStorage.setItem("pam-pos-catalogue", JSON.stringify({ products: data.products || [], categories: data.categories || [], discountRules: data.discountRules || [], dealBundles: data.dealBundles || [] }));
    } catch (err) {
      const cached = JSON.parse(localStorage.getItem("pam-pos-catalogue") || "{}");
      setProducts(cached.products || []);
      setCategoryList(cached.categories || []);
      setDiscountRules(cached.discountRules || []);
      setDealBundles(cached.dealBundles || []);
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
    finally { setShiftLoaded(true); }
  }

  useEffect(() => {
    if (!shift || locked) return;
    let timer;
    const arm = () => { clearTimeout(timer); timer = setTimeout(() => { setLocked(true); setEntryOpen(false); setView("dashboard"); }, 600000); };
    const events = ["pointerdown", "keydown", "touchstart"];
    events.forEach((event) => window.addEventListener(event, arm));
    arm();
    return () => { clearTimeout(timer); events.forEach((event) => window.removeEventListener(event, arm)); };
  }, [shift, locked]);

  useEffect(() => { const timer = setInterval(() => setClock(new Date()), 30000); return () => clearInterval(timer); }, []);

  async function startOrResume(event) {
    event.preventDefault();
    if (shiftAction.current) return;
    shiftAction.current = true; setBusy(true); setError("");
    try {
      if (staffEmail.trim().toLowerCase() !== String(user?.email || "").toLowerCase()) throw new Error("Sign in with the account currently assigned to this till.");
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, staffPassword));
      if (!shift) {
        const response = await request("/api/pos/shifts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "open", deviceId }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Shift could not be started.");
        setShift(data.shift);
      }
      setLocked(false); setEntryOpen(false); setStaffPassword(""); setView("dashboard");
    } catch (err) { setError(err.message || "Staff verification failed."); }
    finally { shiftAction.current = false; setBusy(false); }
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
    setStaffEmail(user.email || "");
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

  const pricing = priceCart(cart, discountRules, dealBundles);
  const { subtotal, discount, total } = pricing;

  useEffect(() => {
    if (view !== "sale" || !cart.length || !online) return;
    let cancelled = false;
    const check = async () => {
      try {
        const response = await request("/api/pos/products");
        const fresh = await response.json();
        if (!response.ok) throw new Error(fresh.error || "Stock check failed.");
        if (cancelled) return;
        const byId = new Map((fresh.products || []).map((product) => [product.id, product]));
        const changed = cart.some((item) => !byId.has(item.id) || byId.get(item.id).stock < item.quantity || byId.get(item.id).price !== item.price);
        const nextPrice = changed ? null : priceCart(cart.map((item) => ({ ...byId.get(item.id), quantity: item.quantity })), fresh.discountRules || [], fresh.dealBundles || []);
        setCartNotice((current) => changed || nextPrice.total !== total ? "Stock, price or promotion changed. Review the cart before checkout." : current.startsWith("Stock, price") ? current : "");
      } catch (err) { if (!cancelled) setCartNotice(`Live stock check failed: ${err.message}`); }
    };
    check();
    const timer = setInterval(check, 45000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [user, view, cart, online, total]);
  useEffect(() => { if (!cart.length) setCartNotice(""); }, [cart.length]);

  const categories = useMemo(() => {
    const ordered = categoryList.filter((item) => products.some((product) => product.categoryId === (item.categoryId || item.id))).map((item) => item.name);
    return ["All", ...(ordered.length ? ordered : [...new Set(products.map((product) => product.category))])];
  }, [products, categoryList]);
  const visible = useMemo(() => products.filter((product) => {
    const matchesCategory = category === "All" || product.category === category;
    const matchesQuery = `${product.name} ${product.id} ${product.sku || ""} ${product.barcode || ""}`.toLowerCase().includes(query.trim().toLowerCase());
    const threshold = Number(product.lowStockLevel ?? 8);
    const matchesStock = stockFilter === "all" || (stockFilter === "high" && (product.pinned || product.purchaseCount >= 3)) || (stockFilter === "low" && product.stock > 0 && product.stock < threshold) || (stockFilter === "out" && product.stock <= 0);
    return matchesCategory && matchesQuery && matchesStock;
  }), [products, query, category, stockFilter]);
  const visibleOrders = useMemo(() => orders.filter((order) => {
    const matches = `${order.customer} ${order.phone} ${order.orderId} ${order.createdAt}`.toLowerCase().includes(orderQuery.toLowerCase());
    const state = orderStatus === "all" || order.status === orderStatus || (orderStatus === "pending-payment" && order.paymentStatus !== "paid");
    return matches && state;
  }), [orders, orderQuery, orderStatus]);
  const tendered = amountPaid.trim() === "" ? NaN : Number(amountPaid);
  const changeDue = Number.isFinite(tendered) ? Math.max(0, tendered - total) : 0;
  const referenceReady = !["website", "whatsapp"].includes(orderChannel) || Boolean(orderReference.trim() || (customerName.trim() && customerPhone.trim()));
  const paymentReady = Number.isFinite(tendered) && tendered >= total && (paymentMethod === "cash" || transactionVerified);

  function add(product) {
    if (product.stock <= 0) return;
    setCartNotice("");
    setCart((current) => {
      const found = current.find((item) => item.id === product.id);
      if (found && found.quantity < product.stock) return current.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      return found ? current : [...current, { ...product, quantity: 1 }];
    });
  }

  function scanBarcode(event) {
    event.preventDefault();
    const code = barcode.trim().toLowerCase();
    if (!code) return;
    const product = products.find((item) => String(item.barcode || "").toLowerCase() === code);
    if (!product) setError(`Barcode ${barcode.trim()} was not recognised. Search by product name or SKU instead.`);
    else if (product.stock <= 0) setError(`${product.name} is out of stock.`);
    else { add(product); setError(""); setBarcode(""); }
    barcodeInput.current?.focus();
  }

  function change(id, delta) {
    setCartNotice("");
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
    setCustomerName(order.customer || "");
    setCustomerPhone(order.phone || "");
    setPaymentMethod("cash");
    setAmountPaid("");
    setTransactionVerified(false);
    setError("");
    setView("sale");
  }

  async function checkout() {
    if (!cart.length || checkoutAction.current) return;
    if (!shift) { setError("Open a till shift before checkout."); return; }
    if (!online) { setError("The till is offline. Reconnect before completing a sale so the receipt and stock can be saved."); return; }
    if (!referenceReady) { setError("Add an order reference or the customer name and phone for this sales channel."); return; }
    if (!paymentReady) { setError("Enter the amount paid and verify electronic payment before completing the sale."); return; }
    checkoutAction.current = true;
    setBusy(true); setError("");
    try {
      const fingerprint = JSON.stringify({ cart: cart.map(({ id, quantity }) => [id, quantity]), paymentMethod, tendered, orderChannel, orderReference, customerName, customerPhone });
      if (saleAttempt.current?.fingerprint !== fingerprint) {
      const freshResponse = await request("/api/pos/products");
      const fresh = await freshResponse.json();
      if (!freshResponse.ok) throw new Error(fresh.error || "Current stock and prices could not be checked.");
      const freshMap = new Map((fresh.products || []).map((product) => [product.id, product]));
      const changed = cart.find((item) => { const latest = freshMap.get(item.id); return !latest || latest.stock < item.quantity || latest.price !== item.price; });
      const freshPricing = changed ? null : priceCart(cart.map((item) => ({ ...freshMap.get(item.id), quantity: item.quantity })), fresh.discountRules || [], fresh.dealBundles || []);
      setProducts(fresh.products || []); setDiscountRules(fresh.discountRules || []); setDealBundles(fresh.dealBundles || []);
      if (changed || freshPricing.total !== total) {
        setCart(cart.map((item) => freshMap.has(item.id) ? { ...freshMap.get(item.id), quantity: Math.min(item.quantity, freshMap.get(item.id).stock) } : { ...item, stock: 0 }).filter((item) => item.quantity > 0 && item.stock > 0));
        setConfirmSale(false); saleAttempt.current = null;
        setCartNotice("Stock, price or promotion changed. The cart was refreshed. Review it before checkout.");
        throw new Error("Stock, price or promotion changed. The cart has been refreshed; review the new total before confirming.");
      }
      setCartNotice("");
      }
      const receiptItems = cart.map(({ id, name, quantity, price, productGroupId, colour, size }) => ({ id, name, quantity, price, productGroupId, variantId: productGroupId ? id : "", colour, size }));
      const linkedOrder = orders.find((item) => item.orderId === orderReference);
      const receiptFulfilment = { deliveryMethod: linkedOrder?.deliveryMethod || "pickup", originAddress: linkedOrder?.originAddress || SHOP_ADDRESS, deliveryAddress: linkedOrder?.deliveryAddress || linkedOrder?.landmark || "" };
      if (saleAttempt.current?.fingerprint !== fingerprint) saleAttempt.current = { fingerprint, transactionId: crypto.randomUUID() };
      const payload = { transactionId: saleAttempt.current.transactionId, paymentMethod, transactionVerified, salesChannel: orderChannel, orderReference: orderReference || null, customerName, customerPhone, amountPaid: tendered, shiftId: shift.shiftId, deviceId, items: cart.map(({ id, quantity }) => ({ id, quantity })) };
      const response = await request("/api/pos/sales", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) { saleAttempt.current = null; setConfirmSale(false); throw new Error(data.error); }
      setReceipt({ ...data, subtotal, discount, items: receiptItems, orderReference, ...receiptFulfilment });
      saleAttempt.current = null;
      setConfirmSale(false);
      if (linkedOrder) {
        try {
          const orderResponse = await request("/api/admin/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId: orderReference, status: "paid" }) });
          const orderResult = await orderResponse.json();
          if (!orderResponse.ok) throw new Error(orderResult.error);
        } catch (orderError) { setError(`Sale completed, but the linked order needs attention: ${orderError.message}`); }
      }
      setCart([]); setOrderReference(""); setOrderChannel("walk-in"); setCustomerName(""); setCustomerPhone(""); setAmountPaid(""); setTransactionVerified(false); await Promise.allSettled([loadProducts(), loadOrders()]);
    } catch (err) { setError(err.message || "Checkout failed."); }
    finally { checkoutAction.current = false; setBusy(false); }
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
    if (!shift || shiftAction.current) return;
    if (JSON.parse(localStorage.getItem("pam-pos-queue") || "[]").length) {
      setError("Sync queued offline sales before closing this shift."); return;
    }
    shiftAction.current = true;
    setBusy(true); setError("");
    try {
      const response = await request("/api/pos/shifts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "close", shiftId: shift.shiftId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setShift(null); setConfirmEndShift(false); setEntryOpen(false);
      setReceipt({ receiptId: "Shift closed", total: data.shift.summary?.salesTotal || 0, shiftSummary: data.shift.summary });
    } catch (err) { setError(err.message || "Shift could not be updated."); }
    finally { shiftAction.current = false; setBusy(false); }
  }

  if (!shiftLoaded) return <div className="pos-entry"><p>Loading shift status…</p></div>;
  if (!shift || locked) return <div className="pos-entry"><div className="pos-entry-card"><button className="pos-entry-logo" onClick={() => setEntryOpen(true)} aria-label="Open staff shift sign in">P</button><h1>PAM Essentials &amp; More</h1><p>Sales &amp; inventory</p><p>{shift ? "Shift paused after inactivity" : "Start a shift to process sales"}</p>{entryOpen ? <form onSubmit={startOrResume}><label>Staff email<input required type="email" autoComplete="username" value={staffEmail} onChange={(event) => setStaffEmail(event.target.value)} /></label><label>Password<input required type="password" autoComplete="current-password" value={staffPassword} onChange={(event) => setStaffPassword(event.target.value)} /></label><button className="button primary full" disabled={busy || !deviceId}>{busy ? "Verifying…" : shift ? "Resume Shift" : "Start Shift"}</button></form> : <button className="button primary" onClick={() => setEntryOpen(true)}>{shift ? "Resume Shift / Sign In" : "Staff Sign In"}</button>}{receipt?.shiftSummary && <div className="pos-shift-summary"><b>Last shift</b><span>{receipt.shiftSummary.transactions} transactions · {money.format(receipt.shiftSummary.salesTotal)}</span>{Object.entries(receipt.shiftSummary.paymentMix || {}).map(([method, value]) => <span key={method}>{method.replaceAll("-", " ")}: {money.format(value)}</span>)}</div>}{error && <p className="notice error-notice" role="alert">{error}</p>}<button className="text-button" onClick={signOut}>Use another staff account</button></div></div>;

  return <div className="pos-shell">
    <aside className={"pos-sidebar " + (sidebarOpen ? "open" : "")}><div className="pos-sidebar-brand"><a href="/" className="admin-brand">PAM <span>Essentials &amp; More</span></a><small>Sales &amp; inventory</small></div><nav aria-label="POS navigation">{[["dashboard", "Dashboard"], ["sale", "New Sale"], ["orders", "Orders"], ...(["owner", "admin", "supervisor"].includes(role) ? [["inventory", "Inventory"]] : []), ...(["owner", "admin"].includes(role) ? [["expenses", "Expenses"], ["admin", "Admin"]] : [])].map(([id, label]) => <button key={id} className={view === id ? "active" : ""} onClick={() => { if (id === "admin") window.location.href = "/admin"; else setView(id); setSidebarOpen(false); }}>{label}</button>)}</nav></aside>
    <header className="pos-header"><div className="pos-header-title"><button className="pos-menu-button" aria-label="Toggle POS navigation" onClick={() => setSidebarOpen((open) => !open)}>☰</button><div><h2>{({ dashboard: "Dashboard", sale: "New Sale", orders: "Orders", inventory: "Inventory", expenses: "Expenses" })[view]}</h2><p>{view === "dashboard" ? "Current sales and stock health" : view === "sale" ? "Find products and complete a sale" : "Sales & inventory"}</p></div></div><div className="pos-actions"><span className={online ? "connection online" : "connection offline"}>{syncing ? "Syncing sales…" : online ? "Online" : "Offline"}</span><span className="pos-staff">{user?.email} · {role?.toUpperCase()}<small>Shift started {shift.startedAt ? new Date(shift.startedAt).toLocaleTimeString("en-GH", { hour: "numeric", minute: "2-digit" }) : "—"}</small></span><time>{clock.toLocaleString("en-GH", { dateStyle: "short", timeStyle: "short" })}</time><button className="button secondary" onClick={() => { loadProducts(); loadOrders(); loadShift(); }}>Refresh</button><button className="shift-button open" onClick={() => setConfirmEndShift(true)} disabled={busy}>End Shift</button></div></header>
    {!online && <div className="offline-banner">Working offline. New sales cannot be completed until the database connection returns. Existing queued sales will sync when available.</div>}
    {error && <div className="pos-global-error notice error-notice" role="alert">{error}</div>}
    {view === "dashboard" ? <PosDashboard user={user} role={role} onNewSale={() => setView("sale")} onScan={() => { setView("sale"); setTimeout(() => barcodeInput.current?.focus(), 0); }} onOrders={() => setView("orders")} onInventory={() => setView("inventory")} onExpense={() => { window.location.href = "/admin?newExpense=1"; }} /> : view === "inventory" ? <main className="pos-simple-view"><h1>Inventory</h1><p>Current priced products and stock status.</p><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Product</th><th>SKU</th><th>Stock</th><th>Status</th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td>{product.name}</td><td>{product.id}</td><td>{product.stock}</td><td><span className={product.stock <= 0 ? "badge danger" : product.stock < Number(product.lowStockLevel ?? 8) ? "badge warning" : "badge success"}>{product.stock <= 0 ? "Out of stock" : product.stock < Number(product.lowStockLevel ?? 8) ? "Low stock" : "In stock"}</span></td></tr>)}</tbody></table></div></main> : view === "expenses" ? <main className="pos-simple-view"><h1>Expenses</h1><p>Record and review expenses in the Admin Portal.</p><a className="button primary" href="/admin?newExpense=1">Add expense</a></main> : view === "sale" ? 
      <PosTill shift={shift} role={role} query={query} setQuery={setQuery} barcode={barcode} setBarcode={setBarcode} barcodeInput={barcodeInput} scanBarcode={scanBarcode} category={category} setCategory={setCategory} categories={categories} stockFilter={stockFilter} setStockFilter={setStockFilter} visible={visible} add={add} cart={cart} setCart={setCart} cartNotice={cartNotice} setCartNotice={setCartNotice} change={change} pricing={pricing} orderReference={orderReference} setOrderReference={setOrderReference} orderChannel={orderChannel} setOrderChannel={setOrderChannel} customerName={customerName} setCustomerName={setCustomerName} customerPhone={customerPhone} setCustomerPhone={setCustomerPhone} paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} amountPaid={amountPaid} setAmountPaid={setAmountPaid} transactionVerified={transactionVerified} setTransactionVerified={setTransactionVerified} changeDue={changeDue} paymentReady={paymentReady} referenceReady={referenceReady} online={online} busy={busy} setConfirmSale={setConfirmSale} /> : <main className="pos-orders"><div className="pos-title"><div><p className="eyebrow">All channels</p><h1>Orders</h1></div>{["owner", "admin", "supervisor"].includes(role) && <a className="button secondary" href="/admin">Admin Portal</a>}</div><div className="table-tools"><input placeholder="Search client, phone, reference or time" value={orderQuery} onChange={(event) => setOrderQuery(event.target.value)} /><select value={orderStatus} onChange={(event) => setOrderStatus(event.target.value)}><option value="all">All orders</option><option value="pending-payment">Pending payment</option><option value="pending">Pending</option><option value="processing">Processing</option><option value="ready">Ready</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select><span>{visibleOrders.length} orders</span></div>{error && <p className="notice error-notice">{error}</p>}<div className="order-card-grid">{visibleOrders.map((order) => <article className="panel pos-order" key={order.orderId}><div className="panel-title"><div><b>{order.orderId}</b><p>{new Date(order.createdAt).toLocaleString("en-GH")}</p></div><span className={order.status === "completed" ? "badge success" : order.status === "cancelled" ? "badge danger" : "badge warning"}>{order.status}</span></div><h3>{order.customer}</h3><p>{order.phone} · {order.deliveryMethod}</p>{order.landmark && <p>{order.landmark}</p>}<div className="order-items">{(order.items || []).map((item) => <span key={item.productId}>{item.quantity} × {item.name} · {item.sku || item.productId}{item.colour && ` · ${item.colour}`}{item.size && ` / ${item.size}`}</span>)}</div><div className="order-total"><span>{order.paymentStatus === "paid" ? "Paid" : "Pending payment"}</span><strong>{money.format(order.total || 0)}</strong></div><div className="order-actions"><button className="button primary" disabled={busy || ["completed", "cancelled"].includes(order.status)} onClick={() => openOrderAtTill(order)}>Open at till</button><select disabled={busy} value={order.status} onChange={(event) => updateOrder(order.orderId, event.target.value)}>{["pending", "confirmed", "paid", "processing", "ready", "completed", "cancelled"].map((status) => <option key={status}>{status}</option>)}</select></div>{order.pickupCode && <strong className="pickup-code">Code {order.pickupCode}</strong>}</article>)}</div></main>}
    {receipt && <div className="modal-backdrop receipt-backdrop"><div className="modal receipt-modal"><div className="receipt-print"><p className="receipt-brand">PAM Essentials & More</p><span className="success-mark">✓</span><h2>{receipt.shiftSummary ? "Shift closed" : receipt.queued ? "Sale queued" : "Payment complete"}</h2><p>{receipt.shiftSummary ? `${receipt.shiftSummary.transactions} transactions recorded.` : receipt.queued ? "This sale will sync when the device reconnects." : "The sale was recorded and stock was updated."}</p><strong className="order-reference">{receipt.receiptId}</strong>{receipt.orderReference && <p>Order {receipt.orderReference}</p>}{receipt.deliveryMethod && <p>{receipt.deliveryMethod}</p>}{receipt.originAddress && <p>Shop collection: {receipt.originAddress}</p>}{receipt.deliveryAddress && <p>Delivery destination: {receipt.deliveryAddress}</p>}{receipt.items?.length > 0 && <div className="receipt-lines">{receipt.items.map((item) => <div key={item.id}><span>{item.quantity} × {item.name} · {item.id}{item.colour && ` · ${item.colour}`}{item.size && ` / ${item.size}`}</span><b>{money.format(item.price * item.quantity)}</b></div>)}</div>}{receipt.discount > 0 && <div className="receipt-row"><span>Discount</span><b>−{money.format(receipt.discount)}</b></div>}<div className="receipt-row total"><span>Total</span><b>{money.format(receipt.total || total)}</b></div>{!receipt.shiftSummary && <><div className="receipt-row"><span>{String(receipt.paymentMethod || "cash").replace("-", " ")}</span><b>{money.format(receipt.amountPaid || receipt.total || 0)}</b></div><div className="receipt-row"><span>Change</span><b>{money.format(receipt.change || 0)}</b></div></>}{receipt.shiftSummary?.paymentMix && <div className="receipt-lines">{Object.entries(receipt.shiftSummary.paymentMix).map(([method, value]) => <div key={method}><span>{method.replace("-", " ")}</span><b>{money.format(value)}</b></div>)}</div>}<p className="receipt-thanks">Thank you for shopping with us.</p></div><div className="receipt-actions">{!receipt.queued && <button className="button secondary" onClick={() => window.print()}>Print receipt</button>}<button className="button primary" onClick={() => setReceipt(null)}>{receipt.shiftSummary ? "Done" : "New sale"}</button></div></div></div>}
    {confirmEndShift && <div className="modal-backdrop"><div className="modal" role="dialog" aria-modal="true" aria-label="Confirm end shift"><h2>End this shift?</h2><p>Sales and payment totals will be recorded. This action cannot be undone.</p><div className="editor-actions"><button className="button secondary" onClick={() => setConfirmEndShift(false)} disabled={busy}>Keep shift open</button><button className="button primary" onClick={toggleShift} disabled={busy}>{busy ? "Ending shift…" : "Confirm End Shift"}</button></div></div></div>}
    {confirmSale && <div className="modal-backdrop"><div className="modal" role="dialog" aria-modal="true" aria-label="Confirm sale"><h2>Complete this sale?</h2><p>{cart.reduce((count, item) => count + item.quantity, 0)} items · {money.format(total)} · {paymentMethod.replaceAll("-", " ")}</p><p>Check the amount paid and customer details before saving.</p><div className="editor-actions"><button className="button secondary" onClick={() => setConfirmSale(false)} disabled={busy}>Review cart</button><button className="button primary" onClick={checkout} disabled={busy}>{busy ? "Saving sale…" : "Confirm Complete Sale"}</button></div></div></div>}
  </div>;
}

export default function PosPage() {
  return <RequireRole allow={["owner", "admin", "supervisor", "cashier"]}><Till /></RequireRole>;
}

