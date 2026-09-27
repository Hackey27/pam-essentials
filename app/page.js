"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { resolveDiscount } from "@/lib/commerce";
import { curatedSearches, hasCollection, inCollection, isBestSeller, isNewArrival, isOnSale, isPromotion, matchesSearch } from "@/lib/catalogueBrowse.mjs";
import ProductOptions, { variantPrice } from "@/components/ProductOptions";
import { addToCart, readCart, saveCart } from "@/lib/storeCart";

const money = new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" });

function ProductArt({ name, category }) {
  const initials = name.split(" ").slice(0, 2).map((word) => word[0]).join("");
  return <div className="product-art" aria-label={`${name} image placeholder`}><span>{initials}</span><small>{category}</small></div>;
}

export default function Storefront() {
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
  const [discountRules, setDiscountRules] = useState([]);
  const [query, setQuery] = useState("");
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checkout, setCheckout] = useState(false);
  const [order, setOrder] = useState({ customer: "", phone: "", deliveryMethod: "pickup", landmark: "" });
  const [confirmation, setConfirmation] = useState(null);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [trackOpen, setTrackOpen] = useState(false);
  const [track, setTrack] = useState({ reference: "", phone: "" });
  const [trackedOrder, setTrackedOrder] = useState(null);
  const [cookieVisible, setCookieVisible] = useState(false);
  const clickSession = useRef({ id: "", seen: new Set() });

  useEffect(() => {
    fetch("/api/catalog/products")
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); setProducts(data.products || []); setCategoryList(data.categories || []); setSubcategoryList(data.subcategories || []); setSubSubcategoryList(data.subSubcategories || []); setDiscountRules(data.discountRules || []); setPopularProducts(data.popularProducts || []); setPublicLaunch(data.publicLaunch === true); const highest = Math.ceil(Math.max(0, ...(data.products || []).map((product) => Number(product.price || 0)))); setPriceMax(highest || Infinity); const current = readCart(); const refreshed = current.map((line) => { const product = (data.products || []).find((item) => item.id === line.id); return product && product.stock > 0 ? { ...product, quantity: Math.min(Number(line.quantity), Number(product.stock)) } : null; }).filter(Boolean); saveCart(refreshed); setCart(refreshed); })
      .catch((err) => setError(err.message || "The catalogue is unavailable."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { setCookieVisible(localStorage.getItem("pam-cookie-notice") !== "accepted"); }, []);
  useEffect(() => { setCart(readCart()); if (new URLSearchParams(window.location.search).has("cart")) setCartOpen(true); }, []);

  const categories = useMemo(() => {
    const ordered = categoryList.map((item) => item.name);
    return ["All categories", ...(ordered.length ? ordered : [...new Set(products.map((product) => product.category))])];
  }, [products, categoryList]);
  const currentCategory = categoryList.find((item) => item.name === category);
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
      (browseMode === "products" || (browseMode === "new" ? isNewArrival(product) : browseMode === "promotions" ? isPromotion(product, discountRules) : hasCollection(product, "PAM Deals")))
    );
    if (browseMode === "new" || sort === "latest") {
      return [...filtered].sort((a, b) => (Date.parse(b.createdAt || "") || 0) - (Date.parse(a.createdAt || "") || 0) || a.name.localeCompare(b.name));
    }
    if (sort === "price-low") return [...filtered].sort((a, b) => a.price - b.price);
    if (sort === "price-high") return [...filtered].sort((a, b) => b.price - a.price);
    return filtered;
  }, [products, discountRules, query, category, selectedSubcategories, selectedSubSubcategories, sort, browseMode, priceMin, priceMax, availability, offer, collection, publicLaunch]);
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const pagedProducts = visible.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => { setPage(1); }, [query, category, selectedSubcategories, selectedSubSubcategories, availability, offer, collection, sort, browseMode, priceMin, priceMax, pageSize]);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discount = cart.reduce((sum, item) => sum + resolveDiscount(item, item.quantity, discountRules).amount, 0);
  const total = subtotal - discount;

  function browse(mode) {
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

  function updateQuantity(id, quantity) {
    setCart((current) => { const next = current.map((item) => item.id === id ? { ...item, quantity: Math.min(item.stock, Math.max(0, quantity)) } : item).filter((item) => item.quantity > 0); saveCart(next); return next; });
  }

  async function createOrder(channel = "website") {
    setPlacingOrder(true); setError("");
    try {
      const response = await fetch("/api/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...order, channel, items: cart.map(({ id, quantity }) => ({ id, quantity })) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The order could not be created.");
      return data;
    } catch (err) { setError(err.message || "The order could not be created."); return null; }
    finally { setPlacingOrder(false); }
  }

  async function placeOrder(event) {
    event.preventDefault();
    const data = await createOrder("website");
    if (data) { setConfirmation(data); setCart([]); saveCart([]); setCheckout(false); }
  }

  async function orderOnWhatsApp() {
    if (!order.customer || !order.phone || (order.deliveryMethod !== "pickup" && !order.landmark)) {
      setError("Complete the checkout details before ordering on WhatsApp."); return;
    }
    const whatsappWindow = window.open("", "_blank");
    const data = await createOrder("whatsapp");
    if (!data) { whatsappWindow?.close(); return; }
    const lines = cart.map((item, index) => `${index + 1}. ${item.name}\n${[item.colour && `Colour: ${item.colour}`, item.size && `Size: ${item.size}`].filter(Boolean).join("\n")}${item.colour || item.size ? "\n" : ""}SKU: ${item.id}\nQty: ${item.quantity}\nPrice: ${money.format(item.price)}\nLine total: ${money.format(item.price * item.quantity)}`).join("\n\n");
    const message = `Hello PAM Essentials & More 👋\n\nI'd like to place this order (${data.orderId}):\n${lines}\n\nSubtotal: ${money.format(subtotal)}\nDiscount: ${money.format(discount)}\nTotal: ${money.format(data.total)}\n\nName: ${order.customer}\nPhone: ${order.phone}\nDelivery/Pickup: ${order.deliveryMethod}${order.landmark ? `\nLocation: ${order.landmark}` : ""}`;
    const whatsappUrl = `https://wa.me/233207015198?text=${encodeURIComponent(message)}`;
    if (whatsappWindow) whatsappWindow.location.href = whatsappUrl;
    else window.location.href = whatsappUrl;
    setConfirmation(data); setCart([]); saveCart([]); setCheckout(false);
  }

  async function trackOrder(event) {
    event.preventDefault(); setError(""); setTrackedOrder(null);
    const response = await fetch(`/api/orders?reference=${encodeURIComponent(track.reference)}&phone=${encodeURIComponent(track.phone)}`);
    const data = await response.json();
    if (!response.ok) return setError(data.error || "The order could not be found.");
    setTrackedOrder(data.order);
  }

  return (
    <div className="store-shell">
      <div className="utility-bar"><span>PAM Essentials & More · Ghana</span><div><button onClick={() => setTrackOpen(true)}>Track Order</button><a href="/login">Sign In</a></div></div>
      <header className="store-header">
        <div className="header-main">
          <a className="brand" href="/" aria-label="PAM Essentials home"><span className="brand-mark" aria-hidden="true">P</span><span>PAM Essentials</span></a>
          <nav className="store-nav" aria-label="Primary navigation">
            <button type="button" onClick={() => browse("products")}>Products</button>
            <a href="#services">Services</a>
            <button type="button" onClick={() => browse("new")}>New Arrivals</button>
            <button type="button" onClick={() => browse("promotions")}>Promotions</button>
            <button type="button" onClick={() => browse("deals")}>Deals</button>
            <a href="#delivery">Payment &amp; Delivery</a>
          </nav>
          <div className="header-search">
            <input type="search" aria-label="Search products, category or key words" placeholder="Search products, category or key words" value={query} onChange={(event) => { setBrowseMode("products"); setQuery(event.target.value); }} />
            <div className="popular-searches"><span>Popular Searches:</span>{[...curatedSearches, ...popularProducts.map((product) => product.name)].map((term) => <button key={term} type="button" onClick={() => searchPopular(term)}>{term}</button>)}</div>
          </div>
          <button className="cart-button" onClick={() => setCartOpen(true)} aria-label={`Cart, ${cartCount} items`}>Cart <b>{cartCount}</b></button>
        </div>
      </header>

      <section className="hero"><div><p className="eyebrow">Everyday essentials, thoughtfully selected</p><h1>Find what you need.<br />Pick up or get it delivered.</h1><p>School, home, gifts and daily essentials in one simple shop.</p><a className="button primary" href="#catalogue">Shop products</a></div><div className="hero-panel" aria-hidden="true"><span>P</span><span>A</span><span>M</span></div></section>

      <section className="catalogue" id="catalogue">
        <aside className="filters" aria-label="Product filters">
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
          <fieldset className="facet-group"><legend>Collections</legend><label><input type="radio" name="collection" checked={!collection} onChange={() => setCollection("")} /> All</label>{["New Arrivals", "Best Sellers", "Back to School", "Promotion", "PAM Deals"].map((name) => <label key={name}><input type="radio" name="collection" checked={collection === name} onChange={() => setCollection(name)} /> {name}</label>)}</fieldset>
          <div className="service-note" id="services"><b>Need expert advice?</b><p>Message us before you order and we’ll help you choose.</p></div>
        </aside>

        <main className="catalogue-main">
          <div className="catalogue-heading"><div><p className="breadcrumb">{breadcrumb}</p><h2>{heading}</h2><p>{selectedNodes.length > 1 ? `Showing ${visible.length} products from ${selectedNodes.length} selected subcategories` : `${visible.length} products ready to browse`}</p></div><div className="catalogue-controls"><select aria-label="Sort products" value={sort} onChange={(e) => setSort(e.target.value)}><option value="featured">Popularity</option><option value="price-low">Price low to high</option><option value="price-high">Price high to low</option><option value="latest">Latest</option></select><select aria-label="Products per page" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>{[20, 30, 40, 50].map((size) => <option key={size} value={size}>{size} per page</option>)}</select></div></div>
          {selectedNodes.length > 0 && <div className="filter-chips" aria-label="Selected subcategories"><span>{selectedNodes.length} {selectedNodes.length === 1 ? "subcategory" : "subcategories"} selected</span>{selectedNodes.map((item) => <button type="button" key={item.subSubcategoryId || item.subcategoryId} onClick={() => item.subSubcategoryId ? toggleSubSubcategory(item) : toggleSubcategory(item)} aria-label={`Remove ${item.name} filter`}>{item.name} ×</button>)}<button type="button" onClick={() => { setSelectedSubcategories([]); setSelectedSubSubcategories([]); }}>Clear</button></div>}
          {loading && <div className="empty-state"><div className="spinner" /><p>Loading the catalogue…</p></div>}
          {error && !products.length && <div className="empty-state error-panel"><h3>Catalogue unavailable</h3><p>{error}</p></div>}
          {!loading && !error && !visible.length && <div className="empty-state"><h3>No matching products</h3><p>Try another search, category or collection.</p></div>}
          <div className="product-grid">{pagedProducts.map((product) => {
            const variants = product.productGroupId ? products.filter((item) => item.productGroupId === product.productGroupId) : [product];
            const hasVariants = variants.length > 1;
            return <article className="product-card" key={product.id}>
              <a href={`/products/${encodeURIComponent(product.id)}`} className="product-card-image">{product.imageUrl ? <img className="product-photo" src={product.imageUrl} alt={product.name} /> : <ProductArt name={product.name} category={product.category} />}</a>
              <div className="product-copy"><div className="product-badges"><span className={product.stock > 0 ? "badge success" : "badge danger"}>{product.stock > 0 ? "In stock" : "Out of stock"}</span>{product.stock > 0 && product.stock < Number(product.lowStockLevel ?? 8) && <span className="badge warning">Low stock</span>}{isNewArrival(product) && <span className="badge neutral">New</span>}{publicLaunch && isBestSeller(product) && <span className="badge neutral">Best seller</span>}{isOnSale(product, discountRules) && <span className="badge warning">On sale</span>}</div>
              <p className="sku">{product.id}</p><h3><a href={`/products/${encodeURIComponent(product.id)}`}>{product.name}</a></h3>{product.description && <p className="product-description">{product.description}</p>}
              <p className="price">{hasVariants ? variantPrice(variants) : money.format(product.price)}</p>{hasVariants && <small>{variants.length} variants available</small>}
              <button type="button" className="button primary full" onClick={() => { recordClick(product); setQuickProduct(product); }}>{hasVariants ? "View options" : "Quick View"}</button>
              {!hasVariants && product.stock > 0 && <button type="button" className="button secondary full" onClick={() => add(product)}>Add to cart</button>}
            </div></article>;
          })}</div>
          {visible.length > pageSize && <div className="pagination"><button disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {page} of {pageCount}</span><button disabled={page === pageCount} onClick={() => setPage((current) => current + 1)}>Next</button></div>}
        </main>
      </section>

      <footer className="store-footer" id="delivery"><b>PAM Essentials & More</b><span>Pickup and delivery available</span><span>Prices shown in Ghana Cedis</span></footer>

      {quickProduct && <div className="modal-backdrop" role="presentation" onMouseDown={() => setQuickProduct(null)}><div className="modal quick-view-modal" role="dialog" aria-modal="true" aria-label={`Quick View ${quickProduct.name}`} onMouseDown={(event) => event.stopPropagation()}><ProductOptions key={quickProduct.id} initialProduct={quickProduct} products={products} compact onClose={() => setQuickProduct(null)} onAdd={add} /></div></div>}
      {addedProduct && <div className="modal-backdrop" role="presentation"><div className="modal" role="dialog" aria-modal="true" aria-label="Added to cart"><h2>Added to cart</h2><p>{addedProduct.quantity} × {addedProduct.name}</p><p>SKU: {addedProduct.id}{addedProduct.colour && ` · ${addedProduct.colour}`}{addedProduct.size && ` · ${addedProduct.size}`}</p><div className="added-actions"><button className="button secondary" onClick={() => { setAddedProduct(null); document.getElementById("catalogue")?.scrollIntoView({ behavior: "smooth" }); }}>Continue shopping</button><button className="button primary" onClick={() => { setAddedProduct(null); setCartOpen(true); }}>View cart</button></div></div></div>}

      {cartOpen && <div className="drawer-backdrop" onMouseDown={() => setCartOpen(false)}><aside className="cart-drawer" onMouseDown={(event) => event.stopPropagation()}><div className="drawer-title"><div><p className="eyebrow">Your order</p><h2>Shopping cart</h2></div><button className="icon-button" onClick={() => setCartOpen(false)}>×</button></div>{error && <p className="notice error-notice">{error}</p>}{!cart.length ? <div className="empty-state"><h3>Your cart is empty</h3><p>Add a product to get started.</p></div> : <><div className="cart-lines">{cart.map((item) => <div className="cart-line" key={item.id}><ProductArt name={item.name} category={item.category} /><div><h3>{item.name}</h3><p>{[item.colour, item.size, `SKU: ${item.id}`].filter(Boolean).join(" · ")}</p><p>{money.format(item.price)}</p><div className="stepper"><button onClick={() => updateQuantity(item.id, item.quantity - 1)}>−</button><span>{item.quantity}</span><button onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</button></div></div><b>{money.format(item.price * item.quantity - resolveDiscount(item, item.quantity, discountRules).amount)}</b></div>)}</div><div className="cart-total"><span>Subtotal</span><strong>{money.format(subtotal)}</strong></div>{discount > 0 && <div className="cart-total discount-total"><span>Discount</span><strong>−{money.format(discount)}</strong></div>}<div className="cart-total grand-total"><span>Total</span><strong>{money.format(total)}</strong></div>{!checkout ? <button className="button accent full" onClick={() => setCheckout(true)}>Continue to checkout</button> : <form className="checkout-form" onSubmit={placeOrder}><label>Full name<input required value={order.customer} onChange={(e) => setOrder({ ...order, customer: e.target.value })} /></label><label>Mobile number<input required type="tel" value={order.phone} onChange={(e) => setOrder({ ...order, phone: e.target.value })} /></label><label>Fulfilment<select value={order.deliveryMethod} onChange={(e) => setOrder({ ...order, deliveryMethod: e.target.value })}><option value="pickup">Pickup</option><option value="delivery-self">Delivery – self initiated</option><option value="delivery-shop">Delivery – arranged by shop</option></select></label>{order.deliveryMethod !== "pickup" && <label>Location or landmark<input required value={order.landmark} onChange={(e) => setOrder({ ...order, landmark: e.target.value })} /></label>}<button className="button accent full" type="submit" disabled={placingOrder}>{placingOrder ? "Creating order…" : `Pay on pickup/delivery · ${money.format(total)}`}</button><button className="button whatsapp full" type="button" disabled={placingOrder} onClick={orderOnWhatsApp}>Order on WhatsApp</button><button className="button secondary full" type="button" disabled title="Payment provider has not been selected yet">Pay now · coming soon</button></form>}</>}</aside></div>}
      {confirmation && <div className="modal-backdrop"><div className="modal"><span className="success-mark">✓</span><h2>Order received</h2><p>Keep this reference for pickup or delivery.</p><strong className="order-reference">{confirmation.orderId}</strong><button className="button primary full" onClick={() => { setConfirmation(null); setCartOpen(false); }}>Continue shopping</button></div></div>}
      {trackOpen && <div className="modal-backdrop"><form className="modal admin-form" onSubmit={trackOrder}><div className="drawer-title"><div><p className="eyebrow">Order status</p><h2>Track order</h2></div><button type="button" className="icon-button" onClick={() => { setTrackOpen(false); setTrackedOrder(null); setError(""); }}>×</button></div>{error && <p className="notice error-notice">{error}</p>}<label>Order reference<input required placeholder="ORD-…" value={track.reference} onChange={(event) => setTrack({ ...track, reference: event.target.value })} /></label><label>Phone number<input required type="tel" value={track.phone} onChange={(event) => setTrack({ ...track, phone: event.target.value })} /></label><button className="button primary full">Find order</button>{trackedOrder && <div className="tracked-order"><span className="badge warning">{trackedOrder.status}</span><h3>{trackedOrder.orderId}</h3><p>{trackedOrder.paymentStatus} · {trackedOrder.deliveryMethod}</p><strong>{money.format(trackedOrder.total)}</strong>{trackedOrder.pickupCode && <p className="pickup-code">Pickup code {trackedOrder.pickupCode}</p>}</div>}</form></div>}
      <a className="whatsapp-fab" href="https://wa.me/" target="_blank" rel="noreferrer" aria-label="Chat with PAM Essentials on WhatsApp">WhatsApp</a>
      {cookieVisible && <div className="cookie-banner"><p><b>Privacy notice</b> We use essential browser storage for your cart, staff sign-in and offline till sync.</p><button className="button accent" onClick={() => { localStorage.setItem("pam-cookie-notice", "accepted"); setCookieVisible(false); }}>Okay</button></div>}
    </div>
  );
}

