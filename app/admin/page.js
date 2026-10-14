"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import RequireRole from "@/components/RequireRole";
import { signOut, useAuth } from "@/components/AuthProvider";
import AdminReceipts from "@/components/AdminReceipts";
import AdminMetricDetails from "@/components/AdminMetricDetails";
import AdminAnalyticsCharts from "@/components/AdminAnalyticsCharts";
import ReceiptPanel from "@/components/ReceiptPanel";
import { receiptSnapshot } from "@/lib/receiptData.mjs";
import { selectReportingPeriod } from "@/lib/adminReporting.mjs";
import AdminProductImages from "@/components/AdminProductImages";
import AdminProductVariants from "@/components/AdminProductVariants";
import { editorVariantState } from "@/lib/adminVariants.mjs";
import AdminHeroGallery from "@/components/AdminHeroGallery";
import AdminCatalogueImport from "@/components/AdminCatalogueImport";
import AdminRestockAlerts from "@/components/AdminRestockAlerts";
import AdminCustomers from "@/components/AdminCustomers";
import AdminInquiries from "@/components/AdminInquiries";
import AdminReviews from "@/components/AdminReviews";
import AdminProductRequests from "@/components/AdminProductRequests";
import AdminWishlistAnalytics from "@/components/AdminWishlistAnalytics";
import AdminTypography from "@/components/AdminTypography";
import AdminAnnouncements from "@/components/AdminAnnouncements";
import AdminShoppingSettings from "@/components/AdminShoppingSettings";
import AdminLocationSettings from "@/components/AdminLocationSettings";
import AdminProductBarcodes from "@/components/AdminProductBarcodes";
import AdminProductSearch from "@/components/AdminProductSearch";
import AdminAttention from "@/components/AdminAttention";
import AdminReadiness from "@/components/AdminReadiness";
import AdminPricingPreview from "@/components/AdminPricingPreview";
import AdminProductWorkspace from "@/components/AdminProductWorkspace";
import AdminDraftRecovery, { AdminLeaveConfirmation } from "@/components/AdminDraftRecovery";
import useProductEditorProtection from "@/components/useProductEditorProtection";
import AdminGroupedNavigation from "@/components/AdminGroupedNavigation";
import { matchesReadiness, productReadiness } from "@/lib/adminWorkspace.mjs";
import { courierFeeLabel } from "@/lib/shopPreferences.mjs";
import { requiresPricingInquiry } from "@/lib/productPricing.mjs";
import { activeBarcodes } from "@/lib/barcodes.mjs";
import { ruleScopeOptions } from "@/lib/ruleScopeOptions.mjs";
import BrandLogo from "@/components/BrandLogo";
import { findDealOverlaps, findRuleOverlaps } from "@/lib/discountOverlap.mjs";
import { effectiveRuleEnd } from "@/lib/discount.mjs";

const money = new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" });
const whole = new Intl.NumberFormat("en-GH");
const allNav = ["Overview", "Orders", "Products", "Categories", "Inventory", "Discounts", "Promotions", "Announcements", "Appearance", "Staff", "Customers", "Inquiries", "Product Requests", "Reviews", "Restock Alerts", "Analytics", "Transactions", "Settings", "Audit"];
const supervisorNav = ["Overview", "Orders", "Inventory"];
const settingKeys = ["STORE_NAME", "STORE_LOCATION", "GOOGLE_MAPS_URL", "OPENING_HOURS", "WHATSAPP_NUMBER", "RECEIPT_FOOTER", "DELIVERY_OPTIONS", "DELIVERY_FEE", "PAM_DEALS_ACTIVE", "HERO_FLYER_URL"];
const emptyData = { products: [], orders: [], movements: [], categories: [], subcategories: [], subSubcategories: [], discounts: [], dealBundles: [], settings: {}, users: [], audit: [], sales: [], expenses: [], metrics: {}, permissions: {} };

function dateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-GH", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Accra" });
}

function CategoryHierarchy({ categories, subcategories, subSubcategories, onEdit }) {
  const [openCategories, setOpenCategories] = useState([]);
  const [openSubcategories, setOpenSubcategories] = useState([]);
  const toggle = (setOpen, id) => setOpen((current) => current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]);
  const status = (item) => <span className={item.active !== false && !item.archived ? "badge success" : "badge danger"}>{item.active !== false && !item.archived ? "Active" : "Inactive"}</span>;
  return <div className="admin-category-hierarchy">
    <div className="admin-category-toolbar"><span>{categories.length} main categories</span><button type="button" className="table-action" disabled={!openCategories.length && !openSubcategories.length} onClick={() => { setOpenCategories([]); setOpenSubcategories([]); }}>Collapse all</button></div>
    {categories.map((category) => {
      const id = category.categoryId || category.id;
      const children = subcategories.filter((item) => item.categoryId === id);
      const descendantCount = children.reduce((total, child) => total + subSubcategories.filter((leaf) => leaf.subcategoryId === (child.subcategoryId || child.id)).length, 0);
      const expanded = openCategories.includes(id);
      return <section className="admin-category-group" key={id}>
        <div className="admin-category-bar"><button type="button" className="admin-category-expand" aria-expanded={expanded} onClick={() => toggle(setOpenCategories, id)}><span className="admin-category-chevron" aria-hidden="true">{expanded ? "▾" : "▸"}</span><span><strong>{category.name}</strong><small>{children.length} {children.length === 1 ? "subcategory" : "subcategories"} · {descendantCount} {descendantCount === 1 ? "sub-subcategory" : "sub-subcategories"}</small></span></button>{status(category)}<button type="button" className="admin-category-edit" onClick={() => onEdit("category", category)} aria-label={`Edit category ${category.name}`}>Edit</button></div>
        {expanded && <div className="admin-category-children">{children.length ? children.map((child) => {
          const childId = child.subcategoryId || child.id;
          const leaves = subSubcategories.filter((leaf) => leaf.subcategoryId === childId);
          const childExpanded = openSubcategories.includes(childId);
          return <div className="admin-subcategory-group" key={childId}><div className="admin-subcategory-bar">{leaves.length ? <button type="button" className="admin-category-expand" aria-expanded={childExpanded} onClick={() => toggle(setOpenSubcategories, childId)}><span className="admin-category-chevron" aria-hidden="true">{childExpanded ? "▾" : "▸"}</span><span><strong>{child.name}</strong><small>{leaves.length} {leaves.length === 1 ? "sub-subcategory" : "sub-subcategories"}</small></span></button> : <div className="admin-category-expand static"><span className="admin-category-chevron" aria-hidden="true">•</span><span><strong>{child.name}</strong><small>No sub-subcategories</small></span></div>}{status(child)}<button type="button" className="admin-category-edit" onClick={() => onEdit("subcategory", { ...child, kind: "subcategory" })} aria-label={`Edit subcategory ${child.name}`}>Edit</button></div>{childExpanded && leaves.length > 0 && <div className="admin-subcategory-children">{leaves.map((leaf) => <div className="admin-subcategory-bar leaf" key={leaf.subSubcategoryId || leaf.id}><strong>{leaf.name}</strong>{status(leaf)}<button type="button" className="admin-category-edit" onClick={() => onEdit("subSubcategory", { ...leaf, kind: "subSubcategory" })} aria-label={`Edit sub-subcategory ${leaf.name}`}>Edit</button></div>)}</div>}</div>;
        }) : <p className="muted">No subcategories yet.</p>}</div>}
      </section>;
    })}
  </div>;
}

function RuleSummaryCard({ rule, onOpen }) {
  const now = Date.now();
  const start = rule.startDate ? new Date(rule.startDate).getTime() : 0;
  const end = effectiveRuleEnd(rule.endDate)?.getTime() ?? Infinity;
  const status = rule.archived ? "Archived" : rule.active === false ? "Inactive" : start > now ? "Scheduled" : end < now ? "Expired" : "Active now";
  return <button type="button" className="summary-card" onClick={onOpen} aria-label={`Edit ${rule.name}`}><strong>{rule.name}</strong><span>Discount: {rule.discountType === "PERCENT" ? `${rule.value}%` : money.format(rule.value)}</span><span>Minimum per product: {rule.minQty || 1}</span><span className={status === "Active now" ? "badge success" : "badge danger"}>{status}</span></button>;
}

function AdminPortal() {
  const { user, role } = useAuth();
  const [requestedSection, setSection] = useState("Overview");
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [productCategory, setProductCategory] = useState("all");
  const [orderQuery, setOrderQuery] = useState("");
  const [orderStatus, setOrderStatus] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedMetric, setSelectedMetric] = useState(null), [metricReceipt, setMetricReceipt] = useState(null), [reportUpdatedAt, setReportUpdatedAt] = useState(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [movementQuery, setMovementQuery] = useState("");
  const [movementType, setMovementType] = useState("all");
  const [rankBy, setRankBy] = useState("revenue");
  const [seeding, setSeeding] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editor, setEditor] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [inventory, setInventory] = useState({ type: "receive", productId: "", quantity: "", supplier: "", reason: "", notes: "" });
  const [period, setPeriod] = useState("today");
  const [customRange, setCustomRange] = useState({ start: "", end: "" });
  const [readinessFilter, setReadinessFilter] = useState("all");
  const [attention, setAttention] = useState({ queues: [], updatedAt: null });
  const [attentionLoading, setAttentionLoading] = useState(false), [attentionError, setAttentionError] = useState("");
  const [sectionRecord, setSectionRecord] = useState(null), [saveState, setSaveState] = useState("idle");
  const mutationLock = useRef(false), attentionLock = useRef(false);
  const loadGeneration = useRef(0), authScope = useRef("");
  authScope.current = `${user?.uid || ""}:${role || ""}`;
  const protection = useProductEditorProtection({ editor, setEditor, uid: user?.uid, saving, uploadingImages });
  const readiness = useMemo(() => Object.fromEntries(data.products.map((product) => [product.id, productReadiness(product, data.products, data)])), [data.products, data.categories, data.subcategories, data.subSubcategories]);
  function setProductFilters(filters) { setQuery(filters.query); setProductCategory(filters.category); setStatus(filters.status); setReadinessFilter(filters.readiness); }
  function navigate(tab, record = null) { protection.request(() => { setEditor(null); setSection(tab); setSectionRecord(record); setMobileNavOpen(false); if (tab === "Orders" && record) { setOrderStatus("all"); setOrderQuery(""); setSelectedOrder(record); } }); }
  function viewReadiness(filter) { protection.request(() => { setEditor(null); setProductFilters({ query: "", category: "all", status: "all", readiness: filter }); setSection("Products"); setSectionRecord(null); }); }
  async function loadAttention() {
    const scope = authScope.current;
    if (!user || attentionLock.current === scope) return;
    attentionLock.current = scope; setAttentionLoading(true); setAttentionError("");
    try { const response = await authorizedFetch("/api/admin/attention"), payload = await response.json(); if (!response.ok) throw new Error(payload.error); if (scope === authScope.current) setAttention(payload); }
    catch (reason) { if (scope === authScope.current) setAttentionError(reason.message || "The inbox could not be refreshed."); }
    finally { if (attentionLock.current === scope) { attentionLock.current = false; setAttentionLoading(false); } }
  }

  const isAdmin = ["owner", "admin"].includes(role);
  const nav = isAdmin ? allNav : supervisorNav;
  const section = nav.includes(requestedSection) ? requestedSection : "Overview";
  const navCounts = Object.fromEntries(nav.map((item) => [item, item === "Orders" ? data.metrics.openOrders || 0 : item === "Inventory" ? data.metrics.lowStock || 0 : attention.queues.find((queue) => queue.section === item)?.count || 0]));
  const visibleAttention = { ...attention, queues: attention.queues.filter((queue) => isAdmin || queue.section === "Orders") };

  async function authorizedFetch(url, options = {}) {
    const token = await user.getIdToken();
    return fetch(url, { ...options, headers: { ...(options.headers || {}), authorization: `Bearer ${token}` } });
  }

  async function load() {
    if (!user) return;
    const generation = ++loadGeneration.current, scope = authScope.current;
    setLoading(true); setError("");
    try {
      const response = await authorizedFetch("/api/admin/catalog");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      if (generation === loadGeneration.current && scope === authScope.current) { setData({ ...emptyData, ...payload }); setReportUpdatedAt(new Date().toISOString()); }
    } catch (err) { if (generation === loadGeneration.current && scope === authScope.current) setError(err.message || "Admin data could not be loaded."); }
    finally { if (generation === loadGeneration.current && scope === authScope.current) setLoading(false); }
  }

  useEffect(() => { load(); loadAttention(); if (!isAdmin) { setEditor(null); setSectionRecord(null); } }, [user, role]);
  useEffect(() => { if (section !== "Overview") return; loadAttention(); const timer = setInterval(loadAttention, 60000); return () => clearInterval(timer); }, [section, user, role]);
  useEffect(() => {
    if (!isAdmin || new URLSearchParams(window.location.search).get("newExpense") !== "1") return;
    setSection("Analytics");
    openEditor("expense");
    window.history.replaceState(null, "", "/admin");
  }, [isAdmin]);

  async function mutate(url, payload, successMessage) {
    if (mutationLock.current) return null;
    mutationLock.current = true; setSaving(true); setError(""); setNotice(""); setSaveState("saving");
    try {
      const response = await authorizedFetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setNotice(successMessage); setSaveState("saved");
      protection.saved(); setEditor(null);
      await load();
      return result;
    } catch (err) { setError(err.message || "The change could not be saved."); setSaveState("failed"); if (editor?.type === "product") protection.persist(); return null; }
    finally { setSaving(false); mutationLock.current = false; }
  }

  async function seedCatalogue() {
    setSeeding(true); setNotice(""); setError("");
    try {
      const response = await authorizedFetch("/api/admin/seed", { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setNotice(`${payload.created} products added; ${payload.updated} product details refreshed; ${payload.categoryCreated} categories, ${payload.subcategoryCreated} subcategories and ${payload.subSubcategoryCreated} sub-subcategories added. Existing Admin sort orders and active settings were kept.`);
      await load();
    } catch (err) { setError(err.message || "The catalogue could not be imported."); }
    finally { setSeeding(false); }
  }

  function openEditor(type, item = null) {
    setUploadingImages(false);
    const defaults = {
      product: { create: true, id: "", sku: "", barcode: "", barcodeAdditions: "", archiveBarcodes: [], deleteBarcodes: [], multipleBarcodes: false, name: "", description: "", categoryId: data.categories[0]?.categoryId || "", subcategoryId: "", subSubcategoryId: "", price: "", contactForPrice: false, costPrice: "", lowStockLevel: "", openingStock: 0, active: true, archived: false, pinned: false, randomColours: false, randomShapes: false, randomSizes: false, newArrival: true, collections: [], imageUrl: "", variantEnabled: false, variantTitles: [], variantCombinations: [] },
      category: { create: true, name: "", description: "", sortOrder: Math.max(0, ...data.categories.map((item) => Number(item.sortOrder || 0))) + 1, collections: [], active: true, archived: false },
      subcategory: { create: true, kind: "subcategory", categoryId: data.categories[0]?.categoryId || "", name: "", description: "", sortOrder: data.subcategories.filter((item) => item.categoryId === data.categories[0]?.categoryId).length + 1, collections: [], active: true, archived: false },
      subSubcategory: { create: true, kind: "subSubcategory", categoryId: data.categories[0]?.categoryId || "", subcategoryId: "", name: "", description: "", sortOrder: 1, collections: [], active: true, archived: false },
      discount: { create: true, kind: "discount", ruleId: "", name: "", scopeType: "GLOBAL", scopeId: "", discountType: "PERCENT", value: 5, minQty: 1, priority: 1, active: true, archived: false, startDate: "", endDate: "" },
      promotion: { create: true, kind: "promotion", ruleId: "", name: "", scopeType: "PRODUCT", scopeId: "", discountType: "PERCENT", value: 5, minQty: 1, priority: 1, active: true, archived: false, startDate: "", endDate: "" },
      dealBundle: { create: true, dealId: "", name: "", productIds: [], finalPrice: "", active: true, archived: false },
      staff: { create: true, email: "", displayName: "", role: "cashier", active: true, temporaryPassword: "" },
      setting: { create: true, key: settingKeys.find((key) => !data.settings[key]) || "STORE_NAME", value: "", description: "" },
      expense: { amount: "", category: "Operating expense", description: "", paymentMethod: "cash" },
    };
    protection.request(() => { setSaveState("idle"); protection.start({ type, data: { ...(item ? { ...item, create: false, ...(type === "product" ? { barcodeAdditions: "", archiveBarcodes: [], deleteBarcodes: [], multipleBarcodes: item.multipleBarcodes === true || activeBarcodes(item).length > 1, expectedVersion: item.editVersion, ...editorVariantState(item, data.products) } : {}) } : defaults[type]), acknowledgeOverlap: false } }); });
  }

  function updateEditor(key, value) {
    if (mutationLock.current) return;
    setEditor((current) => ({ ...current, data: { ...current.data, [key]: typeof value === "function" ? value(current.data[key]) : value, ...(key.startsWith("variant") ? { variantDirty: true } : {}), ...(key === "acknowledgeOverlap" ? {} : { acknowledgeOverlap: false }) } }));
  }

  async function saveEditor(event) {
    event.preventDefault();
    if (uploadingImages || saving) return;
    const paths = { product: "products", category: "categories", subcategory: "hierarchy", subSubcategory: "hierarchy", discount: "discounts", promotion: "discounts", dealBundle: "deals", staff: "staff", setting: "settings", expense: "expenses" };
    const labels = { product: "Product saved.", category: "Category saved.", subcategory: "Subcategory saved.", subSubcategory: "Sub-subcategory saved.", discount: "Discount rule saved.", promotion: "Promotion saved.", dealBundle: "PAM Deal bundle saved.", staff: "Staff account saved.", setting: "Setting saved.", expense: "Expense recorded." };
    const payload = { ...editor.data };
    if (editor.type === "product" && !payload.variantDirty) {
      delete payload.variantEnabled;
      delete payload.variantTitles;
      delete payload.variantCombinations;
    }
    delete payload.variantDirty;
    await mutate(`/api/admin/${paths[editor.type]}`, payload, labels[editor.type]);
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
    const matches = `${product.name} ${product.id} ${product.sku || ""} ${activeBarcodes(product).join(" ")} ${product.category}`.toLowerCase().includes(query.trim().toLowerCase());
    const state = status === "all" || (status === "priced" && Number(product.price) > 0) || (status === "needs-pricing" && !(Number(product.price) > 0) && !requiresPricingInquiry(product)) || (status === "quote" && requiresPricingInquiry(product)) || (status === "active" && product.active !== false && !product.archived) || (status === "inactive" && product.active === false && !product.archived) || (status === "low" && Number(product.stock) <= Number(product.lowStockLevel || 8)) || (status === "archived" && product.archived);
    const category = productCategory === "all" || product.categoryId === productCategory;
    return matches && state && category && matchesReadiness(readiness[product.id], readinessFilter);
  }), [data.products, query, status, productCategory, readiness, readinessFilter]);

  const filteredOrders = useMemo(() => data.orders.filter((order) => {
    const searchable = `${order.customer || ""} ${order.phone || ""} ${order.orderId || ""} ${order.createdAt || ""}`.toLowerCase();
    const matchesQuery = searchable.includes(orderQuery.toLowerCase());
    const matchesStatus = orderStatus === "all" || (orderStatus === "pending-payment" ? order.paymentStatus !== "paid" : order.status === orderStatus);
    return matchesQuery && matchesStatus;
  }), [data.orders, orderQuery, orderStatus]);

  const filteredMovements = useMemo(() => data.movements.filter((movement) => {
    const matchesQuery = `${movement.productName || ""} ${movement.productId || ""} ${movement.staffEmail || movement.staff || ""}`.toLowerCase().includes(movementQuery.toLowerCase());
    return matchesQuery && (movementType === "all" || movement.type === movementType);
  }), [data.movements, movementQuery, movementType]);

  const periodReport = useMemo(() => selectReportingPeriod(data.sales, data.expenses, period, customRange), [data.sales, data.expenses, period, customRange]);

  const performance = useMemo(() => {
    const productMap = new Map();
    const categoryMap = new Map();
    const channelMap = new Map();
    const sales = periodReport.sales;
    for (const sale of sales) {
      const channel = sale.salesChannel || "walk-in";
      channelMap.set(channel, (channelMap.get(channel) || 0) + Number(sale.total || 0));
      for (const line of sale.items || []) {
      const lineRevenue = Number(line.lineTotal || 0);
      const lineProfit = line.lineProfit != null ? Number(line.lineProfit) : Number(sale.total || 0) ? Number(sale.profit || 0) * (lineRevenue / Number(sale.total)) : 0;
      const product = productMap.get(line.productId) || { name: line.name, quantity: 0, revenue: 0, profit: 0 };
      product.quantity += Number(line.quantity || 0); product.revenue += lineRevenue; product.profit += lineProfit; productMap.set(line.productId, product);
      const category = line.categorySnapshot?.name || line.categorySnapshot || "Uncategorised";
      const summary = categoryMap.get(category) || { quantity: 0, revenue: 0, profit: 0 };
      summary.quantity += Number(line.quantity || 0); summary.revenue += lineRevenue; summary.profit += lineProfit; categoryMap.set(category, summary);
      }
    }
    const noSales = data.products.filter((product) => product.active !== false && !product.archived && Number(product.price) > 0 && !productMap.has(product.id)).slice(0, 10);
    return {
      products: [...productMap].sort((a, b) => b[1][rankBy] - a[1][rankBy]).slice(0, 10),
      categories: [...categoryMap].sort((a, b) => b[1][rankBy] - a[1][rankBy]),
      channels: [...channelMap].sort((a, b) => b[1] - a[1]),
      noSales,
    };
  }, [periodReport, data.products, rankBy]);

  function comparison(key) {
    if (!periodReport.previous) return "Loaded recorded activity";
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
  const stateCards = [
    ["Products", data.metrics.products || 0, "Catalogue records"],
    ["Low stock", data.metrics.lowStock || 0, "At or below threshold"],
    ["Out of stock", data.metrics.outOfStock || 0, "Priced products"],
  ];
  const openOrderStatuses = ["pending", "processing", "ready"].map((value) => [value, data.orders.filter((order) => order.status === value).length]);
  openOrderStatuses.push(["pending-payment", data.orders.filter((order) => order.paymentStatus !== "paid" && !["completed", "cancelled"].includes(order.status)).length]);

  const primaryAction = {
    Products: <><button className="button secondary" onClick={seedCatalogue} disabled={seeding}>{seeding ? "Importing…" : "Import bundled catalogue"}</button><button type="button" className="button secondary" onClick={() => setImportOpen(true)}>Import / update file</button><button className="button primary" onClick={() => openEditor("product")}>New product</button></>,
    Categories: <><button className="button secondary" onClick={() => openEditor("subcategory")}>New subcategory</button><button className="button secondary" onClick={() => openEditor("subSubcategory")}>New sub-subcategory</button><button className="button primary" onClick={() => openEditor("category")}>New category</button></>,
    Discounts: <button className="button primary" onClick={() => openEditor("discount")}>New rule</button>,
    Promotions: <button className="button primary" onClick={() => openEditor("promotion")}>New promotion</button>,
    Staff: <button className="button primary" onClick={() => openEditor("staff")}>New staff account</button>,
    Settings: <button className="button primary" onClick={() => openEditor("setting")}>Add store setting</button>,
    Analytics: <button className="button primary" onClick={() => openEditor("expense")}>Record expense</button>,
  }[section];

  const overlaps = editor?.type === "discount" || editor?.type === "promotion"
    ? findRuleOverlaps(editor.data, data.discounts, data.dealBundles, data.products)
    : editor?.type === "dealBundle"
      ? findDealOverlaps(editor.data, data.dealBundles, data.discounts, data.products)
      : [];

  return <div className="admin-shell">
    <aside className="admin-sidebar"><div><a className="admin-brand" href="/" aria-label="PAM Essentials home"><BrandLogo background="navy" symbolOnMobile /></a><p className="admin-user">{user?.email}<br /><b>{role}</b></p></div><nav className="admin-grouped-nav" aria-label="Admin sections"><AdminGroupedNavigation allowed={nav} current={section} counts={navCounts} onNavigate={navigate} /></nav><div className="sidebar-actions"><a href="/pos">Open till</a><a href="/">View store</a></div></aside>
    {importOpen && <AdminCatalogueImport products={data.products} authorizedFetch={authorizedFetch} onImported={load} onClose={() => setImportOpen(false)} />}
    <main className="admin-main">
      <header className="admin-topbar"><div className="admin-topbar-identity"><span className="admin-mobile-brand"><BrandLogo symbol /></span><div><p>PAM Essentials & More Admin</p><span>{user?.email}</span></div></div><div><button className="icon-button" onClick={() => protection.request(() => { setEditor(null); load(); loadAttention(); })} aria-label="Refresh">↻</button><button className="icon-button" onClick={() => protection.request(signOut)} aria-label="Sign out">↪</button></div></header>
      <section className="admin-content">
        <div className="page-title"><div><p className="eyebrow">Admin Portal</p><h1>{section}</h1><p>{section === "Overview" ? "Current sales, stock and order health." : `Manage ${section.toLowerCase()} across the store and till.`}</p></div><div className="page-actions">{isAdmin && ["Overview", "Analytics"].includes(section) && <><select aria-label="Reporting period" value={period} onChange={(event) => setPeriod(event.target.value)}><option value="today">Today</option><option value="week">This week</option><option value="month">This month</option><option value="custom">Custom</option><option value="all">All time</option></select>{period === "custom" && <div className="period-custom"><input aria-label="Custom period start" type="date" value={customRange.start} onChange={(event) => setCustomRange((current) => ({ ...current, start: event.target.value }))} /><span>to</span><input aria-label="Custom period end" type="date" min={customRange.start} value={customRange.end} onChange={(event) => setCustomRange((current) => ({ ...current, end: event.target.value }))} /></div>}</>}{primaryAction}</div></div>
        {isAdmin && ["Overview", "Analytics"].includes(section) && <p className="admin-report-period">Selected period: <strong>{periodReport.label}</strong> · Ghana time · sales and expenses by recorded date/time</p>}
        {notice && <p className="notice success-notice">{notice}</p>}{error && <p className="notice error-notice">{error}</p>}
        {loading ? <div className="empty-state"><div className="spinner" /><p>Loading admin data…</p></div> : <>
          {section === "Overview" && <><AdminAttention attention={visibleAttention} loading={attentionLoading} error={attentionError} onRefresh={loadAttention} onNavigate={navigate} />{isAdmin && <AdminReadiness readiness={readiness} onView={viewReadiness} />}<div className="metric-grid">{metricCards.map(([label, value, note]) => <button type="button" className="metric-card metric-card-active" key={label} onClick={() => setSelectedMetric({ label, report: periodReport })} aria-label={`View ${label.toLowerCase()} details`}><p>{label}</p><strong>{value}</strong><span>{note}</span><b className="metric-view-details">View details →</b></button>)}</div>{isAdmin && <div className="metric-grid compact current-state">{stateCards.map(([label, value, note]) => <button type="button" className="metric-card metric-card-active" key={label} onClick={() => setSelectedMetric({ label, report: periodReport })} aria-label={`View ${label.toLowerCase()} details`}><p>{label}</p><strong>{value}</strong><span>{note} · current state</span><b className="metric-view-details">View details →</b></button>)}</div>}<div className="admin-panels"><article className="panel"><div className="panel-title"><h2>Stock attention</h2><button type="button" onClick={() => navigate("Inventory")}>View inventory</button></div><div className="attention-row"><span className="status-icon danger">↓</span><div><b>{data.metrics.lowStock || 0} products are low in stock</b><p>Review quantities before the next trading period.</p></div></div></article><article className="panel"><div className="panel-title"><h2>Open orders</h2><button onClick={() => setSection("Orders")}>View queue</button></div><div className="status-strip">{openOrderStatuses.map(([value, count]) => <button key={value} onClick={() => { setOrderStatus(value); setSection("Orders"); }}><span>{value.replace("-", " ")}</span><b>{count}</b></button>)}</div>{!data.orders.length ? <p className="muted">No orders yet.</p> : data.orders.filter((order) => !["completed", "cancelled"].includes(order.status)).slice(0, 4).map((order) => <div className="order-row" key={order.orderId}><div><b>{order.customer}</b><span>{order.orderId}</span></div><strong>{money.format(order.total || 0)}</strong><span className="badge warning">{order.status}</span></div>)}</article></div></>}

          {section === "Products" && <><AdminProductSearch query={query} setQuery={setQuery} category={productCategory} setCategory={setProductCategory} status={status} setStatus={setStatus} categories={data.categories} products={products} onSelect={(product) => openEditor("product", product)} /><AdminProductWorkspace products={products} data={data} readiness={readiness} filters={{ query, category: productCategory, status, readiness: readinessFilter }} onFilters={setProductFilters} onEdit={(product) => openEditor("product", product)} authorizedFetch={authorizedFetch} onApplied={(result) => { setNotice(`${result.changedCount} product updates saved together and recorded in Audit.`); load(); }} /></>}

          {section === "Categories" && <CategoryHierarchy categories={data.categories} subcategories={data.subcategories} subSubcategories={data.subSubcategories} onEdit={openEditor} />}

          {section === "Inventory" && <><div className="inventory-layout"><form className="panel admin-form" onSubmit={saveInventory}><div className="panel-title"><h2>{inventory.type === "receive" ? "Receive stock" : "Adjust stock"}</h2></div><div className="segmented"><button type="button" className={inventory.type === "receive" ? "active" : ""} onClick={() => setInventory({ ...inventory, type: "receive" })}>Receive</button>{isAdmin && <button type="button" className={inventory.type === "adjust" ? "active" : ""} onClick={() => setInventory({ ...inventory, type: "adjust" })}>Adjust</button>}</div><label>Product<select required value={inventory.productId} onChange={(event) => setInventory({ ...inventory, productId: event.target.value })}><option value="">Choose product</option>{data.products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.stock} in stock</option>)}</select></label><label>{inventory.type === "receive" ? "Quantity received" : "Quantity change (+ or −)"}<input required type="number" value={inventory.quantity} onChange={(event) => setInventory({ ...inventory, quantity: event.target.value })} /></label>{inventory.type === "receive" ? <label>Supplier<input required value={inventory.supplier} onChange={(event) => setInventory({ ...inventory, supplier: event.target.value })} /></label> : <label>Reason<select required value={inventory.reason} onChange={(event) => setInventory({ ...inventory, reason: event.target.value })}><option value="">Choose reason</option><option>Damage</option><option>Shrinkage</option><option>Count correction</option><option>Return</option></select></label>}<label>Notes<textarea value={inventory.notes} onChange={(event) => setInventory({ ...inventory, notes: event.target.value })} /></label><button className="button primary" disabled={saving}>{saving ? "Saving…" : "Record movement"}</button></form><div className="metric-grid compact"><article className="metric-card"><p>Low stock</p><strong>{data.metrics.lowStock || 0}</strong><span>At or below threshold</span></article><article className="metric-card"><p>Out of stock</p><strong>{data.metrics.outOfStock || 0}</strong><span>Priced products</span></article>{isAdmin && <article className="metric-card"><p>Stock valuation</p><strong>{money.format(data.metrics.stockValuation || 0)}</strong><span>Admin only</span></article>}</div></div><div className="table-tools"><input placeholder="Filter product or staff" value={movementQuery} onChange={(event) => setMovementQuery(event.target.value)} /><select value={movementType} onChange={(event) => setMovementType(event.target.value)}><option value="all">All movement types</option><option value="opening">Opening stock</option><option value="receive">Received</option><option value="adjust">Adjusted</option><option value="sale">Sold</option></select><span>{filteredMovements.length} movements</span></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Date</th><th>Product</th><th>Type</th><th>Change</th><th>Stock</th><th>Staff</th></tr></thead><tbody>{filteredMovements.length ? filteredMovements.map((movement) => <tr key={movement.id}><td>{dateTime(movement.createdAt)}</td><td><b>{movement.productName || movement.productId}</b><span>{movement.productId}</span></td><td>{movement.type}</td><td className="num">{Number(movement.quantity || movement.qtyChange) > 0 ? "+" : ""}{movement.quantity || movement.qtyChange}</td><td className="num">{movement.oldStock ?? "—"} → {movement.newStock ?? "—"}</td><td>{movement.staffEmail || movement.staff}</td></tr>) : <tr><td colSpan="6" className="empty-cell">No movements match these filters.</td></tr>}</tbody></table></div></>}

          {section === "Orders" && <><div className="table-tools"><input placeholder="Search name, phone or reference" value={orderQuery} onChange={(event) => setOrderQuery(event.target.value)} /><select value={orderStatus} onChange={(event) => setOrderStatus(event.target.value)}><option value="all">All orders</option><option value="pending-payment">Pending payment</option>{["pending", "confirmed", "paid", "processing", "ready", "completed", "cancelled"].map((value) => <option key={value}>{value}</option>)}</select><span>{filteredOrders.length} orders</span></div>{filteredOrders.length ? <div className="summary-grid">{filteredOrders.map((order) => <button type="button" className="summary-card" key={order.orderId} onClick={() => setSelectedOrder(order)} aria-label={`Open order for ${order.customer || "Guest"}`}><strong>{order.customer || "Guest"}</strong><span>{order.phone || "No phone"}</span><div className="summary-statuses"><span className={order.paymentStatus === "paid" ? "badge success" : "badge neutral"}>{order.paymentStatus || "unpaid"}</span><span className={order.status === "completed" ? "badge success" : order.status === "cancelled" ? "badge danger" : "badge warning"}>{order.status || "pending"}</span></div></button>)}</div> : <div className="empty-state">No orders match these filters.</div>}</>}

          {["Discounts", "Promotions"].includes(section) && <AdminPricingPreview data={data} />}
          {section === "Discounts" && <div className="summary-grid">{data.discounts.filter((rule) => rule.kind !== "promotion").map((rule) => <RuleSummaryCard key={rule.ruleId} rule={rule} onOpen={() => openEditor("discount", rule)} />)}</div>}
          {section === "Promotions" && <div className="summary-grid">{data.discounts.filter((rule) => rule.kind === "promotion").map((rule) => <RuleSummaryCard key={rule.ruleId} rule={rule} onOpen={() => openEditor("promotion", rule)} />)}</div>}

          {section === "Staff" && <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Staff member</th><th>Role</th><th>Status</th><th>Action</th></tr></thead><tbody>{data.users.map((staff) => <tr key={staff.id}><td><b>{staff.displayName || staff.email}</b><span>{staff.email}</span></td><td>{staff.role}</td><td><span className={staff.active ? "badge success" : "badge danger"}>{staff.active ? "Active" : "Inactive"}</span></td><td><button className="table-action" onClick={() => openEditor("staff", { ...staff, uid: staff.id })}>Edit</button></td></tr>)}</tbody></table></div>}

          {section === "Customers" && <AdminCustomers authorizedFetch={authorizedFetch} orders={data.orders} />}
          {section === "Inquiries" && <AdminInquiries initialRecord={sectionRecord} authorizedFetch={authorizedFetch} onChanged={loadAttention} />}
          {section === "Product Requests" && <AdminProductRequests initialRecord={sectionRecord} authorizedFetch={authorizedFetch} onChanged={loadAttention} />}
          {section === "Restock Alerts" && <AdminRestockAlerts authorizedFetch={authorizedFetch} />}
          {section === "Reviews" && <AdminReviews initialRecord={sectionRecord} authorizedFetch={authorizedFetch} onChanged={loadAttention} />}
          {section === "Analytics" && <><AdminAnalyticsCharts report={periodReport} onDetails={(label, report) => setSelectedMetric({ label, report })} /><AdminWishlistAnalytics authorizedFetch={authorizedFetch} products={data.products} /><div className="metric-grid">{metricCards.map(([label, value, note]) => <button type="button" className="metric-card metric-card-active" key={label} onClick={() => setSelectedMetric({ label, report: periodReport })} aria-label={`View ${label.toLowerCase()} details`}><p>{label}</p><strong>{value}</strong><span>{note}</span><b className="metric-view-details">View details →</b></button>)}</div><div className="table-tools analytics-tools"><span>Rank performance by</span><select value={rankBy} onChange={(event) => setRankBy(event.target.value)}><option value="revenue">Revenue</option><option value="quantity">Quantity</option><option value="profit">Profit</option></select></div><div className="admin-panels"><article className="panel"><div className="panel-title"><h2>Top products</h2></div>{performance.products.length ? performance.products.map(([id, value]) => <div className="order-row" key={id}><div><b>{value.name}</b><span>{value.quantity} units · {money.format(value.revenue)} revenue</span></div><strong>{rankBy === "quantity" ? whole.format(value.quantity) : money.format(value[rankBy])}</strong></div>) : <p className="muted">Sales will appear here after checkout.</p>}</article><article className="panel"><div className="panel-title"><h2>Category performance</h2></div>{performance.categories.length ? performance.categories.map(([name, value]) => <div className="order-row" key={name}><div><b>{name}</b><span>{value.quantity} units · {money.format(value.revenue)} revenue</span></div><strong>{rankBy === "quantity" ? whole.format(value.quantity) : money.format(value[rankBy])}</strong></div>) : <p className="muted">No category sales yet.</p>}</article><article className="panel"><div className="panel-title"><h2>Channel split</h2></div>{performance.channels.length ? performance.channels.map(([name, revenue]) => <div className="order-row" key={name}><div><b>{name}</b><span>Sales channel</span></div><strong>{money.format(revenue)}</strong></div>) : <p className="muted">No channel sales yet.</p>}</article><article className="panel"><div className="panel-title"><h2>No-sale products</h2></div>{performance.noSales.length ? performance.noSales.map((product) => <div className="order-row" key={product.id}><div><b>{product.name}</b><span>{product.category} · {product.stock} in stock</span></div><span className="badge warning">No sales</span></div>) : <p className="muted">Every active product sold in this period.</p>}</article><article className="panel"><div className="panel-title"><h2>Recent expenses</h2></div>{periodReport.expenses.length ? periodReport.expenses.slice(0, 10).map((expense) => <div className="order-row" key={expense.id}><div><b>{expense.description}</b><span>{expense.category} · {dateTime(expense.createdAt)}</span></div><strong>{money.format(expense.amount)}</strong></div>) : <p className="muted">No expenses recorded.</p>}</article></div></>}

          {section === "Transactions" && <AdminReceipts sales={data.sales} />}

          {section === "Announcements" && <AdminAnnouncements />}
          {section === "Appearance" && <AdminTypography settings={data.settings} saving={saving} onSave={(payload, message) => mutate("/api/admin/settings", payload, message)} />}

          {section === "Settings" && <AdminHeroGallery settings={data.settings} saving={saving} onSave={(payload, message) => mutate("/api/admin/settings", payload, message)} />}
          {section === "Settings" && <AdminLocationSettings settings={data.settings} saving={saving} onSave={(payload, message) => mutate("/api/admin/settings", payload, message)} />}
          {section === "Settings" && <AdminShoppingSettings settings={data.settings} saving={saving} onSave={(payload, message) => mutate("/api/admin/settings", payload, message)} />}

          {section === "Settings" && <><div className="panel deals-admin-control"><div><h2>PAM Deals</h2><p>{data.settings.PAM_DEALS_ACTIVE?.value === true ? "Active on the storefront" : "Hidden from the storefront"} · {data.products.filter((product) => (product.collections || []).includes("PAM Deals")).length} products tagged</p><small>Tag selected products in Products and add a targeted discount rule before advertising a percentage.</small></div><button type="button" className={data.settings.PAM_DEALS_ACTIVE?.value === true ? "button secondary" : "button primary"} disabled={saving} onClick={() => mutate("/api/admin/settings", { key: "PAM_DEALS_ACTIVE", value: data.settings.PAM_DEALS_ACTIVE?.value !== true, description: "Show PAM Deals collection on the storefront" }, "PAM Deals visibility updated.")}>{data.settings.PAM_DEALS_ACTIVE?.value === true ? "Deactivate PAM Deals" : "Activate PAM Deals"}</button></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Setting</th><th>Value</th><th>Description</th><th>Action</th></tr></thead><tbody>{Object.values(data.settings).map((setting) => <tr key={setting.key}><td><b>{setting.key}</b></td><td>{String(setting.value ?? "")}</td><td>{setting.description || "—"}</td><td><button className="table-action" onClick={() => setting.key === "STOREFRONT_TYPOGRAPHY" ? setSection("Appearance") : openEditor("setting", setting)}>Edit</button></td></tr>)}</tbody></table></div><div className="panel"><div className="panel-title"><div><h2>PAM Deals bundles</h2><p>Combine two or more products and set one final selling price.</p></div><button className="button primary" onClick={() => openEditor("dealBundle")}>New bundle</button></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Bundle</th><th>Products</th><th>Combined price</th><th>Final price</th><th>Status</th><th>Action</th></tr></thead><tbody>{data.dealBundles.length ? data.dealBundles.map((deal) => <tr key={deal.dealId}><td><b>{deal.name}</b><span>{deal.dealId}</span></td><td>{(deal.productIds || []).length}</td><td>{money.format(deal.aggregatePrice || 0)}</td><td>{money.format(deal.finalPrice || 0)}</td><td>{deal.archived ? "Archived" : deal.active !== false ? "Active" : "Inactive"}</td><td><button className="table-action" onClick={() => openEditor("dealBundle", deal)}>Edit</button></td></tr>) : <tr><td colSpan="6" className="empty-cell">No deal bundles configured yet.</td></tr>}</tbody></table></div></div></>}

          {section === "Audit" && <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Timestamp</th><th>Admin</th><th>Action</th><th>Entity</th><th>Description</th></tr></thead><tbody>{data.audit.map((entry) => <tr key={entry.id}><td>{dateTime(entry.timestamp)}</td><td>{entry.adminEmail || entry.admin}</td><td>{entry.action}</td><td><b>{entry.entityType}</b><span>{entry.entityId}</span></td><td>{entry.description}{(entry.oldValue || entry.newValue) && <details className="audit-change-details"><summary>View changes</summary><pre>{JSON.stringify({ before: entry.oldValue, after: entry.newValue }, null, 2)}</pre></details>}</td></tr>)}</tbody></table></div>}
        </>}
      </section>
    </main>
    <div className="admin-mobile-nav"><button type="button" className="admin-mobile-nav-toggle" aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen((open) => !open)}>Admin: {section} <span>{mobileNavOpen ? "Close" : "Sections"} ▴</span></button>{mobileNavOpen && <div className="admin-mobile-nav-panel" role="navigation" aria-label="Admin sections"><AdminGroupedNavigation allowed={nav} current={section} counts={navCounts} onNavigate={navigate} mobile /><a href="/pos">Open Till</a><a href="/">Open Store</a></div>}</div>
    {selectedMetric && (isAdmin || ["Products", "Low stock", "Out of stock", "Open orders"].includes(selectedMetric.label)) && !metricReceipt && <AdminMetricDetails key={selectedMetric.label} label={selectedMetric.label} data={data} report={selectedMetric.report} isAdmin={isAdmin} updatedAt={reportUpdatedAt} onClose={() => setSelectedMetric(null)} onNavigate={(tab) => { setSelectedMetric(null); navigate(tab); }} onOrder={(order) => { setSelectedMetric(null); setSelectedOrder(order); }} onReceipt={(sale) => { if (isAdmin) { setMetricReceipt({ sale, metric: selectedMetric }); setSelectedMetric(null); } }} />}
    {isAdmin && metricReceipt && <ReceiptPanel sale={receiptSnapshot(metricReceipt.sale)} onClose={() => { setSelectedMetric(metricReceipt.metric); setMetricReceipt(null); }} />}
    {isAdmin && editor && <div className="modal-backdrop"><form className="modal editor-modal admin-form" role="dialog" aria-modal="true" aria-labelledby="admin-editor-title" onSubmit={saveEditor}>
      <div className="drawer-title"><div><p className="eyebrow">{editor.data.create ? "Create" : "Edit"}</p><h2 id="admin-editor-title">{editor.type}</h2></div><button type="button" className="icon-button" disabled={saving || uploadingImages} onClick={protection.close}>×</button></div>
      {editor.type === "product" && <AdminDraftRecovery key={editor.data.id || "new"} protection={protection} saveState={saveState} error={error} />}
      <fieldset className="editor-fields-shell" disabled={saving}><EditorFields editor={editor} update={updateEditor} data={data} currentRole={role} onImageBusyChange={setUploadingImages} /></fieldset>
      {["discount", "promotion"].includes(editor.type) && <div className="rule-lifecycle"><p>Minimum quantity is counted separately for each product/SKU. Archiving disables this rule but keeps its history.</p><label><input type="checkbox" checked={editor.data.archived === true} onChange={(event) => updateEditor("archived", event.target.checked)} /> Archived</label></div>}
      {overlaps.length > 0 && <div className="discount-overlap-warning" role="alert"><strong>Possible discount overlap</strong><p>{overlaps.map((item) => `${item.name} (${item.type})`).join(", ")} may cover the same product. Discounts never stack: bundle deals take precedence, then promotions, then standard discounts.</p><label><input type="checkbox" required checked={editor.data.acknowledgeOverlap === true} onChange={(event) => updateEditor("acknowledgeOverlap", event.target.checked)} /> I reviewed the overlap and understand the precedence.</label></div>}
      <div className="editor-actions"><button type="button" className="button secondary" disabled={saving || uploadingImages} onClick={protection.close}>Cancel</button><button className="button primary" disabled={saving || uploadingImages}>{uploadingImages ? "Uploading image…" : saving ? "Saving…" : "Save changes"}</button></div>
    </form></div>}
    <AdminLeaveConfirmation protection={protection} />
    {selectedOrder && <div className="modal-backdrop"><div className="modal editor-modal order-detail"><div className="drawer-title"><div><p className="eyebrow">Order detail</p><h2>{selectedOrder.orderId}</h2></div><button type="button" className="icon-button" onClick={() => setSelectedOrder(null)}>×</button></div><div className="detail-grid"><div><span>Customer</span><b>{selectedOrder.customer}</b></div><div><span>Phone</span><b>{selectedOrder.phone}</b></div><div><span>Created</span><b>{dateTime(selectedOrder.createdAt)}</b></div><div><span>Channel</span><b>{selectedOrder.channel}</b></div><div><span>Fulfilment</span><b>{selectedOrder.deliveryMethod}</b></div><div><span>Shop collection</span><b>{selectedOrder.originAddress || "PAM Essentials & More, Awoshie, Accra, Ghana"}</b></div><div><span>Delivery destination</span><b>{selectedOrder.deliveryAddress || selectedOrder.landmark || "—"}</b></div>{selectedOrder.fulfilmentDetails && <><div><span>Courier fee · separate from PAM total</span><b>{courierFeeLabel(selectedOrder.fulfilmentDetails)}</b></div><div><span>Estimated window</span><b>{selectedOrder.fulfilmentDetails.windowText}</b></div></>}<div><span>Payment</span><b>{selectedOrder.paymentStatus}</b></div><div><span>Status</span><b>{selectedOrder.status}</b></div>{selectedOrder.pickupCode && <div><span>Handover code</span><b>{selectedOrder.pickupCode}</b></div>}</div><h3>Items</h3><div className="order-items">{(selectedOrder.items || []).map((item) => <div className="order-row" key={item.productId}><div><b>{item.name}</b><span>{item.productId} · {item.quantity} × {money.format(item.unitPrice || 0)}</span></div><strong>{money.format(item.lineTotal || 0)}</strong></div>)}</div><div className="order-total"><span>Total</span><strong>{money.format(selectedOrder.total || 0)}</strong></div><div className="editor-actions"><button className="button secondary" onClick={() => setSelectedOrder(null)}>Close</button><select aria-label={`Update ${selectedOrder.orderId}`} value={selectedOrder.status} onChange={async (event) => { await updateOrder(selectedOrder.orderId, event.target.value); setSelectedOrder(null); }}>{["pending", "confirmed", "paid", "processing", "ready", "completed", "cancelled"].map((value) => <option key={value}>{value}</option>)}</select></div></div></div>}
  </div>;
}

const collectionNames = ["Back to School", "Promotion", "PAM Deals"];

function CollectionChoices({ value, update }) {
  return <fieldset><legend>Collections</legend><p className="muted">Selections on a category apply to all products below it. Child selections add to their parent collections.</p><div className="toggle-row">{collectionNames.map((name) => <label key={name}><input type="checkbox" checked={(value.collections || []).includes(name)} onChange={(event) => update("collections", event.target.checked ? [...new Set([...(value.collections || []), name])] : (value.collections || []).filter((item) => item !== name))} /> {name}</label>)}</div></fieldset>;
}

function DealBundleFields({ value, update, products }) {
  const [search, setSearch] = useState("");
  const chosen = new Set(value.productIds || []);
  const selected = products.filter((product) => chosen.has(product.id));
  const aggregate = selected.reduce((sum, product) => sum + Number(product.price || 0), 0);
  const available = products.filter((product) => Number(product.price) > 0 && product.active !== false && !product.archived);
  const matches = available.filter((product) => `${product.name} ${product.id}`.toLowerCase().includes(search.toLowerCase())).slice(0, 80);
  return <>
    <div className="form-grid"><label>Deal ID<input disabled={!value.create} placeholder="Generated from name if blank" value={value.dealId || ""} onChange={(event) => update("dealId", event.target.value)} /></label><label>Deal name<input required value={value.name || ""} onChange={(event) => update("name", event.target.value)} /></label></div>
    <label>Find products<input placeholder="Search name or SKU" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
    <div className="deal-product-picker" role="group" aria-label="Products in deal">{matches.map((product) => <label key={product.id}><input type="checkbox" checked={chosen.has(product.id)} onChange={(event) => update("productIds", event.target.checked ? [...chosen, product.id] : [...chosen].filter((id) => id !== product.id))} /><span>{product.name}<small>{product.id}</small></span><b>{money.format(product.price)}</b></label>)}</div>
    <p>{selected.length} products selected · Combined current price <b>{money.format(aggregate)}</b></p>
    <label>Final selling price<input required type="number" min="0.01" step="0.01" value={value.finalPrice ?? ""} onChange={(event) => update("finalPrice", event.target.value)} /></label>
    <div className="toggle-row"><label><input type="checkbox" checked={value.active !== false && !value.archived} onChange={(event) => update("active", event.target.checked)} /> Active bundle</label><label><input type="checkbox" checked={value.archived === true} onChange={(event) => update("archived", event.target.checked)} /> Archived</label></div>
  </>;
}

function editDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function EditorFields({ editor, update, data, currentRole, onImageBusyChange }) {
  const value = editor.data;
  if (editor.type === "dealBundle") return <DealBundleFields value={value} update={update} products={data.products} />;
  if (editor.type === "product") return <>
    <fieldset><legend>Identity</legend><label>Product ID<input required disabled={!value.create} value={value.id || ""} onChange={(event) => update("id", event.target.value)} /></label><label>Name<input required value={value.name || ""} onChange={(event) => update("name", event.target.value)} /></label><AdminProductBarcodes value={value} update={update} products={data.products} /><label>Description<textarea value={value.description || ""} onChange={(event) => update("description", event.target.value)} /></label></fieldset>
    <fieldset><legend>Pricing · Admin only</legend><div className="form-grid"><label>Selling price<input type="number" min="0" step="0.01" value={value.price ?? ""} onChange={(event) => update("price", event.target.value)} /></label><label>Cost price<input type="number" min="0" step="0.01" value={value.costPrice ?? ""} onChange={(event) => update("costPrice", event.target.value)} /></label></div><label className="checkbox"><input type="checkbox" checked={value.contactForPrice === true} onChange={(event) => update("contactForPrice", event.target.checked)} /> Show customer service / measurement-based quote button when no selling price is set</label><p className="muted">Leave Selling price blank for an inquiry-only product. It will be visible on the storefront, with no Add to cart or POS sale until a selling price is assigned. Other unpriced products remain hidden.</p></fieldset>
    <fieldset><legend>Classification</legend><label>Category<select required value={value.categoryId || ""} onChange={(event) => { update("categoryId", event.target.value); update("subcategoryId", ""); update("subSubcategoryId", ""); }}>{data.categories.map((category) => <option key={category.categoryId} value={category.categoryId}>{category.name}</option>)}</select></label><label>Subcategory<select value={value.subcategoryId || ""} onChange={(event) => { update("subcategoryId", event.target.value); update("subSubcategoryId", ""); }}><option value="">No subcategory</option>{data.subcategories.filter((item) => item.categoryId === value.categoryId && ((item.active !== false && !item.archived) || item.subcategoryId === value.subcategoryId)).map((item) => <option key={item.subcategoryId} value={item.subcategoryId}>{item.name}</option>)}</select></label><label>Sub-subcategory<select value={value.subSubcategoryId || ""} disabled={!value.subcategoryId} onChange={(event) => update("subSubcategoryId", event.target.value)}><option value="">No sub-subcategory</option>{data.subSubcategories.filter((item) => item.subcategoryId === value.subcategoryId && ((item.active !== false && !item.archived) || item.subSubcategoryId === value.subSubcategoryId)).map((item) => <option key={item.subSubcategoryId} value={item.subSubcategoryId}>{item.name}</option>)}</select></label><div className="form-grid"><label>Low-stock level<input type="number" min="0" value={value.lowStockLevel ?? ""} onChange={(event) => update("lowStockLevel", event.target.value)} /></label>{value.create && <label>Opening stock<input type="number" min="0" value={value.openingStock || 0} onChange={(event) => update("openingStock", event.target.value)} /></label>}</div><label>Primary image URL<input type="url" value={value.imageUrl || ""} onChange={(event) => update("imageUrl", event.target.value)} /></label><div className="toggle-row"><label><input type="checkbox" checked={value.pinned || false} onChange={(event) => update("pinned", event.target.checked)} /> Pinned / high-demand</label><label><input type="checkbox" checked={value.newArrival === true} onChange={(event) => update("newArrival", event.target.checked)} /> New arrival</label><label><input type="checkbox" checked={value.randomColours === true} onChange={(event) => update("randomColours", event.target.checked)} /> Random colours (customer may request a choice in notes)</label><label><input type="checkbox" checked={value.randomSizes === true} onChange={(event) => update("randomSizes", event.target.checked)} /> Random sizes (customer may request a choice in notes)</label><label><input type="checkbox" checked={value.randomShapes === true} onChange={(event) => update("randomShapes", event.target.checked)} /> Random shapes (customer may request a choice in notes)</label><label><input type="checkbox" checked={value.active !== false} onChange={(event) => update("active", event.target.checked)} /> Active</label><label><input type="checkbox" checked={value.archived || false} onChange={(event) => update("archived", event.target.checked)} /> Archived</label></div></fieldset>
    <AdminProductImages value={value} update={update} products={data.products} onBusyChange={onImageBusyChange} />
    <AdminProductVariants value={value} update={update} products={data.products} categories={data.categories} subcategories={data.subcategories} subSubcategories={data.subSubcategories} />
    <CollectionChoices value={value} update={update} />
  </>;
  if (editor.type === "category") return <><label>Name<input required value={value.name || ""} onChange={(event) => update("name", event.target.value)} /></label><label>Description<textarea value={value.description || ""} onChange={(event) => update("description", event.target.value)} /></label><label>Sort order<input type="number" min="0" value={value.sortOrder || 0} onChange={(event) => update("sortOrder", event.target.value)} /></label><div className="toggle-row"><label><input type="checkbox" checked={value.active !== false} onChange={(event) => update("active", event.target.checked)} /> Active</label><label><input type="checkbox" checked={value.archived || false} onChange={(event) => update("archived", event.target.checked)} /> Archived</label></div><CollectionChoices value={value} update={update} /></>;
  if (editor.type === "subcategory" || editor.type === "subSubcategory") return <>
    <label>Category<select required disabled={!value.create} value={value.categoryId || ""} onChange={(event) => update("categoryId", event.target.value)}><option value="">Choose category</option>{data.categories.map((item) => <option key={item.categoryId} value={item.categoryId}>{item.name}</option>)}</select></label>
    {editor.type === "subSubcategory" && <label>Subcategory<select required disabled={!value.create} value={value.subcategoryId || ""} onChange={(event) => update("subcategoryId", event.target.value)}><option value="">Choose subcategory</option>{data.subcategories.filter((item) => item.categoryId === value.categoryId).map((item) => <option key={item.subcategoryId} value={item.subcategoryId}>{item.name}</option>)}</select></label>}
    <label>Name<input required value={value.name || ""} onChange={(event) => update("name", event.target.value)} /></label>
    <label>Description<textarea value={value.description || ""} onChange={(event) => update("description", event.target.value)} /></label>
    <label>Sort order within parent<input required type="number" min="0" step="1" value={value.sortOrder ?? 0} onChange={(event) => update("sortOrder", event.target.value)} /></label>
    <div className="toggle-row"><label><input type="checkbox" checked={value.active !== false} onChange={(event) => update("active", event.target.checked)} /> Active</label><label><input type="checkbox" checked={value.archived || false} onChange={(event) => update("archived", event.target.checked)} /> Archived</label></div>
    <CollectionChoices value={value} update={update} />
  </>;
  if (editor.type === "discount" || editor.type === "promotion") return <><div className="form-grid"><label>Rule ID<input disabled={!value.create} value={value.ruleId || ""} onChange={(event) => update("ruleId", event.target.value)} /></label><label>Name<input required value={value.name || ""} onChange={(event) => update("name", event.target.value)} /></label></div><div className="form-grid"><label>Scope<select value={value.scopeType} onChange={(event) => { update("scopeType", event.target.value); update("scopeId", ""); }}><option>GLOBAL</option><option>CATEGORY</option><option>PRODUCT</option></select></label>{value.scopeType !== "GLOBAL" && <label>Scope item<select required value={value.scopeId || ""} onChange={(event) => update("scopeId", event.target.value)}><option value="">Choose item</option>{ruleScopeOptions(value.scopeType, data.categories, data.products).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>}</div><div className="form-grid"><label>Type<select value={value.discountType} onChange={(event) => update("discountType", event.target.value)}><option>PERCENT</option><option>FIXED_AMOUNT</option></select></label><label>Value<input required type="number" min="0" step="0.01" value={value.value ?? ""} onChange={(event) => update("value", event.target.value)} /></label></div><div className="form-grid"><label>Minimum quantity<input type="number" min="1" value={value.minQty || 1} onChange={(event) => update("minQty", event.target.value)} /></label><label>Priority<input type="number" value={value.priority || 0} onChange={(event) => update("priority", event.target.value)} /></label></div><div className="form-grid"><label>Start date and time<input type="datetime-local" value={editDateTime(value.startDate)} onChange={(event) => update("startDate", event.target.value ? new Date(event.target.value).toISOString() : "")} /></label><label>End date and time<input type="datetime-local" value={editDateTime(value.endDate)} onChange={(event) => update("endDate", event.target.value ? new Date(event.target.value).toISOString() : "")} /></label></div><div className="toggle-row"><label><input type="checkbox" checked={value.active !== false} onChange={(event) => update("active", event.target.checked)} /> Active</label></div></>;
  if (editor.type === "staff") return <><label>Email<input required disabled={!value.create} type="email" value={value.email || ""} onChange={(event) => update("email", event.target.value)} /></label><label>Display name<input required value={value.displayName || ""} onChange={(event) => update("displayName", event.target.value)} /></label>{value.create && <label>Temporary password<input required minLength="8" type="password" autoComplete="new-password" value={value.temporaryPassword || ""} onChange={(event) => update("temporaryPassword", event.target.value)} /></label>}<label>Role<select value={value.role || "cashier"} onChange={(event) => update("role", event.target.value)}><option value="cashier">Cashier</option><option value="supervisor">Supervisor</option><option value="admin">Admin</option>{currentRole === "owner" && <option value="owner">Owner</option>}</select></label><div className="toggle-row"><label><input type="checkbox" checked={value.active !== false} onChange={(event) => update("active", event.target.checked)} /> Active account</label></div></>;
  if (editor.type === "setting") return <><label>Key{value.create ? <select value={value.key || ""} onChange={(event) => update("key", event.target.value)}>{settingKeys.filter((key) => !data.settings[key]).map((key) => <option key={key}>{key}</option>)}</select> : <input disabled value={value.key || ""} />}</label><label>Value{typeof value.value === "boolean" ? <select value={String(value.value)} onChange={(event) => update("value", event.target.value === "true")}><option value="true">True</option><option value="false">False</option></select> : <input value={value.value ?? ""} onChange={(event) => update("value", event.target.value)} />}</label><label>Description<textarea value={value.description || ""} onChange={(event) => update("description", event.target.value)} /></label></>;
  if (editor.type === "expense") return <><div className="form-grid"><label>Amount<input required type="number" min="0.01" step="0.01" value={value.amount || ""} onChange={(event) => update("amount", event.target.value)} /></label><label>Payment method<select value={value.paymentMethod || "cash"} onChange={(event) => update("paymentMethod", event.target.value)}><option value="cash">Cash</option><option value="mobile-money">Mobile money</option><option value="bank">Bank</option><option value="other">Other</option></select></label></div><label>Category<input required value={value.category || ""} onChange={(event) => update("category", event.target.value)} /></label><label>Description<textarea required value={value.description || ""} onChange={(event) => update("description", event.target.value)} /></label></>;
  return null;
}

export default function AdminPage() {
  return <RequireRole allow={["owner", "admin", "supervisor"]}><AdminPortal /></RequireRole>;
}
