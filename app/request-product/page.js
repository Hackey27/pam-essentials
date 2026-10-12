"use client";

import { useEffect, useRef, useState } from "react";
import BrandLogo from "@/components/BrandLogo";
import WhatsAppIcon from "@/components/WhatsAppIcon";
import { PRIMARY_PHONE_LABEL, PRIMARY_WHATSAPP } from "@/lib/shop";
import { requestPhotoBytes, requestPhotoLimit, requestPhotoTypes } from "@/lib/productRequests.mjs";

const defaults = { productName: "", description: "", quantity: 1, preferences: "", measurements: "", productLink: "", budget: "", preferredDate: "", allowAlternatives: false, name: "", phone: "", email: "", acknowledged: false, website: "" };
export default function RequestProductPage() {
  const [form, setForm] = useState(defaults), [photos, setPhotos] = useState([]), [error, setError] = useState("");
  const [busy, setBusy] = useState(false), [result, setResult] = useState(null), [back, setBack] = useState("/#catalogue"), [fromFooter, setFromFooter] = useState(false);
  const inFlight = useRef(false), attempt = useRef(null), requestId = useRef(null), previews = useRef([]), successRef = useRef(null);
  useEffect(() => {
    requestId.current = crypto.randomUUID();
    try {
      const saved = JSON.parse(sessionStorage.getItem("pam-product-request-return") || "null");
      const footer = new URLSearchParams(window.location.search).get("from") === "footer";
      setFromFooter(footer);
      if (footer) setBack("/?returnToFooter=1");
      else if (saved && Date.now() - saved.at < 24 * 60 * 60 * 1000 && typeof saved.path === "string" && /^\/(?!\/)/.test(saved.path) && !saved.path.includes("\\") && !saved.path.startsWith("/request-product")) setBack(saved.path);
    } catch {}
    return () => previews.current.forEach((photo) => URL.revokeObjectURL(photo.url));
  }, []);
  useEffect(() => { if (result) { successRef.current?.focus(); successRef.current?.scrollIntoView({ behavior: "instant", block: "start" }); } }, [result]);
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  function choose(files) {
    setError("");
    const additions = Array.from(files || []);
    if (photos.length + additions.length > requestPhotoLimit) { setError("You can add up to five photos."); return; }
    if (additions.some((file) => !requestPhotoTypes.includes(file.type) || file.size > requestPhotoBytes || !file.size)) { setError("Use JPG, PNG or WebP photos, up to 5 MB each."); return; }
    const next = [...photos, ...additions.map((file) => ({ file, url: URL.createObjectURL(file), id: crypto.randomUUID() }))];
    previews.current = next; setPhotos(next);
  }
  function remove(id) {
    const photo = photos.find((item) => item.id === id); if (photo) URL.revokeObjectURL(photo.url);
    const next = photos.filter((item) => item.id !== id); previews.current = next; setPhotos(next);
  }
  async function send(event) {
    event.preventDefault(); if (inFlight.current) return;
    if (!form.phone.trim() && !form.email.trim()) { setError("Enter a phone number or email so we can reply."); return; }
    inFlight.current = true; setBusy(true); setError("");
    const current = attempt.current || { details: { ...form, requestId: requestId.current }, photos: photos.map((photo) => photo.file) };
    attempt.current = current;
    try {
      const body = new FormData(); body.set("details", JSON.stringify(current.details)); current.photos.forEach((file) => body.append("photos", file));
      const response = await fetch("/api/product-requests", { method: "POST", body }); const data = await response.json();
      if (!response.ok) { if (response.status < 500 && response.status !== 409) attempt.current = null; throw new Error(data.error || "Your request was not saved."); }
      setResult(data);
    } catch (reason) { setError(reason.message || "Your request has not been confirmed as saved. Retry the same form."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  function returnToBrowsing(event) {
    if (busy) { event.preventDefault(); return; }
    try {
      const source = JSON.parse(sessionStorage.getItem("pam-product-request-return") || "null");
      const listing = JSON.parse(sessionStorage.getItem("pam-listing-return") || "null");
      const target = new URL(back, window.location.origin);
      if (source && !source.footer && Date.now() - source.at < 24 * 60 * 60 * 1000 && listing?.path === target.pathname + target.search) sessionStorage.setItem("pam-listing-return", JSON.stringify({ ...listing, at: Date.now() }));
    } catch {}
  }
  const locked = busy || Boolean(attempt.current);
  return <div className="request-product-page store-shell"><header className="product-page-header"><a className="brand" href="/" aria-label="PAM Essentials home"><BrandLogo /></a><a href="tel:+233596661439" className="request-header-call" aria-label={`Call ${PRIMARY_PHONE_LABEL}`}><span className="request-header-phone-number">Call {PRIMARY_PHONE_LABEL}</span><span className="request-header-phone-mobile">Call us</span></a></header><main className="request-product-main"><div className="request-page-title"><div><p className="eyebrow">PAM product sourcing</p><h1>Request a Product</h1><p>Can’t find what you need? Send us a photo—we’ll help source it.</p></div><a href={back} className="request-back" aria-label={fromFooter ? "Back to footer" : "Back to browsing"} title={fromFooter ? "Back to footer" : "Back to browsing"} aria-disabled={busy} onClick={returnToBrowsing}>←</a></div>
    <div className="request-how"><span><b>1</b> Send your request</span><span><b>2</b> We check and quote</span><span><b>3</b> You decide</span></div>
    {result ? <section ref={successRef} tabIndex={-1} className="request-success panel" role="status"><span className="request-success-icon" aria-hidden="true">✓</span><h2>Request received</h2><p>{result.message}</p><div className="request-reference"><small>Your reference</small><strong>{result.reference}</strong></div><p>No order or payment has been created. We’ll discuss availability, the exact product and your quote before any purchase.</p><a className="button primary" href={back} onClick={returnToBrowsing}>Back to shopping</a></section> : <div className="request-layout"><form className="request-form" onSubmit={send}><fieldset disabled={locked}><section className="request-form-section"><h2><span>1</span> Show us what you’re looking for</h2><p>Add up to five reference photos. Optional if you can describe the product or share a link.</p><label className="request-upload"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h4l2-3h6l2 3h4v14H3ZM16 14a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" /></svg><strong>Add product photos</strong><span>Choose from your camera or photo library</span><small>JPG, PNG or WebP · 5 MB per photo</small><input type="file" multiple accept="image/jpeg,image/png,image/webp" aria-label="Add product photos" onChange={(event) => { choose(event.target.files); event.target.value = ""; }} /></label>{photos.length > 0 && <div className="request-photo-previews">{photos.map((photo, index) => <div key={photo.id}><img src={photo.url} alt={`Product reference photo ${index + 1}`} /><button type="button" aria-label={`Remove photo ${index + 1}`} onClick={() => remove(photo.id)}>×</button></div>)}</div>}</section>
    <section className="request-form-section"><h2><span>2</span> Tell us the details</h2><label>Product name<input required maxLength={160} placeholder="For example: adjustable storage rack" value={form.productName} onChange={(event) => update("productName", event.target.value)} /></label><label>Describe what you need<textarea required rows={4} maxLength={2000} placeholder="Tell us the type of product, intended use and important features." value={form.description} onChange={(event) => update("description", event.target.value)} /></label><div className="form-grid"><label>Quantity<input required type="number" min="1" max="999" value={form.quantity} onChange={(event) => update("quantity", Number(event.target.value))} /></label><label>Budget (GHS) · optional<input type="number" min="0" max="10000000" step="0.01" placeholder="Your preferred budget" value={form.budget} onChange={(event) => update("budget", event.target.value)} /></label></div><label>Colour, size or material · optional<input maxLength={500} placeholder="For example: black metal, adjustable shelves" value={form.preferences} onChange={(event) => update("preferences", event.target.value)} /></label><label>Measurements · optional<input maxLength={500} placeholder="Include units, for example: 80 × 40 × 180 cm" value={form.measurements} onChange={(event) => update("measurements", event.target.value)} /></label><div className="form-grid"><label>Product link · optional<input type="url" maxLength={1000} placeholder="https://…" value={form.productLink} onChange={(event) => update("productLink", event.target.value)} /></label><label>Preferred date · optional<input type="date" value={form.preferredDate} onChange={(event) => update("preferredDate", event.target.value)} /></label></div><label className="request-check"><input type="checkbox" checked={form.allowAlternatives} onChange={(event) => update("allowAlternatives", event.target.checked)} /><span>I’m open to similar alternatives. Please discuss them with me first.</span></label></section>
    <section className="request-form-section"><h2><span>3</span> How can we reach you?</h2><label>Your name<input required autoComplete="name" maxLength={120} value={form.name} onChange={(event) => update("name", event.target.value)} /></label><div className="form-grid"><label>Phone / WhatsApp number<input type="tel" autoComplete="tel" maxLength={25} value={form.phone} onChange={(event) => update("phone", event.target.value)} /></label><label>Email<input type="email" autoComplete="email" maxLength={254} value={form.email} onChange={(event) => update("email", event.target.value)} /></label></div><small>Provide a phone number or email so we can reply. No account is required.</small><label className="request-check"><input type="checkbox" required checked={form.acknowledged} onChange={(event) => update("acknowledged", event.target.checked)} /><span>I understand this is a request for a quote, not an order or payment.</span></label><label className="inquiry-honeypot" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => update("website", event.target.value)} /></label><p className="request-privacy">Your photos and contact details are used to review and respond to this request. Photos are private and aren’t added to the public catalogue.</p></section></fieldset>{error && <p className="notice error-notice" role="alert">{error}</p>}{attempt.current && !busy && <p>Retry sends the same request safely. Reload this page if you want to start a different request.</p>}<button type="submit" className="button primary full request-submit" disabled={busy}>{busy ? "Sending your request…" : attempt.current ? "Retry request" : "Send product request"}</button></form>
    <aside className="request-help"><div className="request-help-card"><p className="eyebrow">Thoughtfully sourced for you</p><h2>Send it. We’ll look into it.</h2><ul><li>Photos and details help us find a suitable match.</li><li>We check availability and prepare a quote in GHS.</li><li>We explain costs and estimated arrival before you decide.</li><li>No purchase happens without your agreement.</li></ul><p className="request-help-note">Your preferred date is a request, not a delivery promise.</p></div><div className="request-contact-card"><h3>Prefer to speak to us?</h3><a href={`https://wa.me/${PRIMARY_WHATSAPP}`} className="button whatsapp" target="_blank" rel="noreferrer"><WhatsAppIcon size={20} /> WhatsApp our team</a><a href="tel:+233596661439">Call {PRIMARY_PHONE_LABEL}</a></div></aside></div>}
  </main></div>;
}
