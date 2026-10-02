"use client";

import { useCallback, useEffect, useState } from "react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { signOut, useAuth } from "@/components/AuthProvider";
import BrandLogo from "@/components/BrandLogo";

const money = new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" });

export default function CustomerAccount() {
  const { user, role, loading } = useAuth();
  const [mode, setMode] = useState("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orders, setOrders] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [reference, setReference] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [products, setProducts] = useState([]);
  useEffect(() => { if (new URLSearchParams(window.location.search).get("mode") === "signin") setMode("signin"); }, []);

  const request = useCallback(async (path, options = {}) => {
    const token = await auth.currentUser?.getIdToken();
    const response = await fetch(path, { ...options, headers: { ...options.headers, authorization: `Bearer ${token}` } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Please try again.");
    return data;
  }, []);

  const refresh = useCallback(async () => {
    const [orderData, wishlistData, catalogue] = await Promise.all([request("/api/orders"), request("/api/customer/wishlist"), fetch("/api/catalog/products").then((response) => response.json())]);
    setOrders(orderData.orders || []);
    setWishlist(wishlistData.wishlist || []);
    setProducts(catalogue.products || []);
  }, [request]);

  useEffect(() => {
    if (loading || !user || role) return;
    refresh().catch((reason) => setError(reason.message));
    const wanted = new URLSearchParams(window.location.search).get("wishlist");
    if (wanted) request("/api/customer/wishlist", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ productId: wanted }) })
      .then(() => { setNotice("Product saved to your wishlist."); window.history.replaceState({}, "", "/account"); return refresh(); })
      .catch((reason) => setError(reason.message));
  }, [loading, user, role, request, refresh]);

  async function handleAuth(event) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      if (mode === "register") await createUserWithEmailAndPassword(auth, email.trim(), password);
      else await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (reason) {
      setError(reason.code === "auth/email-already-in-use" ? "An account already uses this email. Choose Sign in." : reason.code === "auth/weak-password" ? "Choose a stronger password." : "Account access failed. Check your email and password.");
    } finally { setBusy(false); }
  }

  async function claim(event) {
    event.preventDefault(); setBusy(true); setError("");
    try { await request("/api/customer/orders/claim", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reference, phone }) }); await refresh(); setReference(""); setPhone(""); setNotice("Order linked to your account."); }
    catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  async function removeWish(productId) {
    setError("");
    try { await request("/api/customer/wishlist", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ productId, remove: true }) }); setWishlist((current) => current.filter((id) => id !== productId)); }
    catch (reason) { setError(reason.message); }
  }

  return <div className="customer-account"><header className="product-page-header"><a className="brand" href="/" aria-label="PAM Essentials home"><BrandLogo /></a><a href="/">Continue shopping</a></header><main className="account-main">
    <p className="eyebrow">PAM Essentials &amp; More</p><h1>Customer account</h1><p>Browse and check out as a guest whenever you like. Create an account to save products and track orders.</p>
    {error && <p className="notice error-notice">{error}</p>}{notice && <p className="notice">{notice}</p>}
    {loading ? <p>Checking account…</p> : role ? <div className="panel account-panel"><h2>Staff session active</h2><p>Customer accounts are separate from staff access.</p><button className="button secondary" onClick={() => signOut()}>Sign out of staff account</button></div> : !user ? <form className="panel account-panel" onSubmit={handleAuth}><div className="account-tabs"><button type="button" className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Create account</button><button type="button" className={mode === "signin" ? "active" : ""} onClick={() => setMode("signin")}>Sign in</button></div><label>Email<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Password<input required type="password" minLength={6} autoComplete={mode === "register" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} /></label><button className="button primary" disabled={busy}>{busy ? "Please wait…" : mode === "register" ? "Create account" : "Sign in"}</button></form> : <>
      <div className="account-hero"><div><p className="eyebrow">Welcome back</p><h2>Your PAM account</h2><p>{user.email}</p></div><div className="account-hero-stats"><a href="#orders"><strong>{orders.length}</strong><span>Orders</span></a><a href="#wishlist"><strong>{wishlist.length}</strong><span>Saved products</span></a></div></div>
      <div className="account-heading"><nav aria-label="Account sections"><a href="#orders">My orders</a><a href="#wishlist">Wishlist</a><a href="/#catalogue">Shop more</a></nav><button type="button" onClick={() => signOut()}>Sign out</button></div>
      <section className="panel account-panel" id="orders"><h2>My orders</h2>{orders.length ? <div className="account-orders">{orders.map((order) => <article key={order.orderId}><div><b>{order.orderId}</b><span className="badge warning">{order.status}</span></div><p>{order.items.map((item) => `${item.quantity} × ${item.name}`).join(", ")}</p><p>{order.deliveryMethod} · {order.paymentStatus}{order.pickupCode && ` · Pickup code ${order.pickupCode}`}</p><strong>{money.format(order.total)}</strong></article>)}</div> : <p>No orders are linked to this account yet.</p>}
        <form className="claim-form" onSubmit={claim}><h3>Link an earlier guest order</h3><p>Enter the reference and phone number used at checkout.</p><input required placeholder="Order reference" value={reference} onChange={(event) => setReference(event.target.value)} /><input required type="tel" placeholder="Phone number" value={phone} onChange={(event) => setPhone(event.target.value)} /><button className="button secondary" disabled={busy}>Link order</button></form>
      </section>
      <section className="panel account-panel" id="wishlist"><h2>Wishlist</h2>{wishlist.length ? <div className="wishlist-list">{wishlist.map((id) => { const product = products.find((item) => item.id === id); return <div key={id}><a href={`/products/${encodeURIComponent(id)}`}>{product?.name || id}</a><button type="button" onClick={() => removeWish(id)}>Remove</button></div>; })}</div> : <p>Save a product from its detail page to see it here.</p>}</section>
    </>}
  </main></div>;
}

