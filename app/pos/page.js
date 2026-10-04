"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import RequireRole from "@/components/RequireRole";
import { signOut, useAuth } from "@/components/AuthProvider";
import PosDashboard from "@/components/PosDashboard";
import PosTill from "@/components/PosTill";
import PosReceipts from "@/components/PosReceipts";
import PosExpenses from "@/components/PosExpenses";
import PosOrders from "@/components/PosOrders";
import { matchingProducts } from "@/lib/scanCode.mjs";
import ReceiptPanel from "@/components/ReceiptPanel";
import { priceCart } from "@/lib/commerce";
import BrandLogo from "@/components/BrandLogo";
import { offlineSaleReceipt } from "@/lib/offlineSale.mjs";
import { applyPendingOrderActions } from "@/lib/offlineOrder.mjs";

const money = new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" });
const navIcons = { dashboard: "▦", sale: "+", orders: "☷", receipts: "▤", inventory: "▥", expenses: "◫", admin: "⚙" };

function Till() {
  const { user, role } = useAuth();
  const [products, setProducts] = useState([]);
  const [categoryList, setCategoryList] = useState([]);
  const [discountRules, setDiscountRules] = useState([]);
  const [dealBundles, setDealBundles] = useState([]);
  const [orders, setOrders] = useState([]);
  const [orderNotice, setOrderNotice] = useState("");
  const knownOrderIds = useRef(null);
  const [view, setView] = useState("dashboard");
  const [shiftLoaded, setShiftLoaded] = useState(false);
  const [locked, setLocked] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);
  const [staffEmail, setStaffEmail] = useState(user?.email || "");
  const [staffPassword, setStaffPassword] = useState("");
  const [confirmEndShift, setConfirmEndShift] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [clock, setClock] = useState(new Date());
  const shiftAction = useRef(false);
  const checkoutAction = useRef(false);
  const syncAction = useRef(false);
  const syncOrderAction = useRef(false);
  const saleAttempt = useRef(null);
  const barcodeInput = useRef(null);
  const [orderQuery, setOrderQuery] = useState("");
  const [orderStatus, setOrderStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [barcode, setBarcode] = useState("");
  const [scanMatches, setScanMatches] = useState([]);
  const [stockFilter, setStockFilter] = useState("all");
  const [category, setCategory] = useState("All");
  const [cart, setCart] = useState([]);
  const [cartNotice, setCartNotice] = useState("");
  const [online, setOnline] = useState(true);
  const [error, setError] = useState("");
  const [offlineNotice, setOfflineNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [queuedCount, setQueuedCount] = useState(0);
  const [queuedOrderCount, setQueuedOrderCount] = useState(0);
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
      const nextOrders = data.orders || [];
      localStorage.setItem("pam-pos-orders", JSON.stringify(nextOrders));
      const nextIds = new Set(nextOrders.map((order) => order.orderId));
      if (knownOrderIds.current) {
        const arrivals = nextOrders.filter((order) => !knownOrderIds.current.has(order.orderId));
        if (arrivals.length) setOrderNotice(`${arrivals.length} new ${arrivals.length === 1 ? "order" : "orders"} received.`);
      }
      knownOrderIds.current = nextIds;
      setOrders(applyPendingOrderActions(nextOrders, JSON.parse(localStorage.getItem("pam-pos-order-queue") || "[]")));
    } catch (err) {
      const cached = JSON.parse(localStorage.getItem("pam-pos-orders") || "[]");
      setOrders(applyPendingOrderActions(cached, JSON.parse(localStorage.getItem("pam-pos-order-queue") || "[]")));
      if (!cached.length) setError(err.message || "Orders could not be loaded.");
    }
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
    if (syncAction.current) return;
    const queued = JSON.parse(localStorage.getItem("pam-pos-queue") || "[]");
    setQueuedCount(queued.length);
    if (!queued.length) return;

    syncAction.current = true;
    setSyncing(true);
    for (let index = 0; index < queued.length; index += 1) {
      try {
        const entry = queued[index];
        const response = await request("/api/pos/sales", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(entry.payload || entry),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "sync failed");
        localStorage.setItem("pam-pos-queue", JSON.stringify(queued.slice(index + 1)));
        setQueuedCount(queued.length - index - 1);
        setReceipt((current) => current?.id === (entry.payload || entry).transactionId ? data : current);
      } catch (err) {
        const remaining = queued.slice(index);
        remaining[0] = { ...remaining[0], syncError: err.message || "sync failed" };
        localStorage.setItem("pam-pos-queue", JSON.stringify(remaining));
        setQueuedCount(remaining.length);
        setError(`Offline sale ${remaining[0]?.receipt?.receiptId || (remaining[0]?.payload || remaining[0])?.transactionId} needs reconciliation: ${err.message || "sync failed"}. The sale remains final at this till; do not delete browser data.`);
        setSyncing(false);
        syncAction.current = false;
        return;
      }
    }
    setError("");
    setSyncing(false);
    syncAction.current = false;
    setOfflineNotice("");
    await loadProducts();
  }

  function enqueueOrderAction(action) {
    const queued = JSON.parse(localStorage.getItem("pam-pos-order-queue") || "[]");
    const next = [...queued, { ...action, actionId: crypto.randomUUID() }];
    localStorage.setItem("pam-pos-order-queue", JSON.stringify(next));
    if (JSON.parse(localStorage.getItem("pam-pos-order-queue") || "[]").length !== next.length) throw new Error("Could not safely save the offline order update.");
    setQueuedOrderCount(next.length);
    setOrders((current) => applyPendingOrderActions(current, [next.at(-1)]));
    navigator.storage?.persist?.()?.catch(() => {});
    return next.at(-1);
  }

  async function flushOrderQueue() {
    if (syncOrderAction.current) return;
    const queued = JSON.parse(localStorage.getItem("pam-pos-order-queue") || "[]");
    setQueuedOrderCount(queued.length);
    if (!queued.length) return;
    syncOrderAction.current = true;
    for (let index = 0; index < queued.length; index += 1) {
      try {
        const response = await request("/api/admin/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(queued[index]) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "order sync failed");
        localStorage.setItem("pam-pos-order-queue", JSON.stringify(queued.slice(index + 1)));
        setQueuedOrderCount(queued.length - index - 1);
      } catch (err) {
        const remaining = queued.slice(index);
        localStorage.setItem("pam-pos-order-queue", JSON.stringify(remaining));
        setError(`Offline order ${remaining[0].orderId} needs reconciliation: ${err.message || "sync failed"}. Keep this device and its browser data.`);
        syncOrderAction.current = false;
        return;
      }
    }
    syncOrderAction.current = false;
    setOfflineNotice("");
    await loadOrders();
  }

  useEffect(() => {
    if (!user) return;
    setStaffEmail(user.email || "");
    let storedDevice = localStorage.getItem("pam-pos-device");
    if (!storedDevice) { storedDevice = `PAM-${crypto.randomUUID().slice(0, 8).toUpperCase()}`; localStorage.setItem("pam-pos-device", storedDevice); }
    setDeviceId(storedDevice);
    setQueuedCount(JSON.parse(localStorage.getItem("pam-pos-queue") || "[]").length);
    setQueuedOrderCount(JSON.parse(localStorage.getItem("pam-pos-order-queue") || "[]").length);
    loadProducts(); loadOrders(); loadShift();
    const update = () => {
      const connected = navigator.onLine;
      setOnline(connected);
      if (connected) { flushQueue(); flushOrderQueue(); }
    };
    update(); window.addEventListener("online", update); window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, [user]);

  useEffect(() => {
    if (!user || !shift || locked) return;
    const timer = setInterval(loadOrders, 30000);
    return () => clearInterval(timer);
  }, [user, shift?.shiftId, locked]);

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
  useEffect(() => { if (!online) setCartNotice(""); }, [online]);

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
  const openOrderCount = orders.filter((order) => !["completed", "cancelled"].includes(order.status) && ["website", "whatsapp"].includes(order.channel || "website")).length;
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

  function resolveScannedCode(value) {
    const matches = matchingProducts(products, value);
    setScanMatches([]);
    if (!matches.length) setError("No product found for this code.");
    else if (matches.length > 1) { setError(""); setScanMatches(matches); }
    else if (matches[0].stock <= 0) setError(`${matches[0].name} is out of stock.`);
    else { add(matches[0]); setError(""); setBarcode(""); }
  }

  function scanBarcode(event) {
    event.preventDefault();
    if (!barcode.trim()) return;
    resolveScannedCode(barcode);
    barcodeInput.current?.focus();
  }

  function change(id, delta) {
    setCartNotice("");
    setCart((current) => current.map((item) => item.id === id ? { ...item, quantity: Math.min(item.stock, Math.max(0, item.quantity + delta)) } : item).filter((item) => item.quantity));
  }
  function setQuantity(id, quantity) {
    if (!Number.isInteger(quantity) || quantity < 1) return;
    setCartNotice("");
    setCart((current) => current.map((item) => item.id === id ? { ...item, quantity: Math.max(1, Math.min(Number(item.stock), quantity)) } : item));
  }

  function finalizeOfflineSale() {
    const transactionId = crypto.randomUUID();
    const localReceipt = offlineSaleReceipt({ transactionId, cart, pricing, shift, staffEmail: user?.email || "", staffName: shift?.staffName || user?.displayName || "", paymentMethod, amountPaid: tendered, salesChannel: orderChannel, orderReference, customerName, customerPhone });
    const payload = { transactionId, offlineFinal: true, offlineTotal: total, paymentMethod, transactionVerified, salesChannel: orderChannel, orderReference: orderReference || null, customerName, customerPhone, amountPaid: tendered, shiftId: shift.shiftId, deviceId, items: cart.map(({ id, quantity }) => ({ id, quantity })) };
    const queued = JSON.parse(localStorage.getItem("pam-pos-queue") || "[]");
    const next = [...queued, { payload, receipt: localReceipt, createdAt: localReceipt.createdAt }];
    localStorage.setItem("pam-pos-queue", JSON.stringify(next));
    if (JSON.parse(localStorage.getItem("pam-pos-queue") || "[]").length !== next.length) throw new Error("Could not safely store this offline sale. Do not take payment until device storage is available.");
    navigator.storage?.persist?.()?.catch(() => {});
    const sold = new Map(cart.map((item) => [item.id, item.quantity]));
    const adjustedProducts = products.map((product) => sold.has(product.id) ? { ...product, stock: Math.max(0, Number(product.stock) - sold.get(product.id)) } : product);
    setProducts(adjustedProducts);
    let catalogueCacheWarning = false;
    try {
      localStorage.setItem("pam-pos-catalogue", JSON.stringify({ products: adjustedProducts, categories: categoryList, discountRules, dealBundles }));
    } catch { catalogueCacheWarning = true; }
    setQueuedCount(next.length);
    setReceipt(localReceipt);
    saleAttempt.current = null;
    setConfirmSale(false);
    setCart([]); setOrderReference(""); setOrderChannel("walk-in"); setCustomerName(""); setCustomerPhone(""); setAmountPaid(""); setTransactionVerified(false);
    setError("");
    setOfflineNotice(`Sale finalized on this till and queued for server sync. Keep this device and its browser data until synchronization succeeds.${catalogueCacheWarning ? " The cached catalogue could not be refreshed." : ""}`);
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
    if (!referenceReady) { setError("Add an order reference or the customer name and phone for this sales channel."); return; }
    if (!paymentReady) { setError("Enter the amount paid and verify electronic payment before completing the sale."); return; }
    if (!online) { try { finalizeOfflineSale(); } catch (err) { setError(err.message || "Offline sale could not be stored."); } return; }
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
      const linkedOrder = orders.find((item) => item.orderId === orderReference);
      if (saleAttempt.current?.fingerprint !== fingerprint) saleAttempt.current = { fingerprint, transactionId: crypto.randomUUID() };
      const payload = { transactionId: saleAttempt.current.transactionId, paymentMethod, transactionVerified, salesChannel: orderChannel, orderReference: orderReference || null, customerName, customerPhone, amountPaid: tendered, shiftId: shift.shiftId, deviceId, items: cart.map(({ id, quantity }) => ({ id, quantity })) };
      const response = await request("/api/pos/sales", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) { saleAttempt.current = null; setConfirmSale(false); throw new Error(data.error); }
      setReceipt(data);
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
    if (!online) {
      try {
        enqueueOrderAction({ orderId, status, confirmPayment: false });
        setError("");
        setOfflineNotice("Order update finalized on this till and queued for server sync. External customer messaging is not yet configured.");
        return true;
      } catch (err) { setError(err.message || "Offline order update could not be stored."); return false; }
    }
    setBusy(true); setError("");
    try {
      const response = await request("/api/admin/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId, status, confirmPayment: false }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      await loadOrders();
      return true;
    } catch (err) { setError(err.message || "Order could not be updated."); return false; }
    finally { setBusy(false); }
  }

  async function confirmOrderItem(orderId, lineIndex, confirmedQuantity) {
    if (!online) {
      try {
        const order = orders.find((item) => item.orderId === orderId);
        if (!order) throw new Error("This order is not available in the offline cache.");
        const action = enqueueOrderAction({ orderId, action: "confirm-fulfilment-line", lineIndex, confirmedQuantity });
        return { fulfilmentCounts: applyPendingOrderActions([order], [action])[0].fulfilmentCounts };
      } catch (err) { setError(err.message || "Offline item confirmation could not be stored."); throw err; }
    }
    setBusy(true); setError("");
    try {
      const response = await request("/api/admin/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId, action: "confirm-fulfilment-line", lineIndex, confirmedQuantity }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Item confirmation failed.");
      await loadOrders();
      return data;
    } catch (err) { setError(err.message || "Item confirmation failed."); throw err; }
    finally { setBusy(false); }
  }

  async function toggleShift() {
    if (!shift || shiftAction.current) return;
    if (JSON.parse(localStorage.getItem("pam-pos-queue") || "[]").length || JSON.parse(localStorage.getItem("pam-pos-order-queue") || "[]").length) {
      setError("Sync queued offline sales and order updates before closing this shift."); return;
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
  if (!shift || locked) return <div className="pos-entry"><div className="pos-entry-card"><button className="pos-entry-logo" onClick={() => setEntryOpen(true)} aria-label="Open staff shift sign in"><BrandLogo symbol /></button><h1>PAM Essentials &amp; More</h1><p>Sales &amp; inventory</p><p>{shift ? "Shift paused after inactivity" : "Start a shift to process sales"}</p>{entryOpen ? <form onSubmit={startOrResume}><label>Staff email<input required type="email" autoComplete="username" value={staffEmail} onChange={(event) => setStaffEmail(event.target.value)} /></label><label>Password<input required type="password" autoComplete="current-password" value={staffPassword} onChange={(event) => setStaffPassword(event.target.value)} /></label><button className="button primary full" disabled={busy || !deviceId}>{busy ? "Verifying…" : shift ? "Resume Shift" : "Start Shift"}</button></form> : <button className="button primary" onClick={() => setEntryOpen(true)}>{shift ? "Resume Shift / Sign In" : "Staff Sign In"}</button>}{receipt?.shiftSummary && <div className="pos-shift-summary"><b>Last shift</b><span>{receipt.shiftSummary.transactions} transactions · {money.format(receipt.shiftSummary.salesTotal)}</span>{Object.entries(receipt.shiftSummary.paymentMix || {}).map(([method, value]) => <span key={method}>{method.replaceAll("-", " ")}: {money.format(value)}</span>)}</div>}{error && <p className="notice error-notice" role="alert">{error}</p>}<button className="text-button" onClick={signOut}>Use another staff account</button></div></div>;

  return <div className={`pos-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
    <aside className={"pos-sidebar " + (sidebarOpen ? "open" : "")}><div className="pos-sidebar-brand"><a href="/" className="admin-brand" aria-label="PAM Essentials home"><BrandLogo background="navy" /></a><small>Sales &amp; inventory</small></div><nav aria-label="POS navigation">{[["dashboard", "Dashboard"], ["sale", "New Sale"], ["orders", "Orders"], ["receipts", "Receipts"], ...(["owner", "admin", "supervisor"].includes(role) ? [["inventory", "Inventory"]] : []), ["expenses", "Expenses"], ...(["owner", "admin"].includes(role) ? [["admin", "Admin"]] : [])].map(([id, label]) => <button key={id} title={label} aria-label={label} className={view === id ? "active" : ""} onClick={() => { if (id === "admin") window.location.href = "/admin"; else setView(id); setSidebarOpen(false); setSidebarCollapsed(true); }}><span className="pos-nav-icon" aria-hidden="true">{navIcons[id]}</span><span className="pos-nav-label">{label}</span>{id === "orders" && openOrderCount > 0 && <b className={`pos-order-badge ${orderNotice ? "arrived" : ""}`}>{openOrderCount}</b>}</button>)}</nav></aside>
    <header className="pos-header"><div className="pos-header-title"><button className="pos-menu-button" aria-label="Toggle POS navigation" onClick={() => setSidebarOpen((open) => !open)}>☰</button><div><h2>{({ dashboard: "Dashboard", sale: "New Sale", orders: "Orders", receipts: "Receipts", inventory: "Inventory", expenses: "Expenses" })[view]}</h2><p>{view === "dashboard" ? "Current sales and stock health" : view === "receipts" ? "Search and reprint saved sales" : view === "sale" ? "Find products and complete a sale" : "Sales & inventory"}</p></div></div><div className="pos-actions"><span className={online ? "connection online" : "connection offline"}>{syncing ? "Syncing sales…" : online ? "Online" : "Offline"}</span><span className="pos-staff">{user?.email} · {role?.toUpperCase()}<small>Shift started {shift.startedAt ? new Date(shift.startedAt).toLocaleTimeString("en-GH", { hour: "numeric", minute: "2-digit" }) : "—"}</small></span><time>{clock.toLocaleString("en-GH", { dateStyle: "short", timeStyle: "short" })}</time><button className="button secondary" onClick={() => { loadProducts(); loadOrders(); loadShift(); }}>Refresh</button><button className="shift-button open" onClick={() => setConfirmEndShift(true)} disabled={busy}>End Shift</button></div></header>
    {(!online || queuedCount > 0 || queuedOrderCount > 0) && <div className="offline-banner">{!online ? "Offline till: sales and order updates finalize locally and sync when connected." : `${queuedCount} finalized ${queuedCount === 1 ? "sale" : "sales"} and ${queuedOrderCount} order ${queuedOrderCount === 1 ? "update" : "updates"} awaiting sync.`} {(queuedCount > 0 || queuedOrderCount > 0) && <button type="button" onClick={() => { flushQueue(); flushOrderQueue(); }} disabled={!online || syncing}>{syncing ? "Syncing…" : "Retry sync"}</button>} Do not clear this browser&apos;s data until everything syncs.</div>}
    {error && <div className="pos-global-error notice error-notice" role="alert">{error}</div>}
    {offlineNotice && <div className="pos-global-error notice success-notice" role="status"><span>{offlineNotice}</span><button type="button" onClick={() => setOfflineNotice("")} aria-label="Dismiss offline notice">×</button></div>}
    {orderNotice && view !== "orders" && <div className="pos-global-error notice success-notice pos-order-notice" role="status"><span>{orderNotice}</span><button type="button" onClick={() => { setView("orders"); setOrderNotice(""); }}>View orders</button></div>}
    {view === "dashboard" ? <PosDashboard user={user} role={role} onNewSale={() => setView("sale")} onScan={() => { setView("sale"); setTimeout(() => barcodeInput.current?.focus(), 0); }} onOrders={() => setView("orders")} onInventory={() => setView("inventory")} onExpense={() => setView("expenses")} /> : view === "inventory" ? <main className="pos-simple-view"><h1>Inventory</h1><p>Current priced products and stock status.</p><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Product</th><th>SKU</th><th>Stock</th><th>Status</th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td>{product.name}</td><td>{product.id}</td><td>{product.stock}</td><td><span className={product.stock <= 0 ? "badge danger" : product.stock < Number(product.lowStockLevel ?? 8) ? "badge warning" : "badge success"}>{product.stock <= 0 ? "Out of stock" : product.stock < Number(product.lowStockLevel ?? 8) ? "Low stock" : "In stock"}</span></td></tr>)}</tbody></table></div></main> : view === "expenses" ? <PosExpenses user={user} shift={shift} /> : view === "receipts" ? <PosReceipts user={user} onNewSale={() => setView("sale")} /> : view === "sale" ? 
      <PosTill shift={shift} role={role} query={query} setQuery={setQuery} barcode={barcode} setBarcode={setBarcode} barcodeInput={barcodeInput} scanBarcode={scanBarcode} onScannedCode={resolveScannedCode} scanMatches={scanMatches} setScanMatches={setScanMatches} category={category} setCategory={setCategory} categories={categories} stockFilter={stockFilter} setStockFilter={setStockFilter} visible={visible} add={add} cart={cart} setCart={setCart} cartNotice={cartNotice} setCartNotice={setCartNotice} change={change} setQuantity={setQuantity} pricing={pricing} discountRules={discountRules} orderReference={orderReference} setOrderReference={setOrderReference} orderChannel={orderChannel} setOrderChannel={setOrderChannel} customerName={customerName} setCustomerName={setCustomerName} customerPhone={customerPhone} setCustomerPhone={setCustomerPhone} paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} amountPaid={amountPaid} setAmountPaid={setAmountPaid} transactionVerified={transactionVerified} setTransactionVerified={setTransactionVerified} changeDue={changeDue} paymentReady={paymentReady} referenceReady={referenceReady} online={online} busy={busy} setConfirmSale={setConfirmSale} /> : <PosOrders role={role} orders={orders} products={products} visibleOrders={visibleOrders} orderQuery={orderQuery} setOrderQuery={setOrderQuery} orderStatus={orderStatus} setOrderStatus={setOrderStatus} busy={busy} error={error} openOrderAtTill={openOrderAtTill} updateOrder={updateOrder} confirmOrderItem={confirmOrderItem} newOrderNotice={orderNotice} clearNewOrderNotice={() => setOrderNotice("")} />}
    {receipt && !receipt.shiftSummary && <ReceiptPanel sale={receipt} onClose={() => setReceipt(null)} onNewSale={() => { setReceipt(null); setView("sale"); }} />}
    {confirmEndShift && <div className="modal-backdrop"><div className="modal" role="dialog" aria-modal="true" aria-label="Confirm end shift"><h2>End this shift?</h2><p>Sales and payment totals will be recorded. This action cannot be undone.</p><div className="editor-actions"><button className="button secondary" onClick={() => setConfirmEndShift(false)} disabled={busy}>Keep shift open</button><button className="button primary" onClick={toggleShift} disabled={busy}>{busy ? "Ending shift…" : "Confirm End Shift"}</button></div></div></div>}
    {confirmSale && <div className="modal-backdrop"><div className="modal" role="dialog" aria-modal="true" aria-label="Confirm sale"><h2>Complete this sale?</h2><p>{cart.reduce((count, item) => count + item.quantity, 0)} items · {money.format(total)} · {paymentMethod.replaceAll("-", " ")}</p><p>{online ? "Check the amount paid and customer details before saving." : "This sale becomes final at this till now, using cached prices and stock. Server sync may require manager reconciliation if they changed elsewhere."}</p><div className="editor-actions"><button className="button secondary" onClick={() => setConfirmSale(false)} disabled={busy}>Review cart</button><button className="button primary" onClick={checkout} disabled={busy}>{busy ? "Saving sale…" : online ? "Confirm Complete Sale" : "Finalize Offline Sale"}</button></div></div></div>}
  </div>;
}

export default function PosPage() {
  return <RequireRole allow={["owner", "admin", "supervisor", "cashier"]}><Till /></RequireRole>;
}

