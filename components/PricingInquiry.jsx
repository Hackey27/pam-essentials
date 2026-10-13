"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { PRIMARY_PHONE_LABEL, SECONDARY_PHONE_LABEL, PRIMARY_WHATSAPP } from "@/lib/shop";
import { CURRENT_SHOP_ADDRESS } from "@/lib/shopAddress.mjs";
import { requiresPricingInquiry } from "@/lib/productPricing.mjs";
import { variantDetail } from "@/lib/variantDisplay.mjs";
import { useAuth } from "@/components/AuthProvider";
import TrackingCode from "@/components/TrackingCode";
import WhatsAppIcon from "@/components/WhatsAppIcon";

function InquiryForm({ product, onClose, onBusyChange }) {
  const { user, role } = useAuth();
  const [tab, setTab] = useState("contact");
  const [form, setForm] = useState({ name: "", phone: "", email: "", quantity: 1, measurements: "", message: "", website: "" });
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [success, setSuccess] = useState(null);
  const requestId = useRef(crypto.randomUUID()), submitting = useRef(false), attempted = useRef(null);
  const panel = useRef(null), close = useRef(null);
  const update = (key, value) => { if (!attempted.current) setForm((current) => ({ ...current, [key]: value })); };
  useEffect(() => {
    const focus = document.activeElement, overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; close.current?.focus();
    const key = (event) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); if (!submitting.current) onClose(); }
      if (event.key === "Tab") {
        const items = [...panel.current.querySelectorAll("button:not(:disabled),a[href],input:not(:disabled):not([tabindex='-1']),textarea:not(:disabled),select:not(:disabled)")];
        if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); }
        else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0]?.focus(); }
      }
    };
    window.addEventListener("keydown", key, true);
    return () => { document.body.style.overflow = overflow; window.removeEventListener("keydown", key, true); focus?.focus(); };
  }, [onClose]);
  async function send(event) {
    event.preventDefault(); if (submitting.current) return;
    submitting.current = true; onBusyChange(true); setBusy(true); setError("");
    const details = attempted.current || { ...form, productId: product.id, requestId: requestId.current };
    attempted.current = details;
    try {
      const token = user && !role ? await user.getIdToken() : "";
      const response = await fetch("/api/inquiries", { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(details) });
      const data = await response.json();
      if (!response.ok) { if (response.status < 500) attempted.current = null; throw new Error(data.error || "Your inquiry was not saved."); }
      setSuccess(data);
    } catch (reason) { setError(reason.message || "Your inquiry has not been confirmed as saved. Please retry."); }
    finally { submitting.current = false; onBusyChange(false); setBusy(false); }
  }
  const whatsapp = `Hello PAM Essentials & More 👋\nI'd like a measurement-based quote for ${product.name}.\nSKU: ${product.sku || product.id}\n${variantDetail(product) ? `Selection: ${variantDetail(product)}\n` : ""}Measurements (including units):\nQuantity:\nMy question:`;
  return <div className="modal-backdrop pricing-inquiry-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}><section ref={panel} className="modal pricing-inquiry-modal" role="dialog" aria-modal="true" aria-label="Product pricing inquiry"><header className="drawer-title"><div><p className="eyebrow">PAM customer service</p><h2>Request a quote</h2></div><button ref={close} type="button" className="icon-button" onClick={onClose} disabled={busy} aria-label="Close pricing inquiry">×</button></header><div className="inquiry-product-summary"><strong>{product.name}</strong><span>SKU: {product.sku || product.id}{variantDetail(product) && ` · ${variantDetail(product)}`}</span></div><p>Pricing depends on your required size or height. Share your measurements and our team will help you choose.</p>
    <div className="inquiry-tabs" role="tablist" aria-label="Contact options"><button type="button" role="tab" id="inquiry-contact-tab" aria-controls="inquiry-contact" aria-selected={tab === "contact"} onClick={() => setTab("contact")}>Call / WhatsApp</button><button type="button" role="tab" id="inquiry-message-tab" aria-controls="inquiry-message" aria-selected={tab === "message"} onClick={() => setTab("message")}>Notes / inquiry</button></div>
    {tab === "contact" ? <div role="tabpanel" id="inquiry-contact" aria-labelledby="inquiry-contact-tab"><div className="inquiry-contact-actions"><a className="button primary" href="tel:+233596661439">Call {PRIMARY_PHONE_LABEL}</a><a className="button secondary" href="tel:+233207015198">Call {SECONDARY_PHONE_LABEL}</a><a className="button whatsapp" href={`https://wa.me/${PRIMARY_WHATSAPP}?text=${encodeURIComponent(whatsapp)}`} target="_blank" rel="noreferrer"><WhatsAppIcon size={20} /> WhatsApp us</a></div><p className="muted">{CURRENT_SHOP_ADDRESS}</p><p>Prefer to leave a message? Open Notes / inquiry. No account is required.</p></div> : <div role="tabpanel" id="inquiry-message" aria-labelledby="inquiry-message-tab">{success ? <div className="inquiry-success" role="status"><h3>Inquiry received</h3><p>{success.message}</p><p>Keep your reference: <strong>{success.reference}</strong></p><TrackingCode code={success.trackingCode} linked={success.linkedToAccount} /><p>This is a pricing inquiry. No order or payment has been created.</p><button type="button" className="button primary" onClick={onClose}>Continue shopping</button></div> : <form onSubmit={send} className="inquiry-form"><fieldset disabled={busy || Boolean(attempted.current)}><div className="form-grid"><label>Your name<input required maxLength={120} autoComplete="name" value={form.name} onChange={(event) => update("name", event.target.value)} /></label><label>Quantity<input type="number" required min="1" max="999" value={form.quantity} onChange={(event) => update("quantity", Number(event.target.value))} /></label><label>Phone / WhatsApp number<input type="tel" maxLength={25} autoComplete="tel" value={form.phone} onChange={(event) => update("phone", event.target.value)} /></label><label>Email<input type="email" maxLength={254} autoComplete="email" value={form.email} onChange={(event) => update("email", event.target.value)} /></label></div><small>Provide a phone number or email so we can reply.</small><label>Measurements (include units)<input maxLength={500} placeholder="For example: width 80 cm, depth 40 cm, height 180 cm" value={form.measurements} onChange={(event) => update("measurements", event.target.value)} /></label><label>Notes / inquiry<textarea required maxLength={2000} rows={4} placeholder="Tell us the size, height, intended use or any other details you need help with." value={form.message} onChange={(event) => update("message", event.target.value)} /></label><label className="inquiry-honeypot" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => update("website", event.target.value)} /></label></fieldset>{error && <p className="notice error-notice" role="alert">{error}</p>}{attempted.current && !busy && <p>Retry sends the same inquiry safely. Close and reopen the form if you need to change its details.</p>}<p className="muted">We use these contact details to respond to this inquiry.</p><button type="submit" className="button primary full" disabled={busy}>{busy ? "Sending inquiry…" : attempted.current ? "Retry inquiry" : "Send inquiry"}</button></form>}</div>}
  </section></div>;
}

export default function PricingInquiry() {
  const [product, setProduct] = useState(null), current = useRef(null), closing = useRef(false), busy = useRef(false);
  const pathname = usePathname();
  const close = useCallback(() => {
    if (busy.current) return;
    current.current = null; setProduct(null);
    if (window.history.state?.pamPricingInquiry) { closing.current = true; window.history.back(); }
  }, []);
  useEffect(() => {
    const open = (event) => {
      const next = event.detail?.product;
      if (!next?.id || !requiresPricingInquiry(next) || /^\/(admin|pos|login)(?:\/|$)/.test(window.location.pathname)) return;
      if (!current.current && window.innerWidth <= 767) window.history.pushState({ ...window.history.state, pamPricingInquiry: true }, "", window.location.href);
      current.current = next; setProduct(next);
    };
    const back = (event) => {
      if (!current.current && !closing.current) return;
      event.stopImmediatePropagation();
      if (busy.current) { window.history.pushState({ ...window.history.state, pamPricingInquiry: true }, "", window.location.href); return; }
      closing.current = false; current.current = null; setProduct(null);
    };
    window.addEventListener("pam-open-pricing-inquiry", open); window.addEventListener("popstate", back, true);
    return () => { window.removeEventListener("pam-open-pricing-inquiry", open); window.removeEventListener("popstate", back, true); };
  }, []);
  useEffect(() => { current.current = null; setProduct(null); }, [pathname]);
  useEffect(() => { window.dispatchEvent(new CustomEvent("pam-pricing-inquiry-ui", { detail: { open: Boolean(product) } })); }, [product]);
  return product ? createPortal(<InquiryForm key={product.id} product={product} onClose={close} onBusyChange={(value) => { busy.current = value; }} />, document.body) : null;
}
