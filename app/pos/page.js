"use client";
import PosOrderDiscount from "@/components/PosOrderDiscount";
import {manualOrderDiscount} from "@/lib/orderDiscounts.mjs";

import { useEffect, useMemo, useRef, useState } from "react";
import { EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import RequireRole from "@/components/RequireRole";
import { signOut, useAuth } from "@/components/AuthProvider";
import PosDashboard from "@/components/PosDashboard";
import {wholesaleAvailableUnits,wholesaleSize,wholesaleUnitName,wholesaleMinimumUnits,wholesaleStepUnits,packDescription} from "@/lib/wholesaleUnits.mjs";
import { wholesaleEnabled, wholesaleSettings, wholesaleQuantityIssue, purchaseProduct, pricePurchaseCart } from "@/lib/wholesale.mjs";
import {posChannelCart} from "@/lib/channelCart.mjs";
import {retailEnabled,stockUnitIssue} from "@/lib/stockUnits.mjs";
import PosTill from "@/components/PosTill";
import PosReceipts from "@/components/PosReceipts";
import PosExpenses from "@/components/PosExpenses";
import PosOrders from "@/components/PosOrders";
import PosShiftCash from "@/components/PosShiftCash";
import PosSyncCentre from "@/components/PosSyncCentre";
import PosBasketTools from "@/components/PosBasketTools";
import usePosBaskets from "@/components/usePosBaskets";
import { planPosScan, planScannedProduct } from "@/lib/scannerWorkflow.mjs";
import ReceiptPanel from "@/components/ReceiptPanel";
import { saleTax } from "@/lib/accounting.mjs";
import { priceCart } from "@/lib/commerce";
import BrandLogo from "@/components/BrandLogo";
import { offlineSaleReceipt } from "@/lib/offlineSale.mjs";
import { applyPendingOrderActions } from "@/lib/offlineOrder.mjs";

const money = new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" });
const navIcons = { dashboard: "▦", sale: "+", orders: "☷", receipts: "▤", inventory: "▥", expenses: "◫", cash: "₵", sync: "↻", admin: "⚙" };

function Till() {
  const { user, role } = useAuth();
  const [products, setProducts] = useState([]);
  const [categoryList, setCategoryList] = useState([]);
  const [taxPolicy, setTaxPolicy] = useState({ enabled: false });
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
  const [scanPrompt, setScanPrompt] = useState(null);
  const [scanFeedback, setScanFeedback] = useState("");
  const scanPendingRef = useRef(null);
  const [stockFilter, setStockFilter] = useState("all");
  const [category, setCategory] = useState("All");
  const [cart, setCart] = useState([]);
  const [manualDiscount,setManualDiscount]=useState(null);
  const [purchaseMode, setPurchaseMode] = useState("retail");
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
  const [cashChangeSource, setCashChangeSource] = useState("cash");
  const [openingCash, setOpeningCash] = useState("0");
  const [shortcut, setShortcut] = useState(null);
  const [shortcutHelp, setShortcutHelp] = useState(false);

  async function request(url, options = {}) {
    const token = await user.getIdToken();
    return fetch(url, { ...options, headers: { ...(options.headers || {}), authorization: `Bearer ${token}` } });
  }

  function clearBasketFields() { setManualDiscount(null); setCart([]); setPurchaseMode("retail"); setOrderReference(""); setOrderChannel("walk-in"); setCustomerName(""); setCustomerPhone(""); setAmountPaid(""); setTransactionVerified(false); setCashChangeSource("cash"); saleAttempt.current = null; }
  const baskets = usePosBaskets({ user, shift, cart, purchaseMode, orderChannel, orderReference, customerName, customerPhone, request, attempt: saleAttempt,
    onRestore: (draft, restored, fresh) => { setPurchaseMode(draft.purchaseType || "retail"); setProducts(fresh.products || []); setDiscountRules(fresh.discountRules || []); setTaxPolicy(fresh.taxPolicy || { enabled: false }); setDealBundles(fresh.dealBundles || []); setCart(restored); setOrderChannel(draft.orderChannel || "walk-in"); setOrderReference(draft.orderReference || ""); setCustomerName(draft.customerName || ""); setCustomerPhone(draft.customerPhone || ""); setAmountPaid(""); setTransactionVerified(false); setCashChangeSource("cash"); setPaymentMethod("cash"); saleAttempt.current = draft.attemptId ? { transactionId: draft.attemptId, fingerprint: null, uncertain: false } : null; setView("sale"); setCartNotice("Restored with current stock, prices and promotions. Review the total and enter payment again."); },
    onFoundSale: (saved) => { clearBasketFields(); setReceipt(saved); }
  });
  function holdSale(name) { if (!baskets.hold(name)) return false; clearBasketFields(); return true; }
  function basketEditable() { if (baskets.recovery) { setError("Recover or discard the unfinished basket before starting another."); return false; } if (saleAttempt.current?.uncertain) { setError("A sale attempt is awaiting confirmation. Check sale status before changing this basket."); return false; } return true; }
  async function checkAttempt() {
    if (!saleAttempt.current || busy) return;
    setBusy(true); setError("");
    try { const response=await request(`/api/pos/sales?transactionId=${encodeURIComponent(saleAttempt.current.transactionId)}`),data=await response.json();if(!response.ok)throw new Error(data.error);if(data.found){baskets.finish();clearBasketFields();setReceipt(data.receipt);await loadProducts();}else{saleAttempt.current.uncertain=false;setCartNotice("No saved receipt was found. Review this basket before retrying; its original transaction reference will be retained.");} }
    catch(e){setError(e.message||"Sale status could not be checked. Keep this basket.");}finally{setBusy(false);}
  }
  useEffect(() => {
    if (!shift || locked) return;
    function keys(event) {
      if (event.ctrlKey || event.altKey || event.metaKey || event.repeat || !["F2","F3","F4","F8","F9"].includes(event.key)) return;
      if (document.querySelector('[role="dialog"]')) { if (event.key === "F9" && receipt && !cart.length) { event.preventDefault(); setReceipt(null); setView("sale"); } return; }
      event.preventDefault();
      if (event.key === "F9") { if (cart.length) { setCartNotice("Hold the current sale before starting another."); return; } setReceipt(null); setView("sale"); setShortcut({key:"F2",at:Date.now()}); return; }
      setView("sale"); setShortcut({key:event.key,at:Date.now()});
    }
    window.addEventListener("keydown",keys); return () => window.removeEventListener("keydown",keys);
  }, [shift?.shiftId,locked,cart.length,receipt]);

  async function loadProducts() {
    try {
      const response = await request("/api/pos/products");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setProducts(data.products || []);
      setCategoryList(data.categories || []);
      setDiscountRules(data.discountRules || []); setTaxPolicy(data.taxPolicy || { enabled: false });
      setDealBundles(data.dealBundles || []);
      localStorage.setItem("pam-pos-catalogue", JSON.stringify({ products: data.products || [], categories: data.categories || [], discountRules: data.discountRules || [], dealBundles: data.dealBundles || [], taxPolicy: data.taxPolicy || { enabled: false } }));
    } catch (err) {
      const cached = JSON.parse(localStorage.getItem("pam-pos-catalogue") || "{}");
      setProducts(cached.products || []);
      setCategoryList(cached.categories || []);
      setDiscountRules(cached.discountRules || []); setTaxPolicy(cached.taxPolicy || { enabled: false });
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
        const response = await request("/api/pos/shifts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "open", deviceId, openingCash }) });
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
        if (entry.staffId && entry.staffId !== user.uid) throw new Error("This offline sale belongs to another cashier. An owner or admin must reconcile it on this device.");
        const response = await request("/api/pos/sales", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(entry.payload || entry),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "sync failed");
        const acknowledged = (entry.payload || entry).transactionId;
        const remaining = JSON.parse(localStorage.getItem("pam-pos-queue") || "[]").filter(e => (e.payload || e).transactionId !== acknowledged);
        localStorage.setItem("pam-pos-queue", JSON.stringify(remaining));
        setQueuedCount(remaining.length);
        setReceipt((current) => current?.id === (entry.payload || entry).transactionId ? data : current);
      } catch (err) {
        const failedId = (queued[index].payload || queued[index]).transactionId;
        const remaining = JSON.parse(localStorage.getItem("pam-pos-queue") || "[]").map(e => (e.payload || e).transactionId === failedId ? { ...e, syncError: err.message || "sync failed" } : e);
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
    const next = [...queued, { ...action, actionId: crypto.randomUUID(), staffId: user.uid, createdAt: new Date().toISOString() }];
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
        if (queued[index].staffId && queued[index].staffId !== user.uid && !["owner","admin"].includes(role)) throw new Error("This update belongs to another staff member; ask a manager to review it.");
        const response = await request("/api/admin/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(queued[index]) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "order sync failed");
        const remaining = JSON.parse(localStorage.getItem("pam-pos-order-queue") || "[]").filter(e => e.actionId !== queued[index].actionId);
        localStorage.setItem("pam-pos-order-queue", JSON.stringify(remaining));
        setQueuedOrderCount(remaining.length);
      } catch (err) {
        const remaining = JSON.parse(localStorage.getItem("pam-pos-order-queue") || "[]").map(e => e.actionId === queued[index].actionId ? { ...e, syncError: err.message || "sync failed" } : e);
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

  const isMarketplace=["jiji","jumia"].includes(orderChannel);
  const discountCartKey=JSON.stringify(cart.map(p=>[p.id,p.quantity,p.price]));
  useEffect(()=>{setManualDiscount(null);},[discountCartKey,purchaseMode,orderChannel]);
  function previewPricing(items,rules,deals,mode,channel){const base=posChannelCart(items,rules,deals,mode,channel);return manualDiscount?manualOrderDiscount(base,manualDiscount,{}, {approved:true}):base;}
  let discountError="",pricing;
  try{pricing=previewPricing(cart,discountRules,dealBundles,purchaseMode,orderChannel);}catch(e){discountError=e.message;pricing=posChannelCart(cart,discountRules,dealBundles,purchaseMode,orderChannel);}
  if(manualDiscount&&!online)discountError="Reconnect before completing a sale with a manual discount.";
  const wholesaleError = purchaseMode === "wholesale" ? cart.map(p => wholesaleQuantityIssue(p,p.quantity)).find(Boolean) || "" : "";
  const { subtotal, discount, total } = pricing;

  useEffect(() => {
    if (view !== "sale" || !cart.length || !online) return;
    let cancelled = false;
    const check = async () => {
      try {
        const response = await request(`/api/pos/products?orderReference=${encodeURIComponent(orderReference)}&channel=${encodeURIComponent(orderChannel)}`);
        const fresh = await response.json();
        if (!response.ok) throw new Error(fresh.error || "Stock check failed.");
        if (cancelled) return;
        const byId = new Map((fresh.products || []).map((product) => [product.id, product]));
        const changed = cart.some((item) => !byId.has(item.id) || (purchaseMode==="wholesale"&&(wholesaleSize(byId.get(item.id))!==wholesaleSize(item)||wholesaleUnitName(byId.get(item.id))!==wholesaleUnitName(item))) || byId.get(item.id).stock < item.quantity || (!isMarketplace&&purchaseProduct(byId.get(item.id),purchaseMode,item.quantity,false).price !== purchaseProduct(item,purchaseMode,item.quantity,false).price)||Boolean(stockUnitIssue(byId.get(item.id),item)) || (purchaseMode === "wholesale" && Boolean(wholesaleQuantityIssue(byId.get(item.id),item.quantity))));
        const nextPrice = changed ? null : previewPricing(cart.map((item) => ({ ...byId.get(item.id),quantity:item.quantity,marketplaceSnapshot:item.marketplaceSnapshot,marketplaceOrderUnitPrice:item.marketplaceOrderUnitPrice })), fresh.discountRules || [], fresh.dealBundles || [], purchaseMode,orderChannel);
        setCartNotice((current) => changed || nextPrice.total !== total ? "Stock, price or promotion changed. Review the cart before checkout." : current.startsWith("Stock, price") ? current : "");
      } catch (err) { if (!cancelled) setCartNotice(`Live stock check failed: ${err.message}`); }
    };
    check();
    const timer = setInterval(check, 45000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [user, view, cart, online, total, purchaseMode]);
  useEffect(() => { if (!cart.length) setCartNotice(""); }, [cart.length]);
  useEffect(() => { if (!online) setCartNotice(""); }, [online]);

  const categories = useMemo(() => {
    const ordered = categoryList.filter((item) => products.some((product) => product.categoryId === (item.categoryId || item.id))).map((item) => item.name);
    return ["All", ...(ordered.length ? ordered : [...new Set(products.map((product) => product.category))])];
  }, [products, categoryList]);
  const visible = useMemo(() => products.filter((product) => {
    const matchesCategory = category === "All" || product.category === category;
    const matchesQuery = `${product.name} ${product.id} ${product.sku || ""} ${Object.values(product.variantOptions || {}).join(" ")} ${(product.barcodeEntries || []).filter((entry) => !entry.archived).map((entry) => entry.code).join(" ")} ${product.barcode || ""}`.toLowerCase().includes(query.trim().toLowerCase());
    const threshold = Number(product.lowStockLevel ?? 8);
    const matchesStock = stockFilter === "all" || (stockFilter === "high" && (product.pinned || product.purchaseCount >= 3)) || (stockFilter === "low" && product.stock > 0 && product.stock < threshold) || (stockFilter === "out" && product.stock <= 0);
    return matchesCategory && matchesQuery && matchesStock && (purchaseMode === "wholesale" ? wholesaleEnabled(product) : retailEnabled(product)&&Number(product.price)>0);
  }).map(p=>purchaseMode === "wholesale" ? purchaseProduct(p,purchaseMode,wholesaleMinimumUnits(p),false) : p), [products, query, category, stockFilter, purchaseMode]);
  const visibleOrders = useMemo(() => orders.filter((order) => {
    const matches = `${order.customer} ${order.phone} ${order.orderId} ${order.createdAt}`.toLowerCase().includes(orderQuery.toLowerCase());
    const state = orderStatus === "all" || order.status === orderStatus || (orderStatus === "pending-payment" && order.paymentStatus !== "paid");
    return matches && state;
  }), [orders, orderQuery, orderStatus]);
  const openOrderCount = orders.filter((order) => !["completed", "cancelled"].includes(order.status)).length;
  const tendered = amountPaid.trim() === "" ? NaN : Number(amountPaid);
  const changeDue = Number.isFinite(tendered) ? Math.max(0, tendered - total) : 0;
  const referenceReady = !["website", "whatsapp"].includes(orderChannel) || Boolean(orderReference.trim() || (customerName.trim() && customerPhone.trim()));
  const paymentReady = (orderChannel==="jumia"?Boolean(orderReference)&&online:Number.isFinite(tendered) && tendered >= total && (paymentMethod === "cash" || transactionVerified)) && !wholesaleError;

  function add(product) {
    if(isMarketplace){setCartNotice("Marketplace baskets must be opened from a confirmed order in Orders.");return false;}
    if (!basketEditable() || product.stock <= 0 || (purchaseMode === "retail" && Number(product.price) <= 0)) return false;
    const config=wholesaleSettings(product),found=cart.find(i=>i.id===product.id),amount=purchaseMode==="wholesale"?(found?wholesaleStepUnits(product):wholesaleMinimumUnits(product)):1;
    const quantity=(found?.quantity||0)+amount;
    if(purchaseMode==="wholesale"){const issue=wholesaleQuantityIssue(product,quantity);if(issue){setCartNotice(issue);return false;}}
    if(quantity>product.stock)return false;
    setCartNotice("");
    setCart(current=>current.some(i=>i.id===product.id)?current.map(i=>i.id===product.id?{...i,quantity,purchaseType:purchaseMode}:i):[...current,{...product,quantity,purchaseType:purchaseMode}]);
    return true;
  }

  function showScanPlan(plan) {
    setError("");
    setBarcode("");
    setScanMatches([]);
    if (plan.type === "choices") { setScanMatches(plan.products); setScanFeedback("Choose the scanned product below."); }
    else if (plan.type === "add") { if(add(plan.product)!==false)setScanFeedback(`${plan.product.name} added. Quantity: ${purchaseMode === "wholesale" ? wholesaleMinimumUnits(plan.product) : 1}.`); }
    else { scanPendingRef.current = plan; setScanPrompt(plan); if (plan.message) setScanFeedback(plan.message); }
  }
  function chooseScannedProduct(product) { showScanPlan(planScannedProduct(product, cart)); }
  function resolveScannedCode(value) {
    if (scanPendingRef.current || scanMatches.length) return;
    showScanPlan(planPosScan(purchaseMode === "wholesale" ? products.filter(wholesaleEnabled) : products.filter(p=>retailEnabled(p)&&Number(p.price)>0), cart, value));
  }
  function dismissScanPrompt() { scanPendingRef.current = null; setScanPrompt(null); barcodeInput.current?.focus(); }
  function confirmScanIncrease() {
    const pending = scanPendingRef.current;
    if (pending?.type !== "increase") return;
    scanPendingRef.current = null;
    setScanPrompt(null);
    const product = products.find((item) => item.id === pending.product.id);
    const item = cart.find((line) => line.id === pending.product.id);
    if (!product || !item) { showScanPlan({ type: "notice", message: "This item is no longer available in the basket. Scan it again to refresh your selection." }); return; }
    const refreshed = planScannedProduct(product, cart);
    if (refreshed.type !== "increase") { showScanPlan(refreshed); return; }
    add(product);
    setScanFeedback(`${product.name}: quantity in basket is now ${item.quantity + (purchaseMode === "wholesale" ? wholesaleStepUnits(product) : 1)}.`);
  }

  function scanBarcode(event) {
    event.preventDefault();
    if (!barcode.trim()) return;
    resolveScannedCode(barcode);
    barcodeInput.current?.focus();
  }

  function change(id, delta) {
    if (!basketEditable()) return;
    setCartNotice("");
    setCart((current) => current.map((item) => item.id === id ? { ...item, quantity: Math.min(purchaseMode==="wholesale"?wholesaleAvailableUnits(item):item.stock, Math.max(0, item.quantity + delta * (purchaseMode === "wholesale" ? wholesaleStepUnits(item) : 1))) } : item).filter((item) => item.quantity));
  }
  function setQuantity(id, quantity) {
    if (!basketEditable()) return;
    if (!Number.isInteger(quantity) || quantity < 1) return;
    setCartNotice("");
    setCart((current) => current.map((item) => item.id === id ? { ...item, quantity: Math.max(1, Math.min(purchaseMode==="wholesale"?wholesaleAvailableUnits(item):Number(item.stock), quantity)) } : item));
  }

  function finalizeOfflineSale() {
    const transactionId = crypto.randomUUID();
    const capturedTax = saleTax(pricing, cart, taxPolicy, new Date().toISOString().slice(0,10));
    const localReceipt = offlineSaleReceipt({ purchaseType: purchaseMode, taxSnapshot: capturedTax, transactionId, cart, pricing, shift, staffEmail: user?.email || "", staffName: shift?.staffName || user?.displayName || "", paymentMethod, cashChangeSource, amountPaid: tendered, salesChannel: orderChannel, orderReference, customerName, customerPhone });
    const payload = { orderDiscount:manualDiscount, purchaseType: purchaseMode, transactionId, offlineFinal: true, offlineTotal: total, offlineTaxSnapshot: capturedTax, paymentMethod, cashChangeSource, transactionVerified, salesChannel: orderChannel, orderReference: orderReference || null, customerName, customerPhone, amountPaid: tendered, shiftId: shift.shiftId, deviceId, items: cart.map(p => ({ id:p.id, quantity:p.quantity, retailUnit:p.retailUnit, ...(purchaseMode==="wholesale"?{expectedPackSize:wholesaleSize(p),expectedSellingUnit:wholesaleUnitName(p)}:{}) })) };
    const queued = JSON.parse(localStorage.getItem("pam-pos-queue") || "[]");
    const next = [...queued, { payload, receipt: localReceipt, createdAt: localReceipt.createdAt, staffId: user.uid }];
    localStorage.setItem("pam-pos-queue", JSON.stringify(next));
    if (JSON.parse(localStorage.getItem("pam-pos-queue") || "[]").length !== next.length) throw new Error("Could not safely store this offline sale. Do not take payment until device storage is available.");
    navigator.storage?.persist?.()?.catch(() => {});
    const sold = new Map(cart.map((item) => [item.id, item.quantity]));
    const adjustedProducts = products.map((product) => sold.has(product.id) ? { ...product, stock: Math.max(0, Number(product.stock) - sold.get(product.id)) } : product);
    setProducts(adjustedProducts);
    let catalogueCacheWarning = false;
    try {
      localStorage.setItem("pam-pos-catalogue", JSON.stringify({ products: adjustedProducts, categories: categoryList, discountRules, dealBundles, taxPolicy }));
    } catch { catalogueCacheWarning = true; }
    setQueuedCount(next.length);
    baskets.finish();
    setReceipt(localReceipt);
    saleAttempt.current = null;
    setConfirmSale(false);
    setCart([]); setPurchaseMode("retail"); setOrderReference(""); setOrderChannel("walk-in"); setCustomerName(""); setCustomerPhone(""); setAmountPaid(""); setTransactionVerified(false); setCashChangeSource("cash");
    setError("");
    setOfflineNotice(`Sale finalized on this till and queued for server sync. Keep this device and its browser data until synchronization succeeds.${catalogueCacheWarning ? " The cached catalogue could not be refreshed." : ""}`);
  }

  async function openOrderAtTill(order) {
    if (!basketEditable() || cart.length) { setError("Hold the current basket before opening an order at the till."); return; }
    if(order.marketplace&&(order.status!=="confirmed"||!online)){setError("Ask Owner/Admin to confirm and reserve this marketplace order online first.");return;}
    let orderProducts=products;try{const response=await request(`/api/pos/products?orderReference=${encodeURIComponent(order.orderId)}&channel=${encodeURIComponent(order.channel||"website")}`);const data=await response.json();if(!response.ok)throw new Error(data.error);orderProducts=data.products;setProducts(orderProducts);}catch(e){setError(e.message);return;}
    const nextCart = [];
    for (const [lineIndex,line] of (order.items || []).entries()) {
      const product = orderProducts.find((item) => item.id === line.productId);
      if (!product) { setError(`${line.name} is not available in the current till catalogue.`); return; }
      const remaining=Number(line.quantity)-Number(order.fulfilledQuantities?.[lineIndex]||0)-Number(order.cancelledQuantities?.[lineIndex]||0);if(remaining<=0)continue;
      if (Number(product.stock) < remaining) { setError(`Only ${product.stock} × ${product.name} remain. Resolve stock before taking payment.`); return; }
      nextCart.push({ ...product, quantity: remaining,...(order.marketplace?{marketplaceSnapshot:line.marketplaceSnapshot,marketplaceOrderUnitPrice:line.unitPrice}:{}) });
    }
    setPurchaseMode(order.purchaseType || "retail");
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
    if (wholesaleError) { setError(wholesaleError); return; }
    if (!referenceReady) { setError("Add an order reference or the customer name and phone for this sales channel."); return; }
    if (!paymentReady) { setError("Enter the amount paid and verify electronic payment before completing the sale."); return; }
    if (!online && saleAttempt.current) { setError("Reconnect to confirm the previous sale attempt before recording another payment."); return; }
    if(discountError){setError(discountError);return;}
    if (!online&&isMarketplace){setError("Marketplace orders require an online reservation check.");return;}
    if (!online) { try { finalizeOfflineSale(); } catch (err) { setError(err.message || "Offline sale could not be stored."); } return; }
    checkoutAction.current = true;
    setBusy(true); setError("");
    try {
      if (saleAttempt.current) {
        const checkResponse = await request(`/api/pos/sales?transactionId=${encodeURIComponent(saleAttempt.current.transactionId)}`), check = await checkResponse.json();
        if (!checkResponse.ok) throw new Error(check.error || "Previous sale status could not be checked.");
        if (check.found) { baskets.finish(); clearBasketFields(); setConfirmSale(false); setReceipt(check.receipt); await loadProducts(); return; }
        saleAttempt.current.uncertain = false;
      }
      const fingerprint = JSON.stringify({ purchaseMode, manualDiscount, cart: cart.map(({ id, quantity }) => [id, quantity]), paymentMethod, cashChangeSource, tendered, orderChannel, orderReference, customerName, customerPhone });
      if (saleAttempt.current?.fingerprint !== fingerprint) {
      const freshResponse = await request(`/api/pos/products?orderReference=${encodeURIComponent(orderReference)}`);
      const fresh = await freshResponse.json();
      if (!freshResponse.ok) throw new Error(fresh.error || "Current stock and prices could not be checked.");
      const freshMap = new Map((fresh.products || []).map((product) => [product.id, product]));
      const changed = cart.find((item) => { const latest = freshMap.get(item.id); return !latest || (purchaseMode==="wholesale"&&(wholesaleSize(latest)!==wholesaleSize(item)||wholesaleUnitName(latest)!==wholesaleUnitName(item))) || latest.stock < item.quantity || (!isMarketplace&&purchaseProduct(latest,purchaseMode,item.quantity,false).price !== purchaseProduct(item,purchaseMode,item.quantity,false).price)||Boolean(stockUnitIssue(latest,item)) || (purchaseMode === "wholesale" && Boolean(wholesaleQuantityIssue(latest,item.quantity))); });
      const freshPricing = changed ? null : previewPricing(cart.map((item) => ({ ...freshMap.get(item.id),quantity:item.quantity,marketplaceSnapshot:item.marketplaceSnapshot,marketplaceOrderUnitPrice:item.marketplaceOrderUnitPrice })), fresh.discountRules || [], fresh.dealBundles || [], purchaseMode,orderChannel);
      setProducts(fresh.products || []); setDiscountRules(fresh.discountRules || []); setTaxPolicy(fresh.taxPolicy || { enabled: false }); setDealBundles(fresh.dealBundles || []);
      if (changed || freshPricing.total !== total) {
        setCart(cart.map((item) => freshMap.has(item.id) ? { ...freshMap.get(item.id), quantity: Math.min(item.quantity, freshMap.get(item.id).stock) } : { ...item, stock: 0 }).filter((item) => item.quantity > 0 && item.stock > 0));
        setConfirmSale(false);
        setCartNotice("Stock, price or promotion changed. The cart was refreshed. Review it before checkout.");
        throw new Error("Stock, price or promotion changed. The cart has been refreshed; review the new total before confirming.");
      }
      setCartNotice("");
      }
      const linkedOrder = orders.find((item) => item.orderId === orderReference);
      if (saleAttempt.current?.fingerprint !== fingerprint) saleAttempt.current = { fingerprint, transactionId: saleAttempt.current?.transactionId || crypto.randomUUID() };
      baskets.captureAttempt();
      const payload = { purchaseType: purchaseMode, expectedTotal: total, transactionId: saleAttempt.current.transactionId, paymentMethod, cashChangeSource, transactionVerified, salesChannel: orderChannel, orderReference: orderReference || null, customerName, customerPhone, amountPaid: tendered, shiftId: shift.shiftId, deviceId, items: cart.map(p => ({ id:p.id,quantity:p.quantity,retailUnit:p.retailUnit,...(purchaseMode==="wholesale"?{expectedPackSize:wholesaleSize(p),expectedSellingUnit:wholesaleUnitName(p)}:{}) })) };
      saleAttempt.current.uncertain = true;
      const response = await request("/api/pos/sales", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) { if (response.status < 500) saleAttempt.current = null; setConfirmSale(false); throw new Error(data.error); }
      baskets.finish();
      setReceipt(data);
      saleAttempt.current = null;
      setConfirmSale(false);
      if (linkedOrder && !linkedOrder.marketplace) {
        try {
          const orderResponse = await request("/api/admin/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId: orderReference, status: "paid" }) });
          const orderResult = await orderResponse.json();
          if (!orderResponse.ok) throw new Error(orderResult.error);
        } catch (orderError) { setError(`Sale completed, but the linked order needs attention: ${orderError.message}`); }
      }
      setCart([]); setPurchaseMode("retail"); setOrderReference(""); setOrderChannel("walk-in"); setCustomerName(""); setCustomerPhone(""); setAmountPaid(""); setTransactionVerified(false); setCashChangeSource("cash"); await Promise.allSettled([loadProducts(), loadOrders()]);
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

  function prepareEndShift() {
    if (cart.length || saleAttempt.current?.uncertain) { setError("Hold or complete the current basket and confirm any sale attempt before ending the shift."); return; }
    if (JSON.parse(localStorage.getItem("pam-pos-queue") || "[]").length || JSON.parse(localStorage.getItem("pam-pos-order-queue") || "[]").length) { setError("Sync queued sales and order updates before closing this shift."); setView("sync"); return; }
    setConfirmEndShift(true);
  }
  function shiftClosed(closed) { setShift(null); setConfirmEndShift(false); setEntryOpen(false); setReceipt({ receiptId: "Shift closed", total: closed.summary?.salesTotal || 0, shiftSummary: closed.summary }); }

  if (!shiftLoaded) return <div className="pos-entry"><p>Loading shift status…</p></div>;
  if (!shift || locked) return <div className="pos-entry"><div className="pos-entry-card"><button className="pos-entry-logo" onClick={() => setEntryOpen(true)} aria-label="Open staff shift sign in"><BrandLogo symbol /></button><h1>PAM Essentials &amp; More</h1><p>Sales &amp; inventory</p><p>{shift ? "Shift paused after inactivity" : "Start a shift to process sales"}</p>{entryOpen ? <form onSubmit={startOrResume}><label>Staff email<input required type="email" autoComplete="username" value={staffEmail} onChange={(event) => setStaffEmail(event.target.value)} /></label><label>Password<input required type="password" autoComplete="current-password" value={staffPassword} onChange={(event) => setStaffPassword(event.target.value)} /></label>{!shift && <label>Opening cash float (GH₵)<input required type="number" min="0" step="0.01" value={openingCash} onChange={event => setOpeningCash(event.target.value)} /></label>}<button className="button primary full" disabled={busy || !deviceId}>{busy ? "Verifying…" : shift ? "Resume Shift" : "Start Shift"}</button></form> : <button className="button primary" onClick={() => setEntryOpen(true)}>{shift ? "Resume Shift / Sign In" : "Staff Sign In"}</button>}{receipt?.shiftSummary && <div className="pos-shift-summary"><b>Last shift</b>{receipt.shiftSummary.reversals > 0 && <span>{receipt.shiftSummary.reversals} recorded corrections</span>}{receipt.shiftSummary.cashReconciliation && <><span>Expected cash: {money.format(receipt.shiftSummary.cashReconciliation.expectedCash)}</span><span>Counted: {money.format(receipt.shiftSummary.cashReconciliation.countedCash)}</span><span>Difference: {money.format(receipt.shiftSummary.cashReconciliation.variance)}</span></>}<span>{receipt.shiftSummary.transactions} transactions · {money.format(receipt.shiftSummary.salesTotal)}</span>{Object.entries(receipt.shiftSummary.paymentMix || {}).map(([method, value]) => <span key={method}>{method.replaceAll("-", " ")}: {money.format(value)}</span>)}</div>}{error && <p className="notice error-notice" role="alert">{error}</p>}<button className="text-button" onClick={signOut}>Use another staff account</button></div></div>;

  return <div className={`pos-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
    <aside className={"pos-sidebar " + (sidebarOpen ? "open" : "")}><div className="pos-sidebar-brand"><a href="/" className="admin-brand" aria-label="PAM Essentials home"><BrandLogo background="navy" /></a><small>Sales &amp; inventory</small></div><nav aria-label="POS navigation">{[["dashboard", "Dashboard"], ["sale", "New Sale"], ["orders", "Orders"], ["receipts", "Receipts"], ...(["owner", "admin", "supervisor"].includes(role) ? [["inventory", "Inventory"]] : []), ["expenses", "Expenses"], ["cash", "Shift cash"], ["sync", "Sync centre"], ...(["owner", "admin"].includes(role) ? [["admin", "Admin"]] : [])].map(([id, label]) => <button key={id} title={label} aria-label={label} className={view === id ? "active" : ""} onClick={() => { if (id === "admin") window.location.href = "/admin"; else setView(id); setSidebarOpen(false); setSidebarCollapsed(true); }}><span className="pos-nav-icon" aria-hidden="true">{navIcons[id]}</span><span className="pos-nav-label">{label}</span>{id === "orders" && openOrderCount > 0 && <b className={`pos-order-badge ${orderNotice ? "arrived" : ""}`}>{openOrderCount}</b>}</button>)}</nav></aside>
    <header className="pos-header"><div className="pos-header-title"><button className="pos-menu-button" aria-label="Toggle POS navigation" onClick={() => { if (window.matchMedia("(min-width: 901px)").matches) setSidebarCollapsed(v => !v); else setSidebarOpen(v => !v); }}>☰</button><div><h2>{({ dashboard: "Dashboard", sale: "New Sale", orders: "Orders", receipts: "Receipts", inventory: "Inventory", expenses: "Expenses", cash: "Shift cash", sync: "Sync centre" })[view]}</h2><p>{view === "dashboard" ? "Current sales and stock health" : view === "receipts" ? "Search and reprint saved sales" : view === "sale" ? "Find products and complete a sale" : "Sales & inventory"}</p></div></div><div className="pos-actions"><span className={online ? "connection online" : "connection offline"}>{syncing ? "Syncing sales…" : online ? "Online" : "Offline"}</span><span className="pos-staff">{shift.staffName || user?.displayName || user?.email} · {role?.toUpperCase()}<small>Shift started {shift.startedAt ? new Date(shift.startedAt).toLocaleTimeString("en-GH", { hour: "numeric", minute: "2-digit" }) : "—"}</small></span><time>{clock.toLocaleString("en-GH", { dateStyle: "short", timeStyle: "short" })}</time><button className="button secondary" onClick={() => { setError(""); loadProducts(); loadOrders(); loadShift(); }}>Refresh</button><button className="shift-button open" onClick={prepareEndShift} disabled={busy}>End Shift</button></div></header>
    {(!online || queuedCount > 0 || queuedOrderCount > 0) && <div className="offline-banner">{!online ? "Offline till: sales and order updates finalize locally and sync when connected." : `${queuedCount} finalized ${queuedCount === 1 ? "sale" : "sales"} and ${queuedOrderCount} order ${queuedOrderCount === 1 ? "update" : "updates"} awaiting sync.`} {(queuedCount > 0 || queuedOrderCount > 0) && <button type="button" onClick={() => { flushQueue(); flushOrderQueue(); }} disabled={!online || syncing}>{syncing ? "Syncing…" : "Retry sync"}</button>} Do not clear this browser&apos;s data until everything syncs.</div>}
    {error && <div className="pos-global-error notice error-notice" role="alert">{error}</div>}
    {offlineNotice && <div className="pos-global-error notice success-notice" role="status"><span>{offlineNotice}</span><button type="button" onClick={() => setOfflineNotice("")} aria-label="Dismiss offline notice">×</button></div>}
    {orderNotice && view !== "orders" && <div className="pos-global-error notice success-notice pos-order-notice" role="status"><span>{orderNotice}</span><button type="button" onClick={() => { setView("orders"); setOrderNotice(""); }}>View orders</button></div>}
    <PosBasketTools pendingAttempt={Boolean(saleAttempt.current?.uncertain)} onCheckAttempt={checkAttempt} baskets={baskets} cart={cart} onHold={holdSale} busy={busy} />
    <div className="pos-shortcuts"><button type="button" className="text-button" onClick={() => setShortcutHelp(v => !v)} aria-expanded={shortcutHelp}>Keyboard shortcuts</button>{shortcutHelp && <span>F2 Search · F3 Barcode · F4 Basket · F8 Payment · F9 New sale. Payment still requires confirmation.</span>}</div>
    {view === "cash" ? <PosShiftCash request={request} shift={shift} /> : view === "sync" ? <PosSyncCentre request={request} role={role} online={online} syncing={syncing} onRetrySales={flushQueue} onRetryOrders={flushOrderQueue} onResolved={() => { setError(""); setOfflineNotice(""); setQueuedCount(JSON.parse(localStorage.getItem("pam-pos-queue") || "[]").length); loadProducts(); loadShift(); }} /> : view === "dashboard" ? <PosDashboard user={user} role={role} onNewSale={() => setView("sale")} onScan={() => { setView("sale"); setTimeout(() => barcodeInput.current?.focus(), 0); }} onOrders={() => setView("orders")} onInventory={() => setView("inventory")} onExpense={() => setView("expenses")} /> : view === "inventory" ? <main className="pos-simple-view"><h1>Inventory</h1><p>Current priced products and stock status.</p><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Product</th><th>SKU</th><th>Stock</th><th>Status</th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td>{product.name}</td><td>{product.id}</td><td>{product.stock}</td><td><span className={product.stock <= 0 ? "badge danger" : product.stock < Number(product.lowStockLevel ?? 8) ? "badge warning" : "badge success"}>{product.stock <= 0 ? "Out of stock" : product.stock < Number(product.lowStockLevel ?? 8) ? "Low stock" : "In stock"}</span></td></tr>)}</tbody></table></div></main> : view === "expenses" ? <PosExpenses user={user} shift={shift} /> : view === "receipts" ? <PosReceipts user={user} role={role} shift={shift} request={request} deviceId={deviceId} onCorrected={() => { loadProducts(); loadShift(); }} onNewSale={() => setView("sale")} /> : view === "sale" ?
      <PosTill orderDiscountControl={!isMarketplace&&cart.length?<PosOrderDiscount key={discountCartKey+purchaseMode+orderChannel} request={request} items={cart} purchaseType={purchaseMode} salesChannel={orderChannel} online={online} onApply={value=>{if(basketEditable())setManualDiscount(value);}} onClear={()=>{if(basketEditable())setManualDiscount(null);}} applied={manualDiscount}/>:null} discountError={discountError} purchaseMode={purchaseMode} onPurchaseMode={(mode) => { if (cart.length || !basketEditable()) { setCartNotice("Finish, clear or hold this basket before changing pricing."); return; } setPurchaseMode(mode); }} wholesaleError={wholesaleError} cashChangeSource={cashChangeSource} setCashChangeSource={setCashChangeSource} shortcut={shortcut} products={purchaseMode === "wholesale" ? products.filter(wholesaleEnabled).map(p=>purchaseProduct(p,purchaseMode,wholesaleMinimumUnits(p),false)) : products.filter(p=>Number(p.price)>0)} scanPrompt={scanPrompt} scanFeedback={scanFeedback} dismissScanPrompt={dismissScanPrompt} confirmScanIncrease={confirmScanIncrease} onSelectScannedProduct={chooseScannedProduct} shift={shift} role={role} query={query} setQuery={setQuery} barcode={barcode} setBarcode={setBarcode} barcodeInput={barcodeInput} scanBarcode={scanBarcode} onScannedCode={resolveScannedCode} scanMatches={scanMatches} setScanMatches={setScanMatches} category={category} setCategory={setCategory} categories={categories} stockFilter={stockFilter} setStockFilter={setStockFilter} visible={visible} add={add} cart={pricing.lines} setCart={value => { if (basketEditable()) setCart(value); }} cartNotice={cartNotice} setCartNotice={setCartNotice} change={change} setQuantity={setQuantity} pricing={pricing} discountRules={discountRules} orderReference={orderReference} setOrderReference={setOrderReference} orderChannel={orderChannel} setOrderChannel={setOrderChannel} customerName={customerName} setCustomerName={setCustomerName} customerPhone={customerPhone} setCustomerPhone={setCustomerPhone} paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} amountPaid={amountPaid} setAmountPaid={setAmountPaid} transactionVerified={transactionVerified} setTransactionVerified={setTransactionVerified} changeDue={changeDue} paymentReady={paymentReady} referenceReady={referenceReady} online={online} busy={busy} setConfirmSale={setConfirmSale} /> : <PosOrders role={role} orders={orders} products={products} visibleOrders={visibleOrders} orderQuery={orderQuery} setOrderQuery={setOrderQuery} orderStatus={orderStatus} setOrderStatus={setOrderStatus} busy={busy} error={error} openOrderAtTill={openOrderAtTill} updateOrder={updateOrder} confirmOrderItem={confirmOrderItem} newOrderNotice={orderNotice} clearNewOrderNotice={() => setOrderNotice("")} />}
    {receipt && !receipt.shiftSummary && <ReceiptPanel sale={receipt} onClose={() => setReceipt(null)} onNewSale={() => { setReceipt(null); setView("sale"); }} />}
    {confirmEndShift && <PosShiftCash request={request} shift={shift} closing onClosed={shiftClosed} onCancel={() => setConfirmEndShift(false)} />}
    {confirmSale && <div className="modal-backdrop"><div className="modal" role="dialog" aria-modal="true" aria-label="Confirm sale"><h2>Complete this sale?</h2><p>{cart.reduce((count, item) => count + item.quantity, 0)} items · {money.format(total)} · {paymentMethod.replaceAll("-", " ")}</p><p>{online ? "Check the amount paid and customer details before saving." : "This sale becomes final at this till now, using cached prices and stock. Server sync may require manager reconciliation if they changed elsewhere."}</p><div className="editor-actions"><button className="button secondary" onClick={() => setConfirmSale(false)} disabled={busy}>Review cart</button><button className="button primary" onClick={checkout} disabled={busy}>{busy ? "Saving sale…" : online ? "Confirm Complete Sale" : "Finalize Offline Sale"}</button></div></div></div>}
  </div>;
}

export default function PosPage() {
  return <RequireRole allow={["owner", "admin", "supervisor", "cashier"]}><Till /></RequireRole>;
}
