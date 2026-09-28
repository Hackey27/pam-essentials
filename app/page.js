"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { priceCart, resolveDiscount } from "@/lib/commerce";
import { curatedSearches, hasCollection, inCollection, isBestSeller, isNewArrival, isOnSale, isPromotion, matchesSearch } from "@/lib/catalogueBrowse.mjs";
import ProductOptions, { variantPrice } from "@/components/ProductOptions";
import { addToCart, readCart, saveCart } from "@/lib/storeCart";
import { useAuth } from "@/components/AuthProvider";
import { SHOP_ADDRESS } from "@/lib/shop";
import { whatsappOrderMessage } from "@/lib/whatsappOrder.mjs";
import WhatsAppIcon from "@/components/WhatsAppIcon";

const money = new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" });

function ProductArt({ name, category }) {
  const initials = name.split(" ").slice(0, 2).map((word) => word[0]).join("");
  return <div className="product-art" aria-label={`${name} image placeholder`}><span>{initials}</span><small>{category}</small></div>;
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
  const [discountRules, setDiscountRules] = useState([]);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [category, setCategory] = useState("All categories");
  const [sort, setSort] = useState("featured");
  const [browseMode, setBrowseMode] = useState("products");
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(Infinity);
  const [cart, setCart] = useState([]);
  const [quickProduct, setQuickProduct] = useState(null);
  const [addedProduct, setAddedProduct] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checkout, setCheckout] = useState(false);
  const [order, setOrder] = useState({ customer: "", phone: "", deliveryMethod: "pickup", deliveryAddress: "", notes: "" });
  const [confirmation, setConfirmation] = useState(null);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [cookieVisible, setCookieVisible] = useState(false);
  const clickSession = useRef({ id: "", seen: new Set() });
  const orderRequest = useRef(false);
  const searchRef = useRef(null);

  useEffect(() => {
    fetch("/api/catalog/products")
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); setProducts(data.products || []); setCategoryList(data.categories || []); setSubcategoryList(data.subcategories || []); setSubSubcategoryList(data.subSubcategories || []); setDiscountRules(data.discountRules || []); setDealBundles(data.dealBundles || []); setPopularProducts(data.popularProducts || []); setPublicLaunch(data.publicLaunch === true); setDealsActive(data.dealsActive === true); setFlyerUrl(data.flyerUrl || ""); const params = new URLSearchParams(window.location.search); const mode = params.get("browse"); if (["new", "promotions"].includes(mode) || mode === "deals" && data.dealsActive === true) { setBrowseMode(mode); setSort(mode === "new" ? "latest" : mode === "deals" ? "price-low" : "featured"); } const quickId = params.get("quick"); if (quickId) setQuickProduct((data.products || []).find((item) => item.id === quickId) || null); const highest = Math.ceil(Math.max(0, ...(data.products || []).map((product) => Number(product.price || 0)))); setPriceMax(highest || Infinity); const current = readCart(); const refreshed = current.map((line) => { const product = (data.products || []).find((item) => item.id === line.id); return product && product.stock > 0 ? { ...product, quantity: Math.min(Number(line.quantity), Number(product.stock)) } : null; }).filter(Boolean); saveCart(refreshed); setCart(refreshed); })
      .catch((err) => setError(err.message || "The catalogue is unavailable."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { setCookieVisible(localStorage.getItem("pam-cookie-notice") !== "accepted"); }, []);
  useEffect(() => { setCart(readCart()); if (new URLSearchParams(window.location.search).has("cart")) setCartOpen(true); }, []);
  useEffect(() => { const close = (event) => { if (!searchRef.current?.contains(event.target)) setSearchOpen(false); }; document.addEventListener("pointerdown", close); return () => document.removeEventListener("pointerdown", close); }, []);

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
      product.price >= priceMin && product.price <= priceMax &&
      (availability === "all" || (availability === "in" ? product.stock > 0 : product.stock <= 0)) &&
      (offer === "all" || (offer === "sale" ? isOnSale(product, discountRules) : isPromotion(product, discountRules))) &&
      inCollection(product, collection, discountRules) &&
      (browseMode === "products" || (browseMode === "new" ? isNewArrival(product) : browseMode === "promotions" ? isPromotion(product, discountRules) : dealsActive && hasCollection(product, "PAM Deals")))
    );
    if (browseMode === "new" || sort === "latest") {
      return [...filtered].sort((a, b) => (Date.parse(b.createdAt || "") || 0) - (Date.parse(a.createdAt || "") || 0) || a.name.localeCompare(b.name));
    }
    if (sort === "price-low") return [...filtered].sort((a, b) => a.price - b.price);
    if (sort === "price-high") return [...filtered].sort((a, b) => b.price - a.price);
    return filtered;
  }, [products, discountRules, query, category, selectedSubcategories, selectedSubSubcategories, sort, browseMode, priceMin, priceMax, availability, offer, collection, publicLaunch, dealsActive]);
  const dealProducts = products.filter((product) => hasCollection(product, "PAM Deals"));
  const dealPercent = Math.max(0, ...discountRules.filter((rule) => rule.discountType === "PERCENT" && Number(rule.value) <= 20 && rule.scopeType !== "GLOBAL" && dealProducts.some((product) => rule.scopeType === "PRODUCT" ? rule.scopeId === product.id : rule.scopeType === "CATEGORY" && rule.scopeId === product.categoryId)).map((rule) => Number(rule.value || 0)));
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const pagedProducts = visible.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => { setPage(1); }, [query, category, selectedSubcategories, selectedSubSubcategories, availability, offer, collection, sort, browseMode, priceMin, priceMax, pageSize]);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const pricing = priceCart(cart, discountRules, dealBundles);
  const { subtotal, discount, total } = pricing;
  const quantityRule = discountRules.find((rule) => rule.scopeType === "GLOBAL" && rule.discountType === "PERCENT" && Number(rule.value) === 5 && Number(rule.minQty) === 3);
  const quantityDiscountApplied = quantityRule && cart.some((item) => resolveDiscount(item, item.quantity, discountRules, new Date(), cartCount).rule?.ruleId === quantityRule.ruleId);

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
    setSort(mode === "new" ? "latest" : mode === "deals" ? "price-low" : "featured");
    document.getElementById("catalogue")?.scrollIntoView({ behavior: "smooth" });
  }

  function searchPopular(term) {
    setBrowseMode("products");
    setCategory("All categories");
    setSelectedSubcategories([]);
    setSelectedSubSubcategories([]);
    setQuery(term);
    document.getElementById("catalogue")?.scrollIntoView({ behavior: "smooth" });
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
    const whatsappUrl = `https://wa.me/233207015198?text=${encodeURIComponent(message)}`;
    if (whatsappWindow) whatsappWindow.location.href = whatsappUrl;
    else window.location.href = whatsappUrl;
    setConfirmation(data); setCart([]); saveCart([]); setCheckout(false);
  }

  return (
    <div className="store-shell">
      <div className="utility-bar"><span>PAM Essentials & More · Ghana</span><div><a href="/account#orders">Track Order</a><a href="/account">{user && !role ? "My Account" : "Sign In"}</a></div></div>
      <header className="store-header">
        <div className="header-main">
          <a className="brand" href="/" aria-label="PAM Essentials home"><span className="brand-mark" aria-hidden="true">P</span><span>PAM Essentials</span></a>
          <nav className="store-nav" aria-label="Primary navigation">
            <button type="button" onClick={() => browse("products")}>Products</button>
            <button type="button" onClick={() => setServicesOpen(true)}>Services</button>
            <button type="button" onClick={() => browse("new")}>New Arrivals</button>
            <button type="button" onClick={() => browse("promotions")}>Promotions</button>
            {dealsActive && <button type="button" onClick={() => browse("deals")}>Deals</button>}
            <a href="/info/delivery">Payment &amp; Delivery</a>
          </nav>
          <div className="header-search" ref={searchRef}>
            <div className="search-field"><input type="search" aria-label="Search products, category or key words" aria-expanded={searchOpen && query.trim().length > 0} aria-controls="search-suggestions" placeholder="Search products, category or key words" value={query} onFocus={() => setSearchOpen(true)} onKeyDown={(event) => { if (event.key === "Escape") setSearchOpen(false); if (event.key === "Enter" && suggestions.length === 1) { event.preventDefault(); setQuickProduct(suggestions[0]); setSearchOpen(false); } }} onChange={(event) => { setBrowseMode("products"); setQuery(event.target.value); setSearchOpen(true); }} /><button type="button" aria-label="Show matching products" onClick={() => { setSearchOpen(true); searchRef.current?.querySelector("input")?.focus(); }}>⌕</button></div>
            {searchOpen && query.trim() && <div id="search-suggestions" className="search-suggestions" role="listbox" aria-label="Matching products">{suggestions.length ? <><p>Suggested products</p>{suggestions.map((item) => <button type="button" role="option" aria-selected="false" key={item.id} onClick={() => { recordClick(item); setQuickProduct(item); setSearchOpen(false); }}><span><b>{item.name}</b><small>{item.category} · {item.id}</small></span><strong>{money.format(item.price)}</strong></button>)}</> : <p>No matching products. Try another name or keyword.</p>}</div>}
            <div className="popular-searches"><span>Popular Searches:</span>{[...curatedSearches, ...popularProducts.map((product) => product.name)].map((term) => <button key={term} type="button" onClick={() => searchPopular(term)}>{term}</button>)}</div>
          </div>
          <button className="cart-button" onClick={() => setCartOpen(true)} aria-label={`Cart, ${cartCount} items`}>Cart <b>{cartCount}</b></button>
        </div>
      </header>

      <section className="hero"><div className="hero-flyer" aria-hidden="true" style={flyerUrl ? { backgroundImage: `url(${JSON.stringify(flyerUrl)})` } : undefined} /><div className="hero-content"><p className="eyebrow">Everyday Essentials, thoughtfully selected.</p><h1>Find what you need.<br />Pick up or get it delivered.</h1><p>School, home, gifts and daily essentials in one simple shop.</p><div className="hero-actions"><a className="button primary" href="#catalogue">Shop products</a><a className="button whatsapp" href="https://wa.me/233207015198" target="_blank" rel="noreferrer"><WhatsAppIcon size={18} /> WhatsApp us</a></div></div><div className="hero-panel" aria-hidden="true"><span>P</span><span>A</span><span>M</span></div></section>
      {dealsActive && (dealProducts.length > 0 || dealBundles.length > 0) && <section className="deals-feature"><div><p className="eyebrow">Selected for you</p><h2>PAM Deals</h2><p>{dealPercent > 0 ? `Up to ${dealPercent}% off selected products` : "Selected everyday offers"}</p></div><a className="button accent" href="/?browse=deals#catalogue">Shop deals</a></section>}

      <section className="catalogue" id="catalogue">
        <button type="button" className="mobile-filter-toggle" aria-expanded={mobileFiltersOpen} aria-controls="store-filters" onClick={() => setMobileFiltersOpen((open) => !open)}><span aria-hidden="true">☰</span> Categories &amp; filters</button>
        <aside id="store-filters" className={mobileFiltersOpen ? "filters mobile-open" : "filters"} aria-label="Product filters">
          <button type="button" className="mobile-filter-close" onClick={() => setMobileFiltersOpen(false)}>× Close filters</button>
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
          <div className="price-filter"><b>Price range</b><label>Minimum<input type="number" min="0" value={priceMin} onChange={(event) => setPriceMin(Math.max(0, Number(event.target.value || 0)))} /></label><label>Maximum<input type="number" min="0" value={Number.isFinite(priceMax) ? priceMax : ""} onChange={(event) => setPriceMax(event.target.value === "" ? Infinity : Math.max(0, Number(event.target.value)))} /></label></div>
          <fieldset className="facet-group"><legend>Availability</legend>{[["all", "All"], ["in", "In Stock"], ["out", "Out of Stock"]].map(([value, label]) => <label key={value}><input type="radio" name="availability" checked={availability === value} onChange={() => setAvailability(value)} /> {label}</label>)}</fieldset>
          <fieldset className="facet-group"><legend>Offers</legend>{[["all", "All"], ["sale", "On Sale"], ["promotions", "Promotions"]].map(([value, label]) => <label key={value}><input type="radio" name="offer" checked={offer === value} onChange={() => setOffer(value)} /> {label}</label>)}</fieldset>
          <fieldset className="facet-group"><legend>Collections</legend><label><input type="radio" name="collection" checked={!collection} onChange={() => setCollection("")} /> All</label>{["New Arrivals", "Best Sellers", "Back to School", "Promotion", ...(dealsActive ? ["PAM Deals"] : [])].map((name) => <label key={name}><input type="radio" name="collection" checked={collection === name} onChange={() => setCollection(name)} /> {name}</label>)}</fieldset>
          <div className="service-note"><p>Need expert advice? Message or call us before you order and we’ll help you choose.</p></div>
        </aside>

        <main className="catalogue-main">
          <div className="catalogue-heading"><div><p className="breadcrumb">{breadcrumb}</p><h2>{heading}</h2><p>{selectedNodes.length > 1 ? `Showing ${visible.length} products from ${selectedNodes.length} selected subcategories` : `${visible.length} products ready to browse`}</p></div><div className="catalogue-controls"><select aria-label="Sort products" value={sort} onChange={(e) => setSort(e.target.value)}><option value="featured">Popularity</option><option value="price-low">Price low to high</option><option value="price-high">Price high to low</option><option value="latest">Latest</option></select><select aria-label="Products per page" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>{[20, 30, 40, 50].map((size) => <option key={size} value={size}>{size} per page</option>)}</select></div></div>
          {selectedNodes.length > 0 && <div className="filter-chips" aria-label="Selected subcategories"><span>{selectedNodes.length} {selectedNodes.length === 1 ? "subcategory" : "subcategories"} selected</span>{selectedNodes.map((item) => <button type="button" key={item.subSubcategoryId || item.subcategoryId} onClick={() => item.subSubcategoryId ? toggleSubSubcategory(item) : toggleSubcategory(item)} aria-label={`Remove ${item.name} filter`}>{item.name} ×</button>)}<button type="button" onClick={() => { setSelectedSubcategories([]); setSelectedSubSubcategories([]); }}>Clear</button></div>}
          {loading && <div className="empty-state"><div className="spinner" /><p>Loading the catalogue…</p></div>}
          {error && !products.length && <div className="empty-state error-panel"><h3>Catalogue unavailable</h3><p>{error}</p></div>}
          {!loading && !error && !visible.length && !(dealsActive && browseMode === "deals" && dealBundles.length) && <div className="empty-state"><h3>No matching products</h3><p>Try another search, category or collection.</p></div>}
          {dealsActive && browseMode === "deals" && dealBundles.length > 0 && <section className="deal-bundle-grid" aria-label="PAM Deals bundles">{dealBundles.map((deal) => <article className="panel" key={deal.dealId}><span className="badge warning">PAM Deal</span><h3>{deal.name}</h3><p>{deal.productIds.map((id) => products.find((product) => product.id === id)?.name || id).join(" + ")}</p><p><del>{money.format(deal.aggregatePrice)}</del> <strong>{money.format(deal.finalPrice)}</strong></p><button type="button" className="button add-cart-action" disabled={!deal.available} onClick={() => addBundle(deal)}>{deal.available ? "Add deal to cart" : "Out of stock"}</button></article>)}</section>}
          <div className="product-grid">{pagedProducts.map((product) => {
            const variants = product.productGroupId ? products.filter((item) => item.productGroupId === product.productGroupId) : [product];
            const hasVariants = variants.length > 1;
            return <article className="product-card" key={product.id}>
              <a href={`/products/${encodeURIComponent(product.id)}`} className="product-card-image">{product.imageUrl ? <img className="product-photo" src={product.imageUrl} alt={product.name} /> : <ProductArt name={product.name} category={product.category} />}{isPromotion(product, discountRules) && <span className="promo-ribbon">Promo</span>}</a>
              <div className="product-copy"><div className="product-badges"><span className={product.stock > 0 ? "badge success" : "badge danger"}>{product.stock > 0 ? "In stock" : "Out of stock"}</span>{product.stock > 0 && product.stock < Number(product.lowStockLevel ?? 8) && <span className="badge warning">Low stock</span>}{isNewArrival(product) && <span className="badge neutral">New</span>}{publicLaunch && isBestSeller(product) && <span className="badge neutral">Best seller</span>}{isOnSale(product, discountRules) && <span className="badge warning">On sale</span>}</div>
              <p className="sku">{product.id}</p><h3><a href={`/products/${encodeURIComponent(product.id)}`}>{product.name}</a></h3>{product.description && <p className="product-description">{product.description}</p>}{product.randomColours && <p className="colour-note">Random colours unless you indicate a choice in notes.</p>}
              <p className="price">{hasVariants ? variantPrice(variants) : money.format(product.price)}</p>{hasVariants && <small>{variants.length} variants available</small>}
              <button type="button" className="button quick-view-action full" onClick={() => { recordClick(product); setQuickProduct(product); }}>{hasVariants ? "View options" : "Quick View"}</button>
              {!hasVariants && product.stock > 0 && <button type="button" className="button add-cart-action full" onClick={() => add(product)}>Add to cart</button>}
            </div></article>;
          })}</div>
          {visible.length > pageSize && <div className="pagination"><button disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {page} of {pageCount}</span><button disabled={page === pageCount} onClick={() => setPage((current) => current + 1)}>Next</button></div>}
        </main>
      </section>

      <section className="why-shop" id="services" aria-labelledby="why-shop-title"><div><p className="eyebrow">Why shop with PAM?</p><h2 id="why-shop-title">Everyday shopping made easier</h2></div><ul><li>✓ Affordable everyday essentials</li><li>✓ Convenient ordering</li><li>✓ Pickup or delivery</li><li>✓ WhatsApp ordering</li></ul></section>
      <footer className="store-footer" id="delivery">
        <div className="footer-grid">
          <div className="footer-brand"><b>PAM Essentials &amp; More</b><p>School, home, gifts and daily essentials in one simple shop.</p><p className="footer-payment">Secured payment: Online payment is coming soon. Pay on pickup or delivery is available.</p></div>
          <nav aria-label="Shop links"><h2>Shop</h2><a href="/#catalogue">All Products</a><a href="/#catalogue">Categories</a>{dealsActive && <a href="/?browse=deals#catalogue">Deals</a>}<a href="/?browse=new#catalogue">New Arrivals</a></nav>
          <nav aria-label="Customer service links"><h2>Customer Service</h2><a href="/info/contact">Contact Us</a><a href="https://wa.me/233207015198" target="_blank" rel="noreferrer">WhatsApp</a><a href="/account#orders">Track My Order</a><a href="/info/delivery">Delivery Information</a><a href="/info/returns">Returns &amp; Exchanges</a><a href="/info/privacy">Privacy Policy</a><a href="/info/faqs">FAQs</a></nav>
          <div><h2>Contact</h2><p>Awoshie, Accra, Ghana</p><a href="tel:+233207015198">+233 20 701 5198</a></div>
          <nav aria-label="About PAM links"><h2>About PAM</h2><a href="/info/about">About Us</a><a href="/info/story">Our Story</a></nav>
          <nav aria-label="Social links"><h2>Follow Us</h2><a href="/info/social?platform=Facebook">Facebook</a><a href="/info/social?platform=Instagram">Instagram</a><a href="/info/social?platform=TikTok">TikTok</a></nav>
        </div>
        <p className="footer-bottom">© 2026 PAM Essentials &amp; More</p>
      </footer>

      {quickProduct && <div className="modal-backdrop" role="presentation" onMouseDown={() => setQuickProduct(null)}><div className="modal quick-view-modal" role="dialog" aria-modal="true" aria-label={`Quick View ${quickProduct.name}`} onMouseDown={(event) => event.stopPropagation()}><ProductOptions key={quickProduct.id} initialProduct={quickProduct} products={products} compact onClose={() => setQuickProduct(null)} onAdd={add} /></div></div>}
      {servicesOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => setServicesOpen(false)}><div className="modal services-modal" role="dialog" aria-modal="true" aria-label="PAM services" onMouseDown={(event) => event.stopPropagation()}><button className="icon-button services-close" type="button" aria-label="Close services" onClick={() => setServicesOpen(false)}>×</button><p className="eyebrow">PAM Essentials &amp; More</p><h2>Services</h2><ul><li>Secretarial services</li><li>Printing</li><li>Communication consultancy</li><li>Laptop repairs and purchases</li></ul><p>Awoshie, Accra, Ghana</p><div className="services-contact"><a className="button primary" href="tel:+233207015198">Call +233 20 701 5198</a><a className="button whatsapp" href="https://wa.me/233207015198" target="_blank" rel="noreferrer"><WhatsAppIcon size={18} /> Message us</a></div></div></div>}
      {addedProduct && <div className="modal-backdrop" role="presentation"><div className="modal" role="dialog" aria-modal="true" aria-label="Added to cart"><h2>Added to cart</h2><p>{addedProduct.quantity} × {addedProduct.name}</p><p>SKU: {addedProduct.id}{addedProduct.colour && ` · ${addedProduct.colour}`}{addedProduct.size && ` · ${addedProduct.size}`}</p><div className="added-actions"><button className="button secondary" onClick={() => { setAddedProduct(null); document.getElementById("catalogue")?.scrollIntoView({ behavior: "smooth" }); }}>Continue shopping</button><button className="button primary" onClick={() => { setAddedProduct(null); setCartOpen(true); }}>View cart</button></div></div></div>}

      {cartOpen && <div className="drawer-backdrop" onMouseDown={() => setCartOpen(false)}><aside className="cart-drawer" onMouseDown={(event) => event.stopPropagation()}><div className="drawer-title"><div><p className="eyebrow">Your order</p><h2>Shopping cart</h2></div><button className="icon-button" onClick={() => setCartOpen(false)}>×</button></div>{error && <p className="notice error-notice">{error}</p>}{!cart.length ? <div className="empty-state"><h3>Your cart is empty</h3><p>Add a product to get started.</p></div> : <><div className="cart-lines">{cart.map((item) => <div className="cart-line" key={item.id}><ProductArt name={item.name} category={item.category} /><div><h3>{item.name}</h3><p>{[item.colour, item.size, `SKU: ${item.id}`].filter(Boolean).join(" · ")}</p>{item.randomColours && <p className="colour-note">Random colours unless you indicate a choice in notes.</p>}<p>{money.format(item.price)}</p><div className="stepper"><button onClick={() => updateQuantity(item.id, item.quantity - 1)}>−</button><span>{item.quantity}</span><button onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</button></div></div><b>{money.format(pricing.lines.find((line) => line.id === item.id)?.lineTotal || 0)}</b></div>)}</div>{quantityRule && cartCount > 0 && cartCount < 3 && <p className="discount-nudge" role="status">Add {3 - cartCount} more to qualify for 5% off</p>}{quantityDiscountApplied && <p className="discount-applied" role="status">5% quantity discount applied</p>}<div className="cart-total"><span>Subtotal</span><strong>{money.format(subtotal)}</strong></div>{discount > 0 && <div className="cart-total discount-total"><span>Discount</span><strong>−{money.format(discount)}</strong></div>}<div className="cart-total grand-total"><span>Total</span><strong>{money.format(total)}</strong></div>{!checkout ? <button className="button accent full" onClick={() => setCheckout(true)}>Continue to checkout</button> : <form className="checkout-form" onSubmit={placeOrder}><label>Full name<input required value={order.customer} onChange={(e) => setOrder({ ...order, customer: e.target.value })} /></label><label>Mobile number<input required type="tel" value={order.phone} onChange={(e) => setOrder({ ...order, phone: e.target.value })} /></label><label>Fulfilment<select value={order.deliveryMethod} onChange={(e) => setOrder({ ...order, deliveryMethod: e.target.value })}><option value="pickup">Pickup</option><option value="delivery-self">Delivery – self initiated</option><option value="delivery-shop">Delivery – arranged by shop</option></select></label>{order.deliveryMethod === "delivery-self" && <p className="pickup-address">Your courier collects from: <b>{SHOP_ADDRESS}</b></p>}{order.deliveryMethod !== "pickup" && <label>Delivery destination or landmark<input required={order.deliveryMethod === "delivery-shop"} value={order.deliveryAddress} onChange={(e) => setOrder({ ...order, deliveryAddress: e.target.value })} /></label>}<label>Order notes (optional)<textarea rows={3} maxLength={1000} placeholder="type specific details or requests here" value={order.notes} onChange={(e) => setOrder({ ...order, notes: e.target.value })} /></label><button className="button secondary full" type="button" disabled title="Payment provider has not been selected yet">Pay now · coming soon</button><button className="button accent full" type="submit" disabled={placingOrder}>{placingOrder ? "Creating order…" : `Pay on pickup/delivery · ${money.format(total)}`}</button><button className="button whatsapp full" type="button" disabled={placingOrder} onClick={orderOnWhatsApp}>Order on WhatsApp</button></form>}</>}</aside></div>}
      {confirmation && <div className="modal-backdrop"><div className="modal"><span className="success-mark">✓</span><h2>Order received</h2><p>Keep this reference for pickup or delivery.</p><strong className="order-reference">{confirmation.orderId}</strong><p>{user && !role ? "Track this order in your account." : "Create a customer account and link this guest order to track it."}</p><a className="button secondary full" href="/account#orders">Track my order</a><button className="button primary full" onClick={() => { setConfirmation(null); setCartOpen(false); }}>Continue shopping</button></div></div>}
      <a className="whatsapp-fab" href="https://wa.me/233207015198" target="_blank" rel="noreferrer" aria-label="Chat with PAM Essentials on WhatsApp"><WhatsAppIcon size={25} /></a>
      {cookieVisible && <div className="cookie-banner"><p><b>Privacy notice</b> We use essential browser storage for your cart, staff sign-in and offline till sync.</p><button className="button accent" onClick={() => { localStorage.setItem("pam-cookie-notice", "accepted"); setCookieVisible(false); }}>Okay</button></div>}
    </div>
  );
}

