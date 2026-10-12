"use client";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { auth } from "@/lib/firebase";
const date = (value) => value ? new Date(value).toLocaleDateString("en-GH", { dateStyle: "medium" }) : "";
export function ReviewRating({ product, summary }) {
  const count = Number(summary?.count ?? product?.reviewCount ?? 0), average = Number(summary?.average ?? product?.rating ?? 0);
  return <div className="review-rating" aria-label={count ? `${average.toFixed(1)} out of 5 stars, ${count} ${count === 1 ? "review" : "reviews"}` : "No reviews yet"}>{count ? <><span aria-hidden="true">★</span><strong>{average.toFixed(1)}</strong><span>({count} {count === 1 ? "review" : "reviews"})</span></> : <span>No reviews yet</span>}</div>;
}
export default function ProductReviews({ product }) {
  const { user, role, loading: authLoading } = useAuth();
  const [reviews, setReviews] = useState([]), [summary, setSummary] = useState({ count: 0, average: 0, ratingCounts: {} }), [cursor, setCursor] = useState(null);
  const [own, setOwn] = useState(null), [form, setForm] = useState({ rating: 5, title: "", text: "", publicName: "" });
  const [loading, setLoading] = useState(true), [ownReady, setOwnReady] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const lock = useRef(false), generation = useRef(0);
  const update = (key, value) => setForm((old) => ({ ...old, [key]: value }));
  useEffect(() => {
    const current = ++generation.current, controller = new AbortController();
    setReviews([]); setCursor(null); setOwn(null); setOwnReady(false); setLoading(true); setError(""); setNotice(""); setForm({ rating: 5, title: "", text: "", publicName: user?.displayName || "" });
    async function load() {
      try {
        const response = await fetch(`/api/product-reviews?productId=${encodeURIComponent(product.id)}`, { signal: controller.signal, cache: "no-store" }), data = await response.json(); if (!response.ok) throw new Error(data.error);
        if (current !== generation.current) return; setReviews(data.reviews); setSummary(data.summary); setCursor(data.nextCursor);
        if (user && !role && !authLoading) {
          const token = await auth.currentUser?.getIdToken(), ownResponse = await fetch(`/api/customer/reviews?productId=${encodeURIComponent(product.id)}`, { headers: { authorization: `Bearer ${token}` }, signal: controller.signal, cache: "no-store" }), ownData = await ownResponse.json();
          if (!ownResponse.ok) throw new Error(ownData.error); if (current !== generation.current) return;
          setOwn(ownData.review); if (ownData.review) setForm({ rating: ownData.review.rating, title: ownData.review.title, text: ownData.review.text, publicName: ownData.review.publicName }); setOwnReady(true);
        }
      } catch (reason) { if (!controller.signal.aborted && current === generation.current) setError(reason.message || "Could not load reviews."); }
      finally { if (current === generation.current) setLoading(false); }
    }
    load(); return () => controller.abort();
  }, [product.id, user?.uid, role, authLoading]);
  async function more() {
    if (lock.current) return; const current = generation.current; lock.current = true; setBusy(true); setError("");
    try { const r = await fetch(`/api/product-reviews?productId=${encodeURIComponent(product.id)}&cursor=${cursor}`, { cache: "no-store" }), data = await r.json(); if (!r.ok) throw new Error(data.error); if (current !== generation.current) return; setReviews((old) => [...new Map([...old, ...data.reviews].map((v) => [v.id, v])).values()]); setSummary(data.summary); setCursor(data.nextCursor); }
    catch (reason) { if (current === generation.current) setError(reason.message); } finally { lock.current = false; setBusy(false); }
  }
  async function submit(event) {
    event.preventDefault(); if (lock.current || !ownReady) return; const current = generation.current; lock.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const token = await auth.currentUser?.getIdToken(), response = await fetch("/api/customer/reviews", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ productId: product.id, revision: own?.revision || 0, ...form }) }), data = await response.json(); if (!response.ok) throw new Error(data.error);
      if (current !== generation.current) return; setNotice(data.message);
      const [publicResponse, ownResponse] = await Promise.all([fetch(`/api/product-reviews?productId=${encodeURIComponent(product.id)}`, { cache: "no-store" }), fetch(`/api/customer/reviews?productId=${encodeURIComponent(product.id)}`, { headers: { authorization: `Bearer ${token}` }, cache: "no-store" })]);
      const [publicData, ownData] = await Promise.all([publicResponse.json(), ownResponse.json()]); if (!publicResponse.ok || !ownResponse.ok) { setOwnReady(false); throw new Error("Review saved. Refresh this page to load its latest status."); } if (current !== generation.current) return;
      setOwn(ownData.review); setReviews(publicData.reviews); setSummary(publicData.summary); setCursor(publicData.nextCursor);
    } catch (reason) { if (current === generation.current) setError(reason.message || "Review was not confirmed as saved. Please retry."); } finally { lock.current = false; setBusy(false); }
  }
  return <section className="product-reviews" id="product-reviews" aria-labelledby="product-review-heading"><div className="review-section-heading"><div><p className="eyebrow">Customer experiences</p><h2 id="product-review-heading">Ratings &amp; reviews</h2><ReviewRating summary={summary} /></div><p>Reviews cover this product{product.productGroupId ? " and its variants" : ""}. Only published reviews contribute to its rating.</p></div>
    {error && <p className="notice error-notice" role="alert">{error} <button type="button" onClick={() => window.location.reload()}>Refresh reviews</button></p>}{notice && <p className="notice" role="status">{notice}</p>}
    {loading ? <p role="status">Loading reviews…</p> : <div className="review-content-grid"><div>{summary.count > 0 && <div className="review-distribution" aria-label="Ratings distribution">{[5,4,3,2,1].map((star) => <div key={star}><span>{star} ★</span><progress max={summary.count} value={summary.ratingCounts[star] || 0} aria-label={`${star} stars: ${summary.ratingCounts[star] || 0} reviews`} /><span>{summary.ratingCounts[star] || 0}</span></div>)}</div>}{reviews.length ? reviews.map((review) => <article className="customer-review" key={review.id}><header><b>{review.publicName}</b><time>{date(review.createdAt)}</time></header><div className="review-stars" aria-label={`${review.rating} out of 5 stars`}>{"★".repeat(review.rating)}{"☆".repeat(5-review.rating)}</div>{review.verifiedPurchase && <span className="badge success">Verified purchase</span>}{review.variant && <p className="review-variant">Selection: {review.variant}</p>}{review.title && <h3>{review.title}</h3>}<p className="review-text">{review.text}</p>{review.reply && <div className="review-reply"><b>PAM Essentials &amp; More replied</b><p className="review-text">{review.reply}</p></div>}</article>) : <p>No reviews yet. Share your experience with this product.</p>}{cursor && <button type="button" className="button secondary" disabled={busy} onClick={more}>Load more reviews</button>}</div>
    <div className="review-write-panel">{authLoading ? <p>Checking your account…</p> : !user || role ? <><h3>Share your experience</h3><p>Sign in to a customer account to rate this product and write a review.</p><a className="button primary" href="/account?mode=signin">Sign in to review</a></> : <form onSubmit={submit}><h3>{own ? "Your review" : "Write a review"}</h3>{own && <p className="notice">Status: {own.status}{own.reason && ` · ${own.reason}`}</p>}<p>Your display name and review will be public after moderation. Your email and phone number stay private. Editing a published review returns it to moderation.</p><fieldset disabled={busy || !ownReady}><legend>Your rating</legend><div className="review-star-picker" role="radiogroup" aria-label="Your star rating" onKeyDown={(e) => { const next = e.key === "ArrowRight" || e.key === "ArrowUp" ? Math.min(5, form.rating+1) : e.key === "ArrowLeft" || e.key === "ArrowDown" ? Math.max(1, form.rating-1) : e.key === "Home" ? 1 : e.key === "End" ? 5 : null; if (next) { e.preventDefault(); update("rating",next); e.currentTarget.querySelectorAll("button")[next-1]?.focus(); } }}>{[1,2,3,4,5].map((star) => <button type="button" role="radio" tabIndex={form.rating === star ? 0 : -1} aria-checked={form.rating === star} aria-label={`${star} ${star === 1 ? "star" : "stars"}`} className={star <= form.rating ? "selected" : ""} key={star} onClick={() => update("rating", star)}>★</button>)}</div><label>Public display name<input required maxLength={80} autoComplete="nickname" value={form.publicName} onChange={(e) => update("publicName", e.target.value)} /></label><label>Title (optional)<input maxLength={120} value={form.title} onChange={(e) => update("title", e.target.value)} /></label><label>Your review<textarea required minLength={5} maxLength={2000} rows={5} value={form.text} onChange={(e) => update("text", e.target.value)} /></label><button className="button primary" disabled={busy || !ownReady}>{busy ? "Saving…" : own ? "Update review" : "Submit review"}</button></fieldset></form>}</div></div>}
  </section>;
}
