"use client";

import { useEffect, useMemo, useState } from "react";
import { resolveDiscount } from "@/lib/commerce";

const money = new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" });

function ProductArt({ name, category }) {
  const initials = name.split(" ").slice(0, 2).map((word) => word[0]).join("");
  return <div className="product-art" aria-label={`${name} image placeholder`}><span>{initials}</span><small>{category}</small></div>;
}

export default function Storefront() {
  const [products, setProducts] = useState([]);
  const [discountRules, setDiscountRules] = useState([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All categories");
  const [sort, setSort] = useState("featured");
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(Infinity);
  const [cart, setCart] = useState([]);
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

  useEffect(() => {
    fetch("/api/catalog/products")
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); setProducts(data.products || []); setDiscountRules(data.discountRules || []); const highest = Math.ceil(Math.max(0, ...(data.products || []).map((product) => Number(product.price || 0)))); setPriceMax(highest || Infinity); })
      .catch((err) => setError(err.message || "The catalogue is unavailable."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { setCookieVisible(localStorage.getItem("pam-cookie-notice") !== "accepted"); }, []);

  const categories = useMemo(() => ["All categories", ...new Set(products.map((product) => product.category))], [products]);
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    const filtered = products.filter((product) => (!term || `${product.name} ${product.id} ${product.category}`.toLowerCase().includes(term)) && (category === "All categories" || product.category === category) && product.price >= priceMin && product.price <= priceMax);
    if (sort === "price-low") return [...filtered].sort((a, b) => a.price - b.price);
    if (sort === "price-high") return [...filtered].sort((a, b) => b.price - a.price);
    if (sort === "latest") return [...filtered].reverse();
    return filtered;
  }, [products, query, category, sort, priceMin, priceMax]);
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const pagedProducts = visible.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => { setPage(1); }, [query, category, sort, priceMin, priceMax, pageSize]);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discount = cart.reduce((sum, item) => sum + resolveDiscount(item, item.quantity, discountRules).amount, 0);
  const total = subtotal - discount;

  function add(product) {
    setCart((current) => {
      const found = current.find((item) => item.id === product.id);
      return found ? current.map((item) => item.id === product.id ? { ...item, quantity: Math.min(item.stock, item.quantity + 1) } : item) : [...current, { ...product, quantity: 1 }];
    });
    setCartOpen(true);
  }

  function updateQuantity(id, quantity) {
    setCart((current) => current.map((item) => item.id === id ? { ...item, quantity: Math.min(item.stock, Math.max(0, quantity)) } : item).filter((item) => item.quantity > 0));
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
    if (data) { setConfirmation(data); setCart([]); setCheckout(false); }
  }

  async function orderOnWhatsApp() {
    if (!order.customer || !order.phone || (order.deliveryMethod !== "pickup" && !order.landmark)) {
      setError("Complete the checkout details before ordering on WhatsApp."); return;
    }
    const whatsappWindow = window.open("", "_blank");
    const data = await createOrder("whatsapp");
    if (!data) { whatsappWindow?.close(); return; }
    const lines = cart.map((item) => `${item.quantity} × ${item.name}`).join("\n");
    const message = `PAM Essentials order ${data.orderId}\n${order.customer} · ${order.phone}\n${lines}\nTotal: ${money.format(data.total)}\nFulfilment: ${order.deliveryMethod}${order.landmark ? ` · ${order.landmark}` : ""}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    if (whatsappWindow) whatsappWindow.location.href = whatsappUrl;
    else window.location.href = whatsappUrl;
    setConfirmation(data); setCart([]); setCheckout(false);
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
      <div className="utility-bar"><span>PAM Essentials & More · Ghana</span><span>Open daily 6:30 am – 8:00 pm</span><div><a href="#services">Expert Advice</a><a href="/login">My Account</a><button onClick={() => setTrackOpen(true)}>Track Order</button></div></div>
      <header className="store-header">
        <a className="brand" href="/">PAM Essentials</a>
        <nav aria-label="Primary navigation"><a href="#catalogue">Products</a><a href="#services">Services</a><a href="#catalogue">Promotions</a><a href="#delivery">Payment & delivery</a></nav>
        <button className="cart-button" onClick={() => setCartOpen(true)}>Cart <b>{cartCount}</b></button>
      </header>

      <section className="hero"><div><p className="eyebrow">Everyday essentials, thoughtfully selected</p><h1>Find what you need.<br />Pick up or get it delivered.</h1><p>School, home, gifts and daily essentials in one simple shop.</p><a className="button primary" href="#catalogue">Shop products</a></div><div className="hero-panel" aria-hidden="true"><span>P</span><span>A</span><span>M</span></div></section>

      <section className="catalogue" id="catalogue">
        <aside className="filters"><p className="eyebrow">Browse</p><h2>Categories</h2>{categories.map((name) => <button key={name} className={category === name ? "filter active" : "filter"} onClick={() => setCategory(name)}><span>{name}</span><small>{name === "All categories" ? products.length : products.filter((p) => p.category === name).length}</small></button>)}<div className="price-filter"><b>Price range</b><label>Minimum<input type="number" min="0" value={priceMin} onChange={(event) => setPriceMin(Math.max(0, Number(event.target.value || 0)))} /></label><label>Maximum<input type="number" min="0" value={Number.isFinite(priceMax) ? priceMax : ""} onChange={(event) => setPriceMax(event.target.value === "" ? Infinity : Math.max(0, Number(event.target.value)))} /></label></div><div className="service-note" id="services"><b>Need expert advice?</b><p>Message us before you order and we’ll help you choose.</p></div></aside>

        <main className="catalogue-main">
          <div className="catalogue-heading"><div><p className="breadcrumb">Home / {category}</p><h2>{category}</h2><p>{visible.length} products ready to browse</p></div><div className="catalogue-controls"><input aria-label="Search products" placeholder="Search products or SKU" value={query} onChange={(e) => setQuery(e.target.value)} /><select aria-label="Sort products" value={sort} onChange={(e) => setSort(e.target.value)}><option value="featured">Popularity</option><option value="price-low">Price low to high</option><option value="price-high">Price high to low</option><option value="latest">Latest</option></select><select aria-label="Products per page" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>{[20, 30, 40, 50].map((size) => <option key={size} value={size}>{size} per page</option>)}</select></div></div>
          {loading && <div className="empty-state"><div className="spinner" /><p>Loading the catalogue…</p></div>}
          {error && !products.length && <div className="empty-state error-panel"><h3>Catalogue unavailable</h3><p>{error}</p></div>}
          {!loading && !error && !visible.length && <div className="empty-state"><h3>No matching products</h3><p>Try another search or category.</p></div>}
          <div className="product-grid">{pagedProducts.map((product) => <article className="product-card" key={product.id}>{product.imageUrl ? <img className="product-photo" src={product.imageUrl} alt={product.name} /> : <ProductArt name={product.name} category={product.category} />}<div className="product-copy"><span className={product.stock > 0 ? "badge success" : "badge danger"}>{product.stock > 0 ? "In stock" : "Out of stock"}</span><p className="sku">{product.id}</p><h3>{product.name}</h3>{product.description && <p className="product-description">{product.description}</p>}<p className="price">{money.format(product.price)}</p><button className="button primary full" disabled={product.stock <= 0} onClick={() => add(product)}>{product.stock > 0 ? "Add to cart" : "Unavailable"}</button></div></article>)}</div>
          {visible.length > pageSize && <div className="pagination"><button disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {page} of {pageCount}</span><button disabled={page === pageCount} onClick={() => setPage((current) => current + 1)}>Next</button></div>}
        </main>
      </section>

      <footer className="store-footer" id="delivery"><b>PAM Essentials & More</b><span>Pickup and delivery available</span><span>Prices shown in Ghana Cedis</span></footer>

      {cartOpen && <div className="drawer-backdrop" onMouseDown={() => setCartOpen(false)}><aside className="cart-drawer" onMouseDown={(event) => event.stopPropagation()}><div className="drawer-title"><div><p className="eyebrow">Your order</p><h2>Shopping cart</h2></div><button className="icon-button" onClick={() => setCartOpen(false)}>×</button></div>{error && <p className="notice error-notice">{error}</p>}{!cart.length ? <div className="empty-state"><h3>Your cart is empty</h3><p>Add a product to get started.</p></div> : <><div className="cart-lines">{cart.map((item) => <div className="cart-line" key={item.id}><ProductArt name={item.name} category={item.category} /><div><h3>{item.name}</h3><p>{money.format(item.price)}</p><div className="stepper"><button onClick={() => updateQuantity(item.id, item.quantity - 1)}>−</button><span>{item.quantity}</span><button onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</button></div></div><b>{money.format(item.price * item.quantity - resolveDiscount(item, item.quantity, discountRules).amount)}</b></div>)}</div><div className="cart-total"><span>Subtotal</span><strong>{money.format(subtotal)}</strong></div>{discount > 0 && <div className="cart-total discount-total"><span>Discount</span><strong>−{money.format(discount)}</strong></div>}<div className="cart-total grand-total"><span>Total</span><strong>{money.format(total)}</strong></div>{!checkout ? <button className="button accent full" onClick={() => setCheckout(true)}>Continue to checkout</button> : <form className="checkout-form" onSubmit={placeOrder}><label>Full name<input required value={order.customer} onChange={(e) => setOrder({ ...order, customer: e.target.value })} /></label><label>Mobile number<input required type="tel" value={order.phone} onChange={(e) => setOrder({ ...order, phone: e.target.value })} /></label><label>Fulfilment<select value={order.deliveryMethod} onChange={(e) => setOrder({ ...order, deliveryMethod: e.target.value })}><option value="pickup">Pickup</option><option value="delivery-self">Delivery – self initiated</option><option value="delivery-shop">Delivery – arranged by shop</option></select></label>{order.deliveryMethod !== "pickup" && <label>Location or landmark<input required value={order.landmark} onChange={(e) => setOrder({ ...order, landmark: e.target.value })} /></label>}<button className="button accent full" type="submit" disabled={placingOrder}>{placingOrder ? "Creating order…" : `Pay on pickup/delivery · ${money.format(total)}`}</button><button className="button whatsapp full" type="button" disabled={placingOrder} onClick={orderOnWhatsApp}>Order on WhatsApp</button><button className="button secondary full" type="button" disabled title="Payment provider has not been selected yet">Pay now · coming soon</button></form>}</>}</aside></div>}
      {confirmation && <div className="modal-backdrop"><div className="modal"><span className="success-mark">✓</span><h2>Order received</h2><p>Keep this reference for pickup or delivery.</p><strong className="order-reference">{confirmation.orderId}</strong><button className="button primary full" onClick={() => { setConfirmation(null); setCartOpen(false); }}>Continue shopping</button></div></div>}
      {trackOpen && <div className="modal-backdrop"><form className="modal admin-form" onSubmit={trackOrder}><div className="drawer-title"><div><p className="eyebrow">Order status</p><h2>Track order</h2></div><button type="button" className="icon-button" onClick={() => { setTrackOpen(false); setTrackedOrder(null); setError(""); }}>×</button></div>{error && <p className="notice error-notice">{error}</p>}<label>Order reference<input required placeholder="ORD-…" value={track.reference} onChange={(event) => setTrack({ ...track, reference: event.target.value })} /></label><label>Phone number<input required type="tel" value={track.phone} onChange={(event) => setTrack({ ...track, phone: event.target.value })} /></label><button className="button primary full">Find order</button>{trackedOrder && <div className="tracked-order"><span className="badge warning">{trackedOrder.status}</span><h3>{trackedOrder.orderId}</h3><p>{trackedOrder.paymentStatus} · {trackedOrder.deliveryMethod}</p><strong>{money.format(trackedOrder.total)}</strong>{trackedOrder.pickupCode && <p className="pickup-code">Pickup code {trackedOrder.pickupCode}</p>}</div>}</form></div>}
      <a className="whatsapp-fab" href="https://wa.me/" target="_blank" rel="noreferrer" aria-label="Chat with PAM Essentials on WhatsApp">WhatsApp</a>
      {cookieVisible && <div className="cookie-banner"><p><b>Privacy notice</b> We use essential browser storage for your cart, staff sign-in and offline till sync.</p><button className="button accent" onClick={() => { localStorage.setItem("pam-cookie-notice", "accepted"); setCookieVisible(false); }}>Okay</button></div>}
    </div>
  );
}
