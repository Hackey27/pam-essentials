"use client";

import { useEffect, useMemo, useState } from "react";

const money = new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" });

function ProductArt({ name, category }) {
  const initials = name.split(" ").slice(0, 2).map((word) => word[0]).join("");
  return <div className="product-art" aria-label={`${name} image placeholder`}><span>{initials}</span><small>{category}</small></div>;
}

export default function Storefront() {
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All categories");
  const [sort, setSort] = useState("featured");
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checkout, setCheckout] = useState(false);
  const [order, setOrder] = useState({ customer: "", phone: "", deliveryMethod: "pickup", landmark: "" });
  const [confirmation, setConfirmation] = useState(null);

  useEffect(() => {
    fetch("/api/catalog/products")
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); setProducts(data.products || []); })
      .catch((err) => setError(err.message || "The catalogue is unavailable."))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => ["All categories", ...new Set(products.map((product) => product.category))], [products]);
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    const filtered = products.filter((product) => (!term || `${product.name} ${product.id} ${product.category}`.toLowerCase().includes(term)) && (category === "All categories" || product.category === category));
    if (sort === "price-low") return [...filtered].sort((a, b) => a.price - b.price);
    if (sort === "price-high") return [...filtered].sort((a, b) => b.price - a.price);
    if (sort === "latest") return [...filtered].reverse();
    return filtered;
  }, [products, query, category, sort]);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  function add(product) {
    setCart((current) => {
      const found = current.find((item) => item.id === product.id);
      return found ? current.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item) : [...current, { ...product, quantity: 1 }];
    });
    setCartOpen(true);
  }

  function updateQuantity(id, quantity) {
    setCart((current) => current.map((item) => item.id === id ? { ...item, quantity: Math.max(0, quantity) } : item).filter((item) => item.quantity > 0));
  }

  async function placeOrder(event) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...order, items: cart.map(({ id, quantity }) => ({ id, quantity })) }) });
    const data = await response.json();
    if (!response.ok) return setError(data.error || "The order could not be created.");
    setConfirmation(data); setCart([]); setCheckout(false);
  }

  return (
    <div className="store-shell">
      <div className="utility-bar"><span>PAM Essentials & More · Ghana</span><span>Open daily 6:30 am – 8:00 pm</span><a href="/login">Staff sign in</a></div>
      <header className="store-header">
        <a className="brand" href="/">PAM Essentials</a>
        <nav aria-label="Primary navigation"><a href="#catalogue">Products</a><a href="#services">Services</a><a href="#catalogue">Promotions</a><a href="#delivery">Payment & delivery</a></nav>
        <button className="cart-button" onClick={() => setCartOpen(true)}>Cart <b>{cartCount}</b></button>
      </header>

      <section className="hero"><div><p className="eyebrow">Everyday essentials, thoughtfully selected</p><h1>Find what you need.<br />Pick up or get it delivered.</h1><p>School, home, gifts and daily essentials in one simple shop.</p><a className="button primary" href="#catalogue">Shop products</a></div><div className="hero-panel" aria-hidden="true"><span>P</span><span>A</span><span>M</span></div></section>

      <section className="catalogue" id="catalogue">
        <aside className="filters"><p className="eyebrow">Browse</p><h2>Categories</h2>{categories.map((name) => <button key={name} className={category === name ? "filter active" : "filter"} onClick={() => setCategory(name)}><span>{name}</span><small>{name === "All categories" ? products.length : products.filter((p) => p.category === name).length}</small></button>)}<div className="service-note" id="services"><b>Need expert advice?</b><p>Message us before you order and we’ll help you choose.</p></div></aside>

        <main className="catalogue-main">
          <div className="catalogue-heading"><div><p className="breadcrumb">Home / {category}</p><h2>{category}</h2><p>{visible.length} products ready to browse</p></div><div className="catalogue-controls"><input aria-label="Search products" placeholder="Search products or SKU" value={query} onChange={(e) => setQuery(e.target.value)} /><select aria-label="Sort products" value={sort} onChange={(e) => setSort(e.target.value)}><option value="featured">Featured</option><option value="price-low">Price low to high</option><option value="price-high">Price high to low</option><option value="latest">Latest</option></select></div></div>
          {loading && <div className="empty-state"><div className="spinner" /><p>Loading the catalogue…</p></div>}
          {error && !products.length && <div className="empty-state error-panel"><h3>Catalogue unavailable</h3><p>{error}</p></div>}
          {!loading && !error && !visible.length && <div className="empty-state"><h3>No matching products</h3><p>Try another search or category.</p></div>}
          <div className="product-grid">{visible.map((product) => <article className="product-card" key={product.id}><ProductArt name={product.name} category={product.category} /><div className="product-copy"><span className={product.stock > 0 ? "badge success" : "badge danger"}>{product.stock > 0 ? "In stock" : "Out of stock"}</span><p className="sku">{product.id}</p><h3>{product.name}</h3><p className="price">{money.format(product.price)}</p><button className="button primary full" disabled={product.stock <= 0} onClick={() => add(product)}>{product.stock > 0 ? "Add to cart" : "Unavailable"}</button></div></article>)}</div>
        </main>
      </section>

      <footer className="store-footer" id="delivery"><b>PAM Essentials & More</b><span>Pickup and delivery available</span><span>Prices shown in Ghana Cedis</span></footer>

      {cartOpen && <div className="drawer-backdrop" onMouseDown={() => setCartOpen(false)}><aside className="cart-drawer" onMouseDown={(event) => event.stopPropagation()}><div className="drawer-title"><div><p className="eyebrow">Your order</p><h2>Shopping cart</h2></div><button className="icon-button" onClick={() => setCartOpen(false)}>×</button></div>{!cart.length ? <div className="empty-state"><h3>Your cart is empty</h3><p>Add a product to get started.</p></div> : <><div className="cart-lines">{cart.map((item) => <div className="cart-line" key={item.id}><ProductArt name={item.name} category={item.category} /><div><h3>{item.name}</h3><p>{money.format(item.price)}</p><div className="stepper"><button onClick={() => updateQuantity(item.id, item.quantity - 1)}>−</button><span>{item.quantity}</span><button onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</button></div></div><b>{money.format(item.price * item.quantity)}</b></div>)}</div><div className="cart-total"><span>Subtotal</span><strong>{money.format(subtotal)}</strong></div>{!checkout ? <button className="button accent full" onClick={() => setCheckout(true)}>Continue to checkout</button> : <form className="checkout-form" onSubmit={placeOrder}><label>Full name<input required value={order.customer} onChange={(e) => setOrder({ ...order, customer: e.target.value })} /></label><label>Mobile number<input required type="tel" value={order.phone} onChange={(e) => setOrder({ ...order, phone: e.target.value })} /></label><label>Fulfilment<select value={order.deliveryMethod} onChange={(e) => setOrder({ ...order, deliveryMethod: e.target.value })}><option value="pickup">Pickup</option><option value="delivery-self">Delivery – self initiated</option><option value="delivery-shop">Delivery – arranged by shop</option></select></label>{order.deliveryMethod !== "pickup" && <label>Location or landmark<input required value={order.landmark} onChange={(e) => setOrder({ ...order, landmark: e.target.value })} /></label>}<button className="button accent full" type="submit">Place order</button></form>}</>}</aside></div>}
      {confirmation && <div className="modal-backdrop"><div className="modal"><span className="success-mark">✓</span><h2>Order received</h2><p>Keep this reference for pickup or delivery.</p><strong className="order-reference">{confirmation.orderId}</strong><button className="button primary full" onClick={() => { setConfirmation(null); setCartOpen(false); }}>Continue shopping</button></div></div>}
    </div>
  );
}
