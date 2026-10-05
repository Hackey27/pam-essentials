"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { priceCart } from "@/lib/commerce";
import { curatedSearches, hasCollection, inCollection, isBestSeller, isNewArrival, isOnSale, isPromotion, matchesSearch, promotionPrice } from "@/lib/catalogueBrowse.mjs";
import ProductOptions, { ProductImage, variantPrice } from "@/components/ProductOptions";
import { addToCart, readCart, saveCart } from "@/lib/storeCart";
import { useAuth } from "@/components/AuthProvider";
import { PRIMARY_WHATSAPP, PRIMARY_PHONE_LABEL, SECONDARY_PHONE_LABEL, OPENING_HOURS } from "@/lib/shop";
import { CURRENT_SHOP_ADDRESS } from "@/lib/shopAddress.mjs";
import { whatsappOrderMessage } from "@/lib/whatsappOrder.mjs";
import WhatsAppIcon from "@/components/WhatsAppIcon";
import { getHeroImageUrl } from "@/lib/heroImages.mjs";
import BrandLogo from "@/components/BrandLogo";
import { readCompare, toggleCompare } from "@/lib/compare.mjs";
import { sortProducts } from "@/lib/catalogueSort.mjs";
import { quantityOfferMessage } from "@/lib/quantityOffer.mjs";
import { variantDetail } from "@/lib/variantDisplay.mjs";

const money = new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" });

function ProductArt({ name, category }) {
  const initials = name.split(" ").slice(0, 2).map((word) => word[0]).join("");
  return <div className="product-art" aria-label={`${name} image placeholder`}><span>{initials}</span><small>{category}</small></div>;
}

function Dropdown({ label, children, active = false, utility = false }) {
  const detailsRef = useRef(null);
  const closeTimer = useRef(null);
  useEffect(() => () => clearTimeout(closeTimer.current), []);
  const cancelClose = () => clearTimeout(closeTimer.current);
  const scheduleClose = () => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    cancelClose();
    closeTimer.current = setTimeout(() => {
      if (detailsRef.current) detailsRef.current.open = false;
    }, 1000);
  };
  return <details ref={detailsRef} className={`${utility ? "utility-dropdown" : "nav-dropdown"}${active ? " active" : ""}`} onMouseEnter={cancelClose} onMouseLeave={scheduleClose}><summary>{label}<span aria-hidden="true">▾</span></summary><div className="dropdown-menu" onClick={(event) => { if (event.target.closest("a,button")) { cancelClose(); event.currentTarget.parentElement.open = false; } }}>{children}</div></details>;
}

export default function Storefront() {
  const { user, role } = useAuth();
  const [products, setProducts] = useState([]);
  const [categoryList, setCategoryList] = useState([]);
  const [subcategoryList, setSubcategoryList] = useState([]);
  const [subSubcategoryList, setSubSubcategoryList] = useState([]);
  const [expandedCategories, setExpandedCategories] = useState([]);
  const [expandedSubcategories, setExpandedSubcategories] = useState([]);
  const [selectedSubcategories, setSelectedSubcategories] = useState([]);
  const [selectedSubSubcategories, setSelectedSubSubcategories] = useState([]);
  const [availability, setAvailability] = useState("all");
  const [offer, setOffer] = useState("all");
  const [collection, setCollection] = useState("");
  const [popularProducts, setPopularProducts] = useState([]);
  const [publicLaunch, setPublicLaunch] = useState(false);
  const [dealsActive, setDealsActive] = useState(false);
  const [dealBundles, setDealBundles] = useState([]);
  const [flyerUrl, setFlyerUrl] = useState("");
  const [webHeroPath, setWebHeroPath] = useState("");
  const [mobileHeroPath, setMobileHeroPath] = useState("");
  const [heroWebImages, setHeroWebImages] = useState([]);
  const [heroMobileImages, setHeroMobileImages] = useState([]);
  const [heroIndex, setHeroIndex] = useState(0);
  const [storeLocation, setStoreLocation] = useState(CURRENT_SHOP_ADDRESS);
  const [mapsUrl, setMapsUrl] = useState("");
  const [openingHours, setOpeningHours] = useState(OPENING_HOURS);
  const [discountRules, setDiscountRules] = useState([]);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [mobileTabsHidden, setMobileTabsHidden] = useState(false);
  const [category, setCategory] = useState("All categories");
  const [sort, setSort] = useState("categories");
  const [browseMode, setBrowseMode] = useState("products");
  const [pageSize, setPageSize] = useState(100);
  const [gridDensity, setGridDensity] = useState("standard");
  const [compareIds, setCompareIds] = useState([]);
  const [wishlistIds, setWishlistIds] = useState([]);
  const [saveNotice, setSaveNotice] = useState("");
  const [page, setPage] = useState(1);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [cart, setCart] = useState([]);
  const [quickProduct, setQuickProduct] = useState(null);
  const [addedProduct, setAddedProduct] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const crawlerAnnouncements = announcements.filter((item) => item.style === "crawler");
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [announcementOptOut, setAnnouncementOptOut] = useState(false);
  const announcementOptOutRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checkout, setCheckout] = useState(false);
  const [order, setOrder] = useState({ customer: "", phone: "", deliveryMethod: "pickup", deliveryAddress: "", notes: "" });
  const [confirmation, setConfirmation] = useState(null);
  const [exitConfirm, setExitConfirm] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [cookieVisible, setCookieVisible] = useState(false);
  const clickSession = useRef({ id: "", seen: new Set() });
  const orderRequest = useRef(false);
  const searchRef = useRef(null);
  const cartReturn = useRef("");
  const listingRestore = useRef(null);
  const previousLayer = useRef("");
  const closingOverlay = useRef(false);
  const leavingStore = useRef(false);
  const activeLayer = exitConfirm ? "exit" : confirmation ? "confirmation" : addedProduct ? "added" : quickProduct ? "quick" : cartOpen ? "cart" : mobileFiltersOpen ? "filters" : servicesOpen ? "services" : announcementOpen ? "announcement" : "";
  const activeLayerRef = useRef("");
  activeLayerRef.current = activeLayer;

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem("pam-listing-return") || "null");
      const returnUrl = new URL(window.location.href);
      returnUrl.searchParams.delete("quick");
      if (!saved || saved.path !== returnUrl.pathname + returnUrl.search || Date.now() - saved.at > 15 * 60 * 1000) { if (window.matchMedia("(max-width: 767px)").matches) setPageSize(30); return; }
      listingRestore.current = saved;
      setQuery(saved.query || ""); setCategory(saved.category || "All categories");
      setSelectedSubcategories(saved.subcategories || []); setSelectedSubSubcategories(saved.subSubcategories || []);
      setAvailability(saved.availability || "all"); setOffer(saved.offer || "all"); setCollection(saved.collection || "");
      setBrowseMode(saved.browseMode || "products"); setSort(saved.sort || "categories");
      setPageSize(saved.pageSize || 100); setPriceMin(saved.priceMin || ""); setPriceMax(saved.priceMax || "");
      sessionStorage.removeItem("pam-listing-return");
    } catch { sessionStorage.removeItem("pam-listing-return"); if (window.matchMedia("(max-width: 767px)").matches) setPageSize(30); }
  }, []);

  useEffect(() => {
    fetch("/api/catalog/products")
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); setProducts(data.products || []); setCategoryList(data.categories || []); setSubcategoryList(data.subcategories || []); setSubSubcategoryList(data.subSubcategories || []); setDiscountRules(data.discountRules || []); setDealBundles(data.dealBundles || []); setPopularProducts(data.popularProducts || []); setPublicLaunch(data.publicLaunch === true); setDealsActive(data.dealsActive === true); setFlyerUrl(data.flyerUrl || ""); setWebHeroPath(data.webHeroPath || ""); setMobileHeroPath(data.mobileHeroPath || ""); setHeroWebImages(data.heroWebImages || []); setHeroMobileImages(data.heroMobileImages || []); setStoreLocation(data.storeLocation || CURRENT_SHOP_ADDRESS); setMapsUrl(data.mapsUrl || ""); setOpeningHours(data.openingHours || OPENING_HOURS); setAnnouncements(data.announcements || []); if ((data.announcements || []).length && localStorage.getItem("pam-announcements-off") !== "1" && sessionStorage.getItem("pam-announcements-seen") !== "1") setAnnouncementOpen(true); const params = new URLSearchParams(window.location.search); const mode = params.get("browse"); if (["new", "promotions"].includes(mode) || mode === "deals" && data.dealsActive === true) { setBrowseMode(mode); setSort(mode === "new" ? "latest" : mode === "deals" ? "price-low" : "promotions"); } const quickId = params.get("quick"); if (quickId) setQuickProduct((data.products || []).find((item) => item.id === quickId) || null); const current = readCart(); const refreshed = current.map((line) => { const product = (data.products || []).find((item) => item.id === line.id); return product && product.stock > 0 ? { ...product, quantity: Math.min(Number(line.quantity), Number(product.stock)) } : null; }).filter(Boolean); saveCart(refreshed); setCart(refreshed); })
      .catch((err) => setError(err.message || "The catalogue is unavailable."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { setCookieVisible(localStorage.getItem("pam-cookie-notice") !== "accepted"); }, []);
  useEffect(() => { if (Math.max(heroWebImages.length, heroMobileImages.length) < 2) return; const timer = setInterval(() => setHeroIndex((index) => index + 1), 6000); return () => clearInterval(timer); }, [heroWebImages.length, heroMobileImages.length]);
  useEffect(() => { setCompareIds(readCompare(localStorage)); }, []);
  useLayoutEffect(() => { if (new URLSearchParams(window.location.search).has("returnToFooter")) document.getElementById("store-footer")?.scrollIntoView({ behavior: "instant", block: "start" }); }, []);
  useEffect(() => { if (loading) return; const returning = new URLSearchParams(window.location.search).has("returnToFooter"); if (returning || window.location.hash === "#store-footer") { document.getElementById("store-footer")?.scrollIntoView({ behavior: "instant", block: "start" }); if (returning) window.history.replaceState({}, "", "/#store-footer"); } }, [loading]);
  useEffect(() => {
    if (!user || role) { setWishlistIds([]); return; }
    user.getIdToken().then((token) => fetch("/api/customer/wishlist", { headers: { authorization: `Bearer ${token}` } })).then((response) => response.json()).then((data) => setWishlistIds(data.wishlist || [])).catch(() => {});
  }, [user, role]);
  useEffect(() => { setCart(readCart()); const params = new URLSearchParams(window.location.search); if (params.has("cart")) setCartOpen(true); const source = params.get("returnTo"); if (source?.startsWith("/products/") && !source.startsWith("//")) cartReturn.current = source; }, []);
  useEffect(() => { const close = (event) => { if (!searchRef.current?.contains(event.target)) setSearchOpen(false); }; document.addEventListener("pointerdown", close); return () => document.removeEventListener("pointerdown", close); }, []);
  useEffect(() => {
    let lastY = window.scrollY, travel = 0, frame = 0, ignoreUntil = 0;
    const update = () => {
      frame = 0;
      if (window.innerWidth > 767) { setMobileTabsHidden(false); travel = 0; lastY = window.scrollY; return; }
      const delta = window.scrollY - lastY;
      lastY = window.scrollY;
      if (performance.now() < ignoreUntil) return;
      if (window.scrollY < 90) { setMobileTabsHidden(false); travel = 0; return; }
      if (Math.sign(delta) !== Math.sign(travel)) travel = 0;
      travel = Math.max(-60, Math.min(60, travel + delta));
      if (travel > 32 && window.scrollY > 200) { setMobileTabsHidden(true); travel = 0; ignoreUntil = performance.now() + 450; }
      if (travel < -28) { setMobileTabsHidden(false); travel = 0; ignoreUntil = performance.now() + 450; }
    };
    const queue = () => { if (!frame) frame = requestAnimationFrame(update); };
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    return () => { window.removeEventListener("scroll", queue); window.removeEventListener("resize", queue); cancelAnimationFrame(frame); };
  }, []);
  useEffect(() => {
    const dismissUntypedSearch = () => {
      if (window.innerWidth > 767 || query.trim() || !searchOpen) return;
      const input = searchRef.current?.querySelector("input");
      if (document.activeElement === input) { input.blur(); setSearchOpen(false); }
    };
    // A keyboard opening can itself scroll the viewport; only a user scroll gesture should dismiss it.
    window.addEventListener("touchmove", dismissUntypedSearch, { passive: true });
    window.addEventListener("wheel", dismissUntypedSearch, { passive: true });
    return () => { window.removeEventListener("touchmove", dismissUntypedSearch); window.removeEventListener("wheel", dismissUntypedSearch); };
  }, [query, searchOpen]);
  useEffect(() => {
    if (window.innerWidth > 767) return;
    if (leavingStore.current) return;
    const pushGuard = () => window.history.pushState({ ...window.history.state, pamStoreGuard: true, pamStoreOverlay: null }, "", window.location.href);
    if (!window.history.state?.pamStoreGuard && !window.history.state?.pamStoreOverlay) pushGuard();
    const onBack = () => {
      if (closingOverlay.current) { closingOverlay.current = false; return; }
      const layer = activeLayerRef.current;
      if (layer) {
        if (layer === "cart" && cartReturn.current) { window.location.replace(cartReturn.current); return; }
        if (layer === "exit") setExitConfirm(false);
        else if (layer === "confirmation") setConfirmation(null);
        else if (layer === "added") setAddedProduct(null);
        else if (layer === "quick") setQuickProduct(null);
        else if (layer === "filters") setMobileFiltersOpen(false);
        else if (layer === "services") setServicesOpen(false);
        else if (layer === "announcement") dismissAnnouncement();
        return;
      }
      if (window.scrollY > 110) window.scrollTo({ top: 0, behavior: "smooth" });
      else setExitConfirm(true);
      pushGuard();
    };
    window.addEventListener("popstate", onBack);
    return () => window.removeEventListener("popstate", onBack);
  }, []);
  useEffect(() => {
    if (window.innerWidth > 767) return;
    if (leavingStore.current) return;
    const previous = previousLayer.current;
    if (activeLayer && !previous) window.history.pushState({ ...window.history.state, pamStoreOverlay: activeLayer }, "", window.location.href);
    else if (activeLayer && previous && window.history.state?.pamStoreOverlay) window.history.replaceState({ ...window.history.state, pamStoreOverlay: activeLayer }, "", window.location.href);
    else if (!activeLayer && previous && window.history.state?.pamStoreOverlay) { closingOverlay.current = true; window.history.back(); }
    previousLayer.current = activeLayer;
  }, [activeLayer]);

  function dismissAnnouncement() {
    try { sessionStorage.setItem("pam-announcements-seen", "1"); if (announcementOptOutRef.current) localStorage.setItem("pam-announcements-off", "1"); } catch {}
    setAnnouncementOpen(false);
  }

  const categories = useMemo(() => {
    const ordered = categoryList.map((item) => item.name);
    return ["All categories", ...(ordered.length ? ordered : [...new Set(products.map((product) => product.category))])];
  }, [products, categoryList]);
  const currentCategory = categoryList.find((item) => item.name === category);
  const suggestions = useMemo(() => query.trim() ? products.filter((item) => matchesSearch(item, query)).sort((a, b) => Number(b.name.toLowerCase().startsWith(query.trim().toLowerCase())) - Number(a.name.toLowerCase().startsWith(query.trim().toLowerCase())) || a.name.localeCompare(b.name)).slice(0, 8) : [], [products, query]);
  const currentCategoryId = currentCategory?.categoryId || currentCategory?.id || "";
  const selectedNodes = [
    ...selectedSubcategories.map((id) => subcategoryList.find((item) => item.subcategoryId === id)).filter(Boolean),
    ...selectedSubSubcategories.map((id) => subSubcategoryList.find((item) => item.subSubcategoryId === id)).filter(Boolean),
  ];
  const singleSelection = selectedNodes.length === 1 ? selectedNodes[0] : null;
  const categoryHeading = browseMode === "products" ? category : browseMode === "new" ? "New Arrivals" : browseMode === "promotions" ? "Promotions" : "Deals";
  const heading = browseMode === "products" && singleSelection ? singleSelection.name : categoryHeading;
  const breadcrumb = browseMode !== "products" ? `Home / ${categoryHeading}` :
    category === "All categories" ? "Home / All categories" :
    singleSelection?.subSubcategoryId ? `Home / ${category} / ${subcategoryList.find((item) => item.subcategoryId === singleSelection.subcategoryId)?.name || ""} / ${singleSelection.name}` :
    singleSelection ? `Home / ${category} / ${singleSelection.name}` : `Home / ${category}`;
  const visible = useMemo(() => {
    const filtered = products.filter((product) =>
      matchesSearch(product, query) &&
      (category === "All categories" || product.category === category) &&
      (!selectedSubcategories.length && !selectedSubSubcategories.length ||
        selectedSubcategories.includes(product.subcategoryId) || selectedSubSubcategories.includes(product.subSubcategoryId)) &&
      (priceMin === "" || product.price >= Number(priceMin)) && (priceMax === "" || product.price <= Number(priceMax)) &&
      (availability === "all" || (availability === "in" ? product.stock > 0 : product.stock <= 0)) &&
      (offer === "all" || (offer === "sale" ? isOnSale(product, discountRules) : isPromotion(product, discountRules))) &&
      inCollection(product, collection, discountRules) &&
      (browseMode === "products" || (browseMode === "new" ? isNewArrival(product) : browseMode === "promotions" ? isPromotion(product, discountRules) : dealsActive && hasCollection(product, "PAM Deals")))
    );
    return sortProducts(filtered, browseMode === "new" ? "latest" : sort, discountRules);
  }, [products, discountRules, query, category, selectedSubcategories, selectedSubSubcategories, sort, browseMode, priceMin, priceMax, availability, offer, collection, publicLaunch, dealsActive]);
  const dealProducts = products.filter((product) => hasCollection(product, "PAM Deals"));
  const dealPercent = Math.max(0, ...discountRules.filter((rule) => rule.discountType === "PERCENT" && Number(rule.value) <= 20 && rule.scopeType !== "GLOBAL" && dealProducts.some((product) => rule.scopeType === "PRODUCT" ? rule.scopeId === product.id : rule.scopeType === "CATEGORY" && rule.scopeId === product.categoryId)).map((rule) => Number(rule.value || 0)));
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const pagedProducts = visible.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    if (loading || !listingRestore.current) return;
    const saved = listingRestore.current;
    listingRestore.current = null;
    setPage(Math.max(1, Number(saved.page) || 1));
    requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({ top: Number(saved.y) || 0, behavior: "instant" })));
  }, [loading, visible.length, pageSize]);

  useEffect(() => { setPage(1); }, [query, category, selectedSubcategories, selectedSubSubcategories, availability, offer, collection, sort, browseMode, priceMin, priceMax, pageSize]);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const addedCartLine = addedProduct && cart.find((item) => item.id === addedProduct.id);
  const pricing = priceCart(cart, discountRules, dealBundles);
  const { subtotal, discount, total } = pricing;
  const webHeroUrl = getHeroImageUrl(heroWebImages.length ? heroWebImages[heroIndex % heroWebImages.length].path : webHeroPath, 2200);
  const mobileHeroUrl = getHeroImageUrl(heroMobileImages.length ? heroMobileImages[heroIndex % heroMobileImages.length].path : mobileHeroPath, 1200) || webHeroUrl;
  const heroBackground = (url) => url ? { backgroundImage: `linear-gradient(#00235b99, #00235b99), url(${JSON.stringify(url)})` } : flyerUrl ? { backgroundImage: `url(${JSON.stringify(flyerUrl)})` } : undefined;

  function browse(mode) {
    if (mode === "deals" && !dealsActive) return;
    setBrowseMode(mode);
    setCategory("All categories");
    setSelectedSubcategories([]);
    setSelectedSubSubcategories([]);
    setAvailability("all");
    setOffer("all");
    setCollection("");
    setQuery("");
    setSort(mode === "new" ? "latest" : mode === "deals" ? "price-low" : mode === "promotions" ? "promotions" : "categories");
    document.getElementById("catalogue")?.scrollIntoView({ behavior: "smooth" });
  }

  function searchPopular(term) {
    setBrowseMode("products");
    setCategory("All categories");
    setSelectedSubcategories([]);
    setSelectedSubSubcategories([]);
    setQuery(term);
    setSearchOpen(false);
    searchRef.current?.querySelector("input")?.blur();
    document.getElementById("catalogue")?.scrollIntoView({ behavior: "smooth" });
  }

  function submitSearch() {
    setSearchOpen(false);
    searchRef.current?.querySelector("input")?.blur();
    setPage(1);
    document.getElementById("catalogue")?.scrollIntoView({ behavior: "smooth" });
  }

  function rememberListingContext() {
    try { sessionStorage.setItem("pam-listing-return", JSON.stringify({ at: Date.now(), path: window.location.pathname + window.location.search, y: window.scrollY, query, category, subcategories: selectedSubcategories, subSubcategories: selectedSubSubcategories, availability, offer, collection, browseMode, sort, pageSize, page, priceMin, priceMax })); } catch {}
    if (window.history.state?.pamStoreOverlay) window.history.replaceState({ ...window.history.state, pamStoreOverlay: null, pamStoreGuard: true }, "", window.location.href);
  }

  function closeCart() {
    setCartOpen(false);
    setCheckout(false);
    if (cartReturn.current) window.location.replace(cartReturn.current);
  }

  function clearFilters() {
    setPriceMin(""); setPriceMax(""); setCategory("All categories");
    setSelectedSubcategories([]); setSelectedSubSubcategories([]);
    setAvailability("all"); setOffer("all"); setCollection("");
  }

  function selectCategory(name, id = "") {
    setSelectedSubcategories([]);
    setSelectedSubSubcategories([]);
    if (name === "All categories") {
      setCategory(name);
      return;
    }
    if (category !== name) {
      setCategory(name);
      setExpandedCategories((current) => [...new Set([...current, id])]);
    } else {
      setExpandedCategories((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    }
    setBrowseMode("products");
  }

  function toggleSubcategory(item) {
    const id = item.subcategoryId || item.id;
    const parent = categoryList.find((entry) => (entry.categoryId || entry.id) === item.categoryId);
    if (parent && category !== parent.name) {
      setCategory(parent.name);
      setSelectedSubcategories([id]);
    } else {
      setSelectedSubcategories((current) => current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]);
    }
    setSelectedSubSubcategories([]);
    setExpandedCategories((current) => [...new Set([...current, item.categoryId])]);
    setExpandedSubcategories((current) => [...new Set([...current, id])]);
    setBrowseMode("products");
  }

  function toggleSubSubcategory(item) {
    const id = item.subSubcategoryId || item.id;
    const parent = subcategoryList.find((entry) => (entry.subcategoryId || entry.id) === item.subcategoryId);
    const top = categoryList.find((entry) => (entry.categoryId || entry.id) === item.categoryId);
    if (top) setCategory(top.name);
    setSelectedSubcategories([]);
    setSelectedSubSubcategories((current) => current.length === 1 && current[0] === id ? [] : [id]);
    if (top) setExpandedCategories((current) => [...new Set([...current, item.categoryId])]);
    if (parent) setExpandedSubcategories((current) => [...new Set([...current, item.subcategoryId])]);
    setBrowseMode("products");
  }

  function recordClick(product) {
    if (!publicLaunch || clickSession.current.seen.has(product.id) || sessionStorage.getItem(`pam-click-${product.id}`)) return;
    if (!clickSession.current.id) clickSession.current.id = sessionStorage.getItem("pam-visitor-id") || crypto.randomUUID();
    sessionStorage.setItem("pam-visitor-id", clickSession.current.id);
    sessionStorage.setItem(`pam-click-${product.id}`, "1");
    clickSession.current.seen.add(product.id);
    fetch("/api/catalog/engagement", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ productId: product.id, visitorId: clickSession.current.id }),
      keepalive: true,
    }).catch(() => {});
  }

  function add(product, quantity = 1) {
    recordClick(product);
    const next = addToCart(readCart(), product, quantity);
    saveCart(next); setCart(next);
    setQuickProduct(null);
    setAddedProduct({ ...product, quantity });
  }

  function addBundle(deal) {
    if (!deal.available) return;
    let next = readCart();
    for (const id of deal.productIds) {
      const product = products.find((item) => item.id === id);
      if (!product || next.find((item) => item.id === id)?.quantity >= product.stock) { setError("A product in this deal is no longer available in the selected quantity."); return; }
      next = addToCart(next, product, 1);
    }
    saveCart(next); setCart(next); setAddedProduct({ name: deal.name, id: deal.dealId, quantity: 1 });
  }

  function updateQuantity(id, quantity) {
    setCart((current) => { const next = current.map((item) => item.id === id ? { ...item, quantity: Math.min(item.stock, Math.max(0, quantity)) } : item).filter((item) => item.quantity > 0); saveCart(next); return next; });
  }

  function compareProduct(product) {
    const full = compareIds.length >= 4 && !compareIds.includes(product.id);
    if (full) { setSaveNotice("You can compare up to four products. Remove one first."); return; }
    const next = toggleCompare(localStorage, product.id);
    setCompareIds(next);
    setSaveNotice(next.includes(product.id) ? `${product.name} added to comparison.` : `${product.name} removed from comparison.`);
  }

  async function wishlistProduct(product) {
    if (!user || role) { window.location.href = `/account?mode=register&wishlist=${encodeURIComponent(product.id)}`; return; }
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/customer/wishlist", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ productId: product.id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save this product.");
      setWishlistIds((current) => [...new Set([...current, product.id])]);
      setSaveNotice(`${product.name} added to your wishlist.`);
    } catch (reason) { setSaveNotice(reason.message || "Could not save this product."); }
  }

  async function createOrder(channel = "website") {
    if (orderRequest.current) return null;
    orderRequest.current = true;
    setPlacingOrder(true); setError("");
    try {
      const token = user && !role ? await user.getIdToken() : "";
      const response = await fetch("/api/orders", { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ ...order, channel, items: cart.map(({ id, quantity }) => ({ id, quantity })) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The order could not be created.");
      return data;
    } catch (err) { setError(err.message || "The order could not be created."); return null; }
    finally { orderRequest.current = false; setPlacingOrder(false); }
  }

  async function placeOrder(event) {
    event.preventDefault();
    const data = await createOrder("website");
    if (data) { setConfirmation(data); setCart([]); saveCart([]); setCheckout(false); }
  }

  async function orderOnWhatsApp() {
    if (!order.customer || !order.phone || (order.deliveryMethod === "delivery-shop" && !order.deliveryAddress)) {
      setError("Complete the checkout details before ordering on WhatsApp."); return;
    }
    const whatsappWindow = window.open("", "_blank");
    const data = await createOrder("whatsapp");
    if (!data) { whatsappWindow?.close(); return; }
    const message = whatsappOrderMessage(data, order.customer, order.phone);
    const whatsappUrl = `https://wa.me/${PRIMARY_WHATSAPP}?text=${encodeURIComponent(message)}`;
    if (whatsappWindow) whatsappWindow.location.href = whatsappUrl;
    else window.location.href = whatsappUrl;
    setConfirmation(data); setCart([]); saveCart([]); setCheckout(false);
  }

  return (
    <div className={`store-shell${crawlerAnnouncements.length ? " has-top-announcements" : ""}${mobileTabsHidden || mobileFiltersOpen ? " mobile-tabs-hidden" : ""}`}>
      <div className="utility-bar"><span>Opening hours: {openingHours}</span><div><Dropdown label="Store Location" utility><a href="/info/contact#location">Address and opening hours</a>{mapsUrl && <a href={mapsUrl} target="_blank" rel="noreferrer">Open Google Maps</a>}</Dropdown><Dropdown label="Contact Us" utility><a href={`https://wa.me/${PRIMARY_WHATSAPP}`} target="_blank" rel="noreferrer"><WhatsAppIcon size={16} /> WhatsApp us</a><a href="tel:+233596661439">Call {PRIMARY_PHONE_LABEL}</a><a href="/info/contact#contact">All contact details</a></Dropdown><Dropdown label="Track Order" utility><a href="/account#orders">View my orders</a><a href="/account?mode=signin">Sign in to track</a></Dropdown><Dropdown label="Wishlist" utility><a href="/account#wishlist">View wishlist</a><a href="/compare">Compare products</a></Dropdown><Dropdown label={user && !role ? "My Account" : "Sign In"} utility><a href="/account?mode=signin">Sign in</a>{(!user || role) && <a href="/account?mode=register">Create account</a>}</Dropdown></div></div>
      <div className="store-top-bar">
        <div className="mobile-opening-hours">Opening hours: {openingHours}</div>
        {crawlerAnnouncements.length > 0 && <section className="top-announcement-crawler" aria-label="Store announcements"><div className="top-announcement-track" style={{ animationDuration: `${Math.max(20, crawlerAnnouncements.reduce((length, item) => length + item.title.length + item.body.length, 0) / 10)}s` }}>{crawlerAnnouncements.map((item) => <span key={item.announcementId}><strong>{item.title}:</strong> {item.body}{item.actionLabel && item.actionUrl && <a href={item.actionUrl}>{item.actionLabel}</a>}</span>)}</div></section>}
      </div>
      <header className={`store-header${mobileTabsHidden || mobileFiltersOpen ? " mobile-tabs-hidden" : ""}`}>
        <div className="header-main">
          <a className="brand" href="/" aria-label="PAM Essentials home"><BrandLogo background="white" mobileBackground="navy" /></a>
          <nav className="store-nav" aria-label="Primary navigation">
            <Dropdown label="Products" active={browseMode === "products"}><button type="button" onClick={() => browse("products")}>All products</button><button type="button" onClick={() => { browse("products"); document.getElementById("catalogue")?.scrollIntoView(); }}>Categories and filters</button></Dropdown>
            <Dropdown label="Services"><button type="button" onClick={() => setServicesOpen(true)}>All services and contact</button><a href="/services/secretarial">Secretarial services</a><a href="/services/printing">Printing</a><a href="/services/communication">Communication consultancy</a><a href="/services/laptop-repairs">Laptop repairs and purchases</a></Dropdown>
            <Dropdown label={<><span className="nav-full">New Arrivals</span><span className="nav-short">New</span></>} active={browseMode === "new"}><button type="button" onClick={() => browse("new")}>Shop new arrivals</button></Dropdown>
            <Dropdown label={<><span className="nav-full">Promotions</span><span className="nav-short">Promos</span></>} active={browseMode === "promotions"}><button type="button" onClick={() => browse("promotions")}>Shop promotions</button></Dropdown>
            {dealsActive && <Dropdown label="Deals" active={browseMode === "deals"}><button type="button" onClick={() => browse("deals")}>Shop PAM Deals</button></Dropdown>}
            <Dropdown label={<><span className="nav-full">Payment &amp; Delivery</span><span className="nav-short">Delivery</span></>}><a href="/info/delivery">Payment and delivery information</a><a href="/info/contact#location">Pickup location</a></Dropdown>
            <div className="mobile-extra-nav"><Dropdown label="Contact"><a href="/info/contact#location">Store location</a><a href={`https://wa.me/${PRIMARY_WHATSAPP}`} target="_blank" rel="noreferrer"><WhatsAppIcon size={16} /> WhatsApp us</a><a href="/info/contact#contact">Contact details</a></Dropdown></div><div className="mobile-extra-nav"><Dropdown label="Account"><a href="/account#orders">Track order</a><a href="/account#wishlist">Wishlist</a><a href="/compare">Compare products</a><a href="/account?mode=signin">Sign in</a><a href="/account?mode=register">Create account</a></Dropdown></div>
          </nav>
          <div className={`header-search${searchOpen && !query.trim() ? " search-active" : ""}`} ref={searchRef}>
            <div className="search-field"><input type="search" aria-label="Search products, categories, or brands" aria-expanded={searchOpen && query.trim().length > 0} aria-controls="search-suggestions" placeholder="Search products, categories, or brands" value={query} onFocus={() => setSearchOpen(true)} onKeyDown={(event) => { if (event.key === "Escape") setSearchOpen(false); if (event.key === "Enter") { event.preventDefault(); submitSearch(); } }} onChange={(event) => { setBrowseMode("products"); setQuery(event.target.value); setSearchOpen(true); }} /><button type="button" aria-label="Show matching products" onClick={submitSearch}>⌕</button></div>
            {searchOpen && query.trim() && <div id="search-suggestions" className="search-suggestions" role="listbox" aria-label="Matching products">{suggestions.length ? <><p>Suggested products</p>{suggestions.map((item) => <button type="button" role="option" aria-selected="false" key={item.id} onClick={() => { recordClick(item); setQuickProduct(item); setSearchOpen(false); }}><span><b>{item.name}</b><small>{item.category} · {item.id}</small></span><strong>{money.format(item.price)}</strong></button>)}</> : <p>No matching products. Try another name or keyword.</p>}</div>}
            <div className="popular-searches"><span><span className="popular-full">Popular Searches:</span><span className="popular-short">Popular:</span></span>{[...curatedSearches, ...popularProducts.map((product) => product.name)].map((term) => <button key={term} type="button" onClick={() => searchPopular(term)}>{term}</button>)}</div>
          </div>
          <p className="header-product-count">{visible.length} products available</p>
          <button className="cart-button" onClick={() => setCartOpen(true)} aria-label={`View cart, ${cartCount} items`}><span className="cart-text">Cart</span><svg className="cart-icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 4h2l2.1 10.4a2 2 0 0 0 2 1.6H19a2 2 0 0 0 2-1.6L22 8H6"/><circle cx="10" cy="20" r="1"/><circle cx="19" cy="20" r="1"/></svg><b>{cartCount}</b></button>
        </div>
      </header>

      <section className={`hero${webHeroUrl ? " has-web-image" : ""}${mobileHeroUrl ? " has-mobile-image" : ""}`}><div className={`hero-flyer hero-flyer-web${webHeroUrl ? " uploaded" : ""}`} aria-hidden="true" style={heroBackground(webHeroUrl)} /><div className={`hero-flyer hero-flyer-mobile${mobileHeroUrl ? " uploaded" : ""}`} aria-hidden="true" style={heroBackground(mobileHeroUrl)} /><div className="hero-content"><p className="eyebrow">Everyday Essentials, thoughtfully selected.</p><h1>Find what you need.<br />Pick up or get it delivered.</h1><p>School, home, gifts and daily essentials in one simple shop.</p><div className="hero-actions"><a className="button primary" href="#catalogue">Shop products</a><a className="button whatsapp" href={`https://wa.me/${PRIMARY_WHATSAPP}`} target="_blank" rel="noreferrer"><WhatsAppIcon size={18} /> WhatsApp us</a></div></div><div className="hero-panel" aria-hidden="true"><span>P</span><span>A</span><span>M</span></div></section>
      {dealsActive && (dealProducts.length > 0 || dealBundles.length > 0) && <section className="deals-feature"><div><p className="eyebrow">Selected for you</p><h2>PAM Deals</h2><p>{dealPercent > 0 ? `Up to ${dealPercent}% off selected products` : "Selected everyday offers"}</p></div><a className="button accent" href="/?browse=deals#catalogue">Shop deals</a></section>}

      <section className="catalogue" id="catalogue">
        <button type="button" className="mobile-filter-toggle" aria-expanded={mobileFiltersOpen} aria-controls="store-filters" onClick={() => setMobileFiltersOpen((open) => !open)}><span aria-hidden="true">☰</span><span className="filter-label-wide">Categories &amp; filters</span><span className="filter-label-mobile">Filters</span></button>
        <aside id="store-filters" className={mobileFiltersOpen ? "filters mobile-open" : "filters"} aria-label="Product filters">
          <button type="button" className="mobile-filter-close" onClick={() => setMobileFiltersOpen(false)}>× Close filters</button>
          <div className="filter-scroll">
          <div className="price-filter"><b>Price range</b><label>Minimum<input type="number" min="0" placeholder="Min price" value={priceMin} onChange={(event) => setPriceMin(event.target.value)} /></label><label>Maximum<input type="number" min="0" placeholder="Max price" value={priceMax} onChange={(event) => setPriceMax(event.target.value)} /></label></div>
          <p className="eyebrow">Browse</p><h2>Categories</h2>
          <button type="button" className={category === "All categories" ? "filter active" : "filter"} onClick={() => selectCategory("All categories")}>
            <span>All categories</span><small>{products.length}</small>
          </button>
          {categoryList.map((item) => {
            const id = item.categoryId || item.id;
            const children = subcategoryList.filter((child) => child.categoryId === id);
            const expanded = expandedCategories.includes(id);
            return <div className="category-tree" key={id}>
              <button type="button" className={category === item.name ? "filter category-toggle active" : "filter category-toggle"} aria-expanded={expanded} onClick={() => selectCategory(item.name, id)}>
                <span><span aria-hidden="true">{expanded ? "▾" : "▸"}</span> {item.name}</span>
                <small>{products.filter((product) => product.categoryId === id).length}</small>
              </button>
              {expanded && children.length > 0 && <div className="subcategory-tree">
                {children.map((child) => {
                  const childId = child.subcategoryId || child.id;
                  const leaves = subSubcategoryList.filter((leaf) => leaf.subcategoryId === childId);
                  const childExpanded = expandedSubcategories.includes(childId);
                  return <div className="subcategory-node" key={childId}>
                    <div className="subcategory-row">
                      <label><input type="checkbox" checked={selectedSubcategories.includes(childId)} onChange={() => toggleSubcategory(child)} /> <span>{child.name}</span></label>
                      {leaves.length > 0 && <button type="button" className="tree-expander" aria-label={`${childExpanded ? "Collapse" : "Expand"} ${child.name}`} aria-expanded={childExpanded} onClick={() => setExpandedSubcategories((current) => current.includes(childId) ? current.filter((entry) => entry !== childId) : [...current, childId])}>{childExpanded ? "▾" : "▸"}</button>}
                    </div>
                    {childExpanded && leaves.length > 0 && <div className="sub-subcategory-tree">
                      {leaves.map((leaf) => <label key={leaf.subSubcategoryId || leaf.id}><input type="checkbox" checked={selectedSubSubcategories.includes(leaf.subSubcategoryId || leaf.id)} onChange={() => toggleSubSubcategory(leaf)} /> <span>{leaf.name}</span></label>)}
                    </div>}
                  </div>;
                })}
              </div>}
            </div>;
          })}
          {!categoryList.length && categories.slice(1).map((name) => <button type="button" className={category === name ? "filter active" : "filter"} key={name} onClick={() => selectCategory(name)}>{name}</button>)}
          <fieldset className="facet-group"><legend>Availability</legend>{[["all", "All"], ["in", "In Stock"], ["out", "Out of Stock"]].map(([value, label]) => <label key={value}><input type="radio" name="availability" checked={availability === value} onChange={() => setAvailability(value)} /> {label}</label>)}</fieldset>
          <fieldset className="facet-group"><legend>Offers</legend>{[["all", "All"], ["sale", "On Sale"], ["promotions", "Promotions"]].map(([value, label]) => <label key={value}><input type="radio" name="offer" checked={offer === value} onChange={() => setOffer(value)} /> {label}</label>)}</fieldset>
          <fieldset className="facet-group"><legend>Collections</legend><label><input type="radio" name="collection" checked={!collection} onChange={() => setCollection("")} /> All</label>{["New Arrivals", "Best Sellers", "Back to School", "Promotion", ...(dealsActive ? ["PAM Deals"] : [])].map((name) => <label key={name}><input type="radio" name="collection" checked={collection === name} onChange={() => setCollection(name)} /> {name}</label>)}</fieldset>
          <button type="button" className="table-action" onClick={clearFilters}>Clear filters</button>
          <a className="filter-compare-link" href="/compare">Compare Products ({compareIds.length})</a>
          <div className="service-note"><p>Need expert advice? Message or call us before you order and we’ll help you choose.</p></div>
          </div>
          <button type="button" className="filter-results-action" onClick={() => { setMobileFiltersOpen(false); setPage(1); requestAnimationFrame(() => document.getElementById("catalogue-results")?.scrollIntoView({ behavior: "smooth", block: "start" })); }}>Show {visible.length} {visible.length === 1 ? "result" : "results"}</button>
        </aside>

        <main className="catalogue-main" id="catalogue-results">
          <div className="catalogue-heading"><div><p className="breadcrumb">{breadcrumb}</p><h2>{heading}</h2><p className="desktop-product-count">{selectedNodes.length > 1 ? `Showing ${visible.length} products from ${selectedNodes.length} selected subcategories` : `${visible.length} products ready to browse`}</p><p className="mobile-product-count">{visible.length} products available</p></div><div className="catalogue-controls"><button type="button" className="mobile-filter-inline" aria-expanded={mobileFiltersOpen} aria-controls="store-filters" onClick={() => setMobileFiltersOpen((open) => !open)}><span aria-hidden="true">☰</span> Filters</button><label className="sort-control" htmlFor="store-sort">Sort by: <select id="store-sort" aria-label="Sort products" value={sort} onChange={(e) => setSort(e.target.value)}><option value="categories">Product categories</option><option value="popularity">Popularity</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="rating">Rating</option><option value="latest">Latest</option><option value="promotions">Promotions</option></select></label><label className="page-size-control">Show: <select aria-label="Products per page" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>{[30, 60, 80, 100].map((size) => <option key={size} value={size}>{size}</option>)}</select></label><div className="grid-density" role="group" aria-label="Grid density"><button type="button" aria-label="Standard grid" aria-pressed={gridDensity === "standard"} onClick={() => setGridDensity("standard")}>▦</button><button type="button" aria-label="Compact grid" aria-pressed={gridDensity === "compact"} onClick={() => setGridDensity("compact")}>▦▦</button></div></div></div>
          {selectedNodes.length > 0 && <div className="filter-chips" aria-label="Selected subcategories"><span>{selectedNodes.length} {selectedNodes.length === 1 ? "subcategory" : "subcategories"} selected</span>{selectedNodes.map((item) => <button type="button" key={item.subSubcategoryId || item.subcategoryId} onClick={() => item.subSubcategoryId ? toggleSubSubcategory(item) : toggleSubcategory(item)} aria-label={`Remove ${item.name} filter`}>{item.name} ×</button>)}<button type="button" onClick={() => { setSelectedSubcategories([]); setSelectedSubSubcategories([]); }}>Clear</button></div>}
          {loading && <div className="empty-state"><div className="spinner" /><p>Loading the catalogue…</p></div>}
          {error && !products.length && <div className="empty-state error-panel"><h3>Catalogue unavailable</h3><p>{error}</p></div>}
          {!loading && !error && !visible.length && !(dealsActive && browseMode === "deals" && dealBundles.length) && <div className="empty-state"><h3>No matching products</h3><p>Try another search, category or collection.</p></div>}
          {dealsActive && browseMode === "deals" && dealBundles.length > 0 && <section className="deal-bundle-grid" aria-label="PAM Deals bundles">{dealBundles.map((deal) => <article className="deal-bundle-card" key={deal.dealId}><div className="deal-bundle-art"><span aria-hidden="true">PAM</span><span className="promo-ribbon">PAM Deal</span></div><div className="deal-bundle-body"><span className={deal.available ? "badge success" : "badge danger"}>{deal.available ? "✓ In stock" : "Out of stock"}</span><h3>{deal.name}</h3><p>{deal.productIds.length} products together</p><p className="deal-bundle-price"><del>{money.format(deal.aggregatePrice)}</del> <strong>{money.format(deal.finalPrice)}</strong></p><details className="deal-bundle-details"><summary>View deal details</summary><ul>{deal.productIds.map((id) => <li key={id}>{products.find((product) => product.id === id)?.name || id}</li>)}</ul>{deal.aggregatePrice > deal.finalPrice && <p>You save {money.format(deal.aggregatePrice - deal.finalPrice)}</p>}</details><button type="button" className="button add-cart-action" disabled={!deal.available} onClick={() => addBundle(deal)}>{deal.available ? "Add deal to cart" : "Out of stock"}</button></div></article>)}</section>}
          <div className={`product-grid${gridDensity === "compact" ? " compact" : ""}`}>{pagedProducts.map((product) => {
            const variants = product.productGroupId ? products.filter((item) => item.productGroupId === product.productGroupId) : [product];
            const hasVariants = variants.length > 1;
            return <article className="product-card" key={product.id}>
              <a href={`/products/${encodeURIComponent(product.id)}`} onClick={rememberListingContext} className="product-card-image"><ProductImage product={product} />{isPromotion(product, discountRules) && <span className="promo-ribbon">Promo</span>}</a>
              <div className="product-card-tools"><button type="button" data-tooltip="Compare" aria-label={`${compareIds.includes(product.id) ? "Remove" : "Add"} ${product.name} ${compareIds.includes(product.id) ? "from" : "to"} comparison`} aria-pressed={compareIds.includes(product.id)} onClick={() => compareProduct(product)}>⇄</button><button type="button" data-tooltip="Wishlist" aria-label={`Add ${product.name} to wishlist`} aria-pressed={wishlistIds.includes(product.id)} onClick={() => wishlistProduct(product)}>{wishlistIds.includes(product.id) ? "♥" : "♡"}</button></div>
              <div className="product-copy"><div className="product-stock-line"><span className={product.stock > 0 ? "badge success" : "badge danger"}>{product.stock > 0 ? "✓ In stock" : "Out of stock"}</span>{product.stock > 0 && product.stock < Number(product.lowStockLevel ?? 8) && <span className="badge warning">Low stock</span>}</div><div className="product-badges">{isNewArrival(product) && <span className="badge neutral">New</span>}{publicLaunch && isBestSeller(product) && <span className="badge neutral">Best seller</span>}{dealsActive && hasCollection(product, "PAM Deals") && <span className="badge neutral">PAM Deal</span>}</div>
              <h3><a href={`/products/${encodeURIComponent(product.id)}`} onClick={rememberListingContext}>{product.name}</a></h3>{product.description && <p className="product-description">{product.description}</p>}{product.randomColours && <p className="colour-note">Random colours unless you indicate a choice in notes.</p>}
              <p className="price">{hasVariants ? variantPrice(variants) : promotionPrice(product, discountRules) != null ? <><del>{money.format(product.price)}</del> <strong>{money.format(promotionPrice(product, discountRules))}</strong></> : money.format(product.price)}</p>{hasVariants && <small>{variants.length} variants available</small>}
              <div className="product-card-actions"><button type="button" className="button quick-view-action full" aria-label="Quick view" onClick={() => { recordClick(product); setQuickProduct(product); }}>{hasVariants ? "View options" : "Quick View"}</button>
              {product.stock > 0 && <button type="button" className="button add-cart-action full" aria-label="Add to cart" onClick={() => add(product)}><span className="add-cart-label">Add to cart</span><svg className="add-cart-icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 3h2l2 11h10l2-7H5"/><circle cx="8" cy="20" r="1"/><circle cx="16" cy="20" r="1"/><path d="M18 4h5M20.5 1.5v5"/></svg></button>}</div>
            </div></article>;
          })}</div>
          {visible.length > pageSize && <div className="pagination"><button disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {page} of {pageCount}</span><button disabled={page === pageCount} onClick={() => setPage((current) => current + 1)}>Next</button></div>}
        </main>
      </section>

      <section className="why-shop" id="services" aria-labelledby="why-shop-title"><div><p className="eyebrow">Why shop with PAM?</p><h2 id="why-shop-title">Everyday shopping made easier</h2></div><ul><li>✓ Affordable everyday essentials</li><li>✓ Convenient ordering</li><li>✓ Pickup or delivery</li><li>✓ WhatsApp ordering</li></ul></section>
      <footer className="store-footer" id="delivery">
        <div className="footer-grid" id="store-footer">
          <div className="footer-brand"><BrandLogo background="navy" /><p>School, home, gifts and daily essentials in one simple shop.</p><p className="footer-payment">Secured payment: Online payment is coming soon. Pay on pickup or delivery is available.</p></div>
          <nav aria-label="Shop links"><h2>Shop</h2><a href="/?from=footer#catalogue">All Products</a><a href="/?from=footer#catalogue">Categories</a>{dealsActive && <a href="/?browse=deals&from=footer#catalogue">Deals</a>}<a href="/?browse=new&from=footer#catalogue">New Arrivals</a></nav>
          <nav aria-label="Customer service links"><h2>Customer Service</h2><a href="/info/contact?from=footer">Contact Us</a><a href={`https://wa.me/${PRIMARY_WHATSAPP}`} target="_blank" rel="noreferrer">WhatsApp</a><a href="/account?from=footer#orders">Track My Order</a><a href="/info/delivery?from=footer">Delivery Information</a><a href="/info/returns?from=footer">Returns &amp; Exchanges</a><a href="/info/privacy?from=footer">Privacy Policy</a><a href="/info/faqs?from=footer">FAQs</a></nav>
          <div className="footer-contact"><h2>Contact</h2><p>{storeLocation}</p>{mapsUrl && <a href={mapsUrl} target="_blank" rel="noreferrer">View on Google Maps</a>}<a href="tel:+233596661439">{PRIMARY_PHONE_LABEL}</a><a href="tel:+233207015198">{SECONDARY_PHONE_LABEL}</a></div>
          <nav aria-label="About PAM links"><h2>About PAM</h2><a href="/info/about?from=footer">About Us</a><a href="/info/story?from=footer">Our Story</a></nav>
          <nav aria-label="Social links"><h2>Follow Us</h2><a href="https://www.facebook.com/share/1HM5dDyhHT/" target="_blank" rel="noreferrer">Facebook</a><a href="/info/social?platform=Instagram&from=footer">Instagram</a><a href="/info/social?platform=TikTok&from=footer">TikTok</a></nav>
        </div>
        <p className="footer-bottom">© 2026 PAM Essentials &amp; More</p>
      </footer>

      {quickProduct && <div className="modal-backdrop" role="presentation" onMouseDown={() => setQuickProduct(null)}><div className="modal quick-view-modal" role="dialog" aria-modal="true" aria-label={`Quick View ${quickProduct.name}`} onMouseDown={(event) => event.stopPropagation()}><ProductOptions key={quickProduct.id} initialProduct={quickProduct} products={products} discountRules={discountRules} compact onClose={() => setQuickProduct(null)} onAdd={add} onNavigateDetail={rememberListingContext} /></div></div>}
      {saveNotice && <div className="save-toast" role="status"><span>{saveNotice}</span><button type="button" onClick={() => setSaveNotice("")} aria-label="Dismiss notification">×</button></div>}
      {announcementOpen && <div className="modal-backdrop announcement-backdrop" role="presentation"><div className="modal announcement-modal" role="dialog" aria-modal="true" aria-label="Store announcements"><div className="drawer-title"><div><p className="eyebrow">PAM Essentials &amp; More</p><h2>Announcements</h2></div><button type="button" className="icon-button" onClick={dismissAnnouncement} aria-label="Close announcements">×</button></div><div className="announcement-list">{announcements.map((item) => <article key={item.announcementId} className={item.style === "crawler" ? "announcement-crawler" : "announcement-static"}><h3>{item.title}</h3><div className="announcement-message"><p>{item.body}</p></div>{item.actionLabel && item.actionUrl && <a className="button secondary" href={item.actionUrl} onClick={dismissAnnouncement}>{item.actionLabel}</a>}</article>)}</div><label className="announcement-optout"><input type="checkbox" checked={announcementOptOut} onChange={(event) => { announcementOptOutRef.current = event.target.checked; setAnnouncementOptOut(event.target.checked); }} /> Do not show announcements again</label><button type="button" className="button primary full" onClick={dismissAnnouncement}>Continue to shop</button></div></div>}
      {servicesOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => setServicesOpen(false)}><div className="modal services-modal" role="dialog" aria-modal="true" aria-label="PAM services" onMouseDown={(event) => event.stopPropagation()}><button className="icon-button services-close" type="button" aria-label="Close services" onClick={() => setServicesOpen(false)}>×</button><p className="eyebrow">PAM Essentials &amp; More</p><h2>Services</h2><ul><li><a href="/services/secretarial">Secretarial services</a></li><li><a href="/services/printing">Printing</a></li><li><a href="/services/communication">Communication consultancy</a></li><li><a href="/services/laptop-repairs">Laptop repairs and purchases</a></li></ul><p>{storeLocation}</p><div className="services-contact"><a className="button primary" href="tel:+233596661439">Call {PRIMARY_PHONE_LABEL}</a><a className="button whatsapp" href={`https://wa.me/${PRIMARY_WHATSAPP}`} target="_blank" rel="noreferrer"><WhatsAppIcon size={18} /> Message us</a></div></div></div>}
      {addedProduct && <div className="modal-backdrop" role="presentation"><div className="modal" role="dialog" aria-modal="true" aria-label="Added to cart"><h2>Added to cart</h2><p>{addedCartLine?.quantity || addedProduct.quantity} × {addedProduct.name}</p><p>SKU: {addedProduct.sku || addedProduct.id}{variantDetail(addedProduct) && ` · ${variantDetail(addedProduct)}`}</p>{addedCartLine && <><div className="stepper added-quantity"><button type="button" onClick={() => updateQuantity(addedCartLine.id, Math.max(1, addedCartLine.quantity - 1))} aria-label="Decrease quantity">−</button><input type="number" min="1" max={addedCartLine.stock} aria-label={`Quantity of ${addedCartLine.name}`} value={addedCartLine.quantity} onChange={(event) => updateQuantity(addedCartLine.id, Math.max(1, Number(event.target.value) || 1))} /><button type="button" onClick={() => updateQuantity(addedCartLine.id, addedCartLine.quantity + 1)} disabled={addedCartLine.quantity >= addedCartLine.stock} aria-label="Increase quantity">+</button></div>{quantityOfferMessage(addedCartLine, addedCartLine.quantity, discountRules) && <p className="quantity-offer-note">{quantityOfferMessage(addedCartLine, addedCartLine.quantity, discountRules)}</p>}</>}<div className="added-actions"><button className="button secondary" onClick={() => setAddedProduct(null)}>Continue shopping</button><button className="button primary" onClick={() => { setAddedProduct(null); setCartOpen(true); }}>View cart</button></div></div></div>}

      {cartOpen && <div className="drawer-backdrop" onMouseDown={closeCart}><aside className="cart-drawer" onMouseDown={(event) => event.stopPropagation()}>
        <div className="drawer-title"><div><p className="eyebrow">Your order</p><h2>Shopping cart</h2></div><button className="icon-button" onClick={closeCart} aria-label="Close cart">×</button></div>
        {error && <p className="notice error-notice">{error}</p>}
        {!cart.length ? <div className="empty-state"><h3>Your cart is empty</h3><p>Add a product to get started.</p><button type="button" className="button secondary full" onClick={closeCart}>Continue browsing</button></div> : <>
          {discountRules.some((rule) => rule.scopeType === "GLOBAL" && rule.discountType === "PERCENT" && Number(rule.value) === 5 && Number(rule.minQty) === 3) && <div className="cart-rule-summary" role="status"><strong>Buy 3 or more of the same product to get 5% off that product.</strong>{pricing.lines.some((line) => line.rule?.discountType === "PERCENT" && Number(line.rule.value) === 5 && line.ruleDiscountCents > 0) && <p>5% quantity discount applied to eligible products</p>}</div>}
          <div className="cart-lines">{cart.map((item) => { const line = pricing.lines.find((entry) => entry.id === item.id); return <div className="cart-line" key={item.id}><ProductArt name={item.name} category={item.category} /><div><h3>{item.name}</h3><p>{[variantDetail(item), `SKU: ${item.sku || item.id}`].filter(Boolean).join(" · ")}</p>{item.randomColours && <p className="colour-note">Random colours unless you indicate a choice in notes.</p>}<p>{money.format(item.price)}</p><div className="stepper"><button aria-label={`Decrease ${item.name} quantity`} onClick={() => updateQuantity(item.id, item.quantity - 1)}>−</button><input type="number" min="1" max={item.stock} aria-label={`Quantity of ${item.name}`} value={item.quantity} onChange={(event) => updateQuantity(item.id, Math.max(1, Number(event.target.value) || 1))} /><button aria-label={`Increase ${item.name} quantity`} onClick={() => updateQuantity(item.id, item.quantity + 1)} disabled={item.quantity >= item.stock}>+</button></div><button type="button" className="cart-remove-line" onClick={() => updateQuantity(item.id, 0)} aria-label={`Remove ${item.name} from cart`}>Remove item</button></div><div className="cart-line-total">{line?.rule && line.ruleDiscountCents > 0 && <span className="cart-line-discount">−{line.rule.discountType === "PERCENT" ? `${line.rule.value}%` : money.format(line.ruleDiscountCents / 100)}</span>}<b>{money.format(line?.lineTotal || 0)}</b></div></div>; })}</div>
          <div className="cart-total"><span>Subtotal</span><strong>{money.format(subtotal)}</strong></div>{discount > 0 && <div className="cart-total discount-total"><span>Discount</span><strong>−{money.format(discount)}</strong></div>}<div className="cart-total grand-total"><span>Total</span><strong>{money.format(total)}</strong></div>
          <button type="button" className="button primary full" onClick={closeCart}>Continue browsing</button>
          {!checkout ? <button className="button accent full" onClick={() => setCheckout(true)}>Proceed to checkout</button> : <form className="checkout-form" onSubmit={placeOrder}><label>Full name<input required value={order.customer} onChange={(e) => setOrder({ ...order, customer: e.target.value })} /></label><label>Mobile number<input required type="tel" value={order.phone} onChange={(e) => setOrder({ ...order, phone: e.target.value })} /></label><label>Fulfilment<select value={order.deliveryMethod} onChange={(e) => setOrder({ ...order, deliveryMethod: e.target.value })}><option value="pickup">Pickup</option><option value="delivery-self">Delivery – self initiated</option><option value="delivery-shop">Delivery – arranged by shop</option></select></label>{order.deliveryMethod === "delivery-self" && <p className="pickup-address">Your courier collects from: <b>{storeLocation}</b></p>}{order.deliveryMethod !== "pickup" && <label>Delivery destination or landmark<input required={order.deliveryMethod === "delivery-shop"} value={order.deliveryAddress} onChange={(e) => setOrder({ ...order, deliveryAddress: e.target.value })} /></label>}<label>Order notes (optional)<textarea rows={3} maxLength={1000} placeholder="type specific details or requests here" value={order.notes} onChange={(e) => setOrder({ ...order, notes: e.target.value })} /></label><button className="button secondary full" type="button" disabled title="Payment provider has not been selected yet">Pay now · coming soon</button><button className="button accent full" type="submit" disabled={placingOrder}>{placingOrder ? "Creating order…" : `Pay on pickup/delivery · ${money.format(total)}`}</button><button className="button whatsapp full" type="button" disabled={placingOrder} onClick={orderOnWhatsApp}>Order on WhatsApp</button></form>}
        </>}
      </aside></div>}
      {confirmation && <div className="modal-backdrop"><div className="modal"><span className="success-mark">✓</span><h2>Order received</h2><p>Keep this reference for pickup or delivery.</p><strong className="order-reference">{confirmation.orderId}</strong><p>{user && !role ? "Track this order in your account." : "Create a customer account and link this guest order to track it."}</p><a className="button secondary full" href="/account#orders">Track my order</a><button className="button primary full" onClick={() => { setConfirmation(null); setCartOpen(false); }}>Continue shopping</button></div></div>}
      {exitConfirm && <div className="modal-backdrop"><div className="modal" role="dialog" aria-modal="true" aria-label="Exit store confirmation"><h2>Do you want to exit the store?</h2><p>You can continue shopping or return to the previous page.</p><div className="added-actions"><button type="button" className="button secondary" onClick={() => setExitConfirm(false)}>No, continue shopping</button><button type="button" className="button primary" onClick={() => { leavingStore.current = true; setExitConfirm(false); window.history.go(-3); }}>Yes, exit</button></div></div></div>}
      <a className="whatsapp-fab" href={`https://wa.me/${PRIMARY_WHATSAPP}`} target="_blank" rel="noreferrer" aria-label="Chat with PAM Essentials on WhatsApp"><WhatsAppIcon size={25} /></a>
      {cookieVisible && <div className="cookie-banner"><p><b>Privacy notice</b> We use essential browser storage for your cart, staff sign-in and offline till sync.</p><button className="button accent" onClick={() => { localStorage.setItem("pam-cookie-notice", "accepted"); setCookieVisible(false); }}>Okay</button></div>}
    </div>
  );
}

