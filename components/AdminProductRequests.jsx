"use client";

import { useEffect, useRef, useState } from "react";
import { productRequestStatuses } from "@/lib/productRequests.mjs";
import TrackingCode from "@/components/TrackingCode";
import WhatsAppIcon from "@/components/WhatsAppIcon";

const money = new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" });
const date = (value) => value ? new Date(value).toLocaleString("en-GH", { dateStyle: "medium", timeStyle: "short" }) : "—";
const label = (value) => ({ new: "New", "checking-availability": "Checking availability", quoted: "Quoted", closed: "Closed" })[value] || value;
function PrivatePhotos({ record, authorizedFetch }) {
  const [urls, setUrls] = useState([]), [error, setError] = useState("");
  useEffect(() => {
    let active = true; const loaded = [];
    async function load() {
      try {
        for (let index = 0; index < record.imageCount; index++) {
          const response = await authorizedFetch(`/api/admin/product-requests?request=${record.id}&image=${index}`);
          if (!response.ok) throw new Error("A private photo could not be loaded. Reopen this request to retry.");
          const blob = await response.blob(); if (!active) return;
          loaded.push(URL.createObjectURL(blob)); setUrls([...loaded]);
        }
      } catch (reason) { if (active) setError(reason.message); }
    }
    load(); return () => { active = false; loaded.forEach((url) => URL.revokeObjectURL(url)); };
  }, [record.id]);
  return <div>{error && <p className="notice error-notice" role="alert">{error}</p>}{record.imageCount > urls.length && !error && <p role="status">Loading private photos…</p>}<div className="request-admin-photos">{urls.map((url, index) => <a href={url} target="_blank" rel="noreferrer" key={url} aria-label={`Open reference photo ${index + 1}`}><img src={url} alt={`Private reference photo ${index + 1}`} /></a>)}</div>{!record.imageCount && <p>No photos submitted.</p>}</div>;
}
function RequestDetails({ record, authorizedFetch, onSaved, onClose }) {
  const [values, setValues] = useState({ status: record.status, internalNotes: record.internalNotes, quotation: record.quotation, quoteTotal: record.quoteTotal ?? "" });
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const lock = useRef(false), panel = useRef(null);
  const update = (key, value) => setValues((current) => ({ ...current, [key]: value }));
  useEffect(() => {
    const before = document.activeElement, overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; panel.current?.querySelector("button")?.focus();
    const key = (event) => { if (event.key === "Escape" && !lock.current) onClose(); if (event.key === "Tab") { const items = [...panel.current.querySelectorAll("button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled)")]; if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); } else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0]?.focus(); } } };
    window.addEventListener("keydown", key); return () => { document.body.style.overflow = overflow; window.removeEventListener("keydown", key); before?.focus(); };
  }, []);
  async function save(event) {
    event.preventDefault(); if (lock.current) return; lock.current = true; setBusy(true); setError("");
    try { const response = await authorizedFetch("/api/admin/product-requests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: record.id, ...values }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); onSaved({ ...record, ...values, quoteTotal: values.quoteTotal === "" ? null : Number(values.quoteTotal), updatedAt: new Date().toISOString() }); }
    catch (reason) { setError(reason.message || "Request update failed."); }
    finally { lock.current = false; setBusy(false); }
  }
  const quoteText = `Hello ${record.name},\n\nYour PAM product request: ${record.reference}\nProduct: ${record.productName}\nQuantity: ${record.quantity}\n\n${record.quotation}\nTotal quote: ${money.format(record.quoteTotal || 0)}\n\nPlease confirm the specifications and ask any questions before accepting. No purchase has been made.`;
  const phone = record.phone.replace(/[^+\d]/g, ""), whatsappPhone = phone.replace(/^0(?=\d{9}$)/, "233").replace(/\D/g, "");
  const quoted = record.quoteTotal > 0 && record.quotation;
  return <div className="modal-backdrop"><section ref={panel} className="modal product-request-detail" role="dialog" aria-modal="true" aria-label="Product request details"><header className="drawer-title"><div><p className="eyebrow">Product sourcing</p><h2>{record.reference}</h2></div><button type="button" className="icon-button" disabled={busy} onClick={onClose} aria-label="Close product request">×</button></header><h3>{record.productName}</h3><PrivatePhotos record={record} authorizedFetch={authorizedFetch} /><dl className="inquiry-details"><dt>Received</dt><dd>{date(record.createdAt)}</dd><dt>Customer</dt><dd>{record.name}<br />{record.phone}<br />{record.email}</dd><dt>Requirements</dt><dd className="inquiry-message-text">{record.description}</dd><dt>Quantity</dt><dd>{record.quantity}</dd><dt>Preferences</dt><dd>{record.preferences || "Not specified"}</dd><dt>Measurements</dt><dd>{record.measurements || "Not specified"}</dd><dt>Budget</dt><dd>{record.budget == null ? "Not provided" : money.format(record.budget)}</dd><dt>Preferred date</dt><dd>{record.preferredDate || "Not specified"} · availability to be confirmed</dd><dt>Alternatives</dt><dd>{record.allowAlternatives ? "Open to alternatives; discuss first" : "Discuss any change before quoting"}</dd>{record.productLink && <><dt>Reference link</dt><dd><a href={record.productLink} target="_blank" rel="noreferrer">Open supplied product link ↗</a></dd></>}</dl><div className="inquiry-contact-actions">{phone && <a className="button secondary" href={`tel:${phone}`}>Call customer</a>}{whatsappPhone && <a className="button whatsapp" href={`https://wa.me/${whatsappPhone}?text=${encodeURIComponent(quoted ? quoteText : `Hello ${record.name}, regarding your PAM product request ${record.reference} for ${record.productName}:`)}`} target="_blank" rel="noreferrer"><WhatsAppIcon size={18} /> {quoted ? "Open quote in WhatsApp" : "WhatsApp customer"}</a>}{record.email && <a className="button secondary" href={`mailto:${record.email}?subject=${encodeURIComponent(`PAM product request ${record.reference}`)}&body=${encodeURIComponent(quoted ? quoteText : "")}`}>Email customer</a>}{quoted && <button type="button" className="button secondary" onClick={async () => { try { await navigator.clipboard.writeText(quoteText); setNotice("Saved quote copied."); } catch { setError("Copy failed. Use the contact buttons instead."); } }}>Copy saved quote</button>}</div><p>Contact buttons open your messaging app. Saving a quote does not send a message, create an order or collect payment.</p><TrackingCode code={record.id} linked={Boolean(record.customerUid)} admin /><form onSubmit={save}><fieldset disabled={busy}><div className="form-grid"><label>Status<select value={values.status} onChange={(event) => update("status", event.target.value)}>{productRequestStatuses.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label><label>Total quote (GHS)<input type="number" min="0.01" step="0.01" max="10000000" value={values.quoteTotal} onChange={(event) => update("quoteTotal", event.target.value)} /></label></div><label>Quotation for the customer<textarea rows={5} maxLength={3000} placeholder="Proposed product and exact specifications; included charges; estimated arrival; quote expiry; any payment and cancellation terms to discuss." value={values.quotation} onChange={(event) => update("quotation", event.target.value)} /></label><label>Internal notes · Admin only<textarea rows={3} maxLength={3000} placeholder="Supplier details, private costs and follow-up notes" value={values.internalNotes} onChange={(event) => update("internalNotes", event.target.value)} /></label></fieldset>{error && <p className="notice error-notice" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}<button className="button primary" disabled={busy}>{busy ? "Saving…" : "Save request / quote"}</button></form></section></div>;
}
export default function AdminProductRequests({ authorizedFetch, initialRecord = null, onChanged }) {
  const [records, setRecords] = useState([]), [cursor, setCursor] = useState(null), [updated, setUpdated] = useState("");
  const [loading, setLoading] = useState(true), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [query, setQuery] = useState(""), [status, setStatus] = useState("all"), [selected, setSelected] = useState(null);
  const live = useRef(true), fetching = useRef(false);
  const focusRecord = useRef(initialRecord);
  async function load(append = false) {
    if (fetching.current) return; fetching.current = true; setLoading(true); setError("");
    try { const response = await authorizedFetch(`/api/admin/product-requests${focusRecord.current ? `?id=${encodeURIComponent(focusRecord.current.id)}` : append && cursor ? `?cursor=${cursor}` : ""}`); const data = await response.json(); if (!response.ok) throw new Error(data.error); if (!live.current) return; setRecords((current) => append ? [...current, ...data.requests.filter((item) => !current.some((record) => record.id === item.id))] : data.requests); if (focusRecord.current) { setSelected(data.requests[0] || null); focusRecord.current = null; } setCursor(data.nextCursor); setUpdated(data.updatedAt); }
    catch (reason) { if (live.current) setError(reason.message || "Requests could not be loaded."); }
    finally { fetching.current = false; if (live.current) setLoading(false); }
  }
  useEffect(() => { live.current = true; load(); return () => { live.current = false; }; }, []);
  const shown = records.filter((record) => (status === "all" || status === record.status) && [record.reference, record.name, record.phone, record.email, record.productName, record.description].some((value) => String(value || "").toLowerCase().includes(query.toLowerCase())));
  return <section><div className="panel-title"><div><h2>Product sourcing requests</h2><p>Review requirements, private reference photos and manually prepared GHS quotes.</p></div><button type="button" className="button secondary" disabled={loading} onClick={() => load()}>Refresh requests</button></div><div className="inquiry-admin-filters"><label>Search requests<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Reference, customer or product" /></label><label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option>{productRequestStatuses.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label></div>{updated && <p className="muted">Last loaded {date(updated)}{cursor && " · Load older requests to search earlier records."}</p>}{loading && <p role="status">Loading requests…</p>}{error && <p className="notice error-notice" role="alert">{error}</p>}{notice && <p className="notice success-notice" role="status">{notice}</p>}<div className="data-table-wrap"><table className="data-table"><thead><tr><th>Reference / received</th><th>Customer</th><th>Product / quantity</th><th>Photos</th><th>Status / quote</th><th>Action</th></tr></thead><tbody>{shown.map((record) => <tr key={record.id}><td><b>{record.reference}</b><span>{date(record.createdAt)}</span></td><td><b>{record.name}</b><span>{record.phone || record.email}</span></td><td><b>{record.productName}</b><span>Qty: {record.quantity}</span></td><td>{record.imageCount}</td><td><span className={record.status === "closed" ? "badge neutral" : "badge warning"}>{label(record.status)}</span>{record.quoteTotal != null && <p>{money.format(record.quoteTotal)}</p>}</td><td><button type="button" className="table-action" onClick={() => setSelected(record)}>Open request</button></td></tr>)}{!shown.length && !loading && !error && <tr><td colSpan={6} className="empty-cell">{records.length ? "No requests match these filters." : "No product requests received yet."}</td></tr>}</tbody></table></div>{cursor && <button type="button" className="button secondary" disabled={loading} onClick={() => load(true)}>Load older requests</button>}{selected && <RequestDetails key={selected.id} record={selected} authorizedFetch={authorizedFetch} onClose={() => setSelected(null)} onSaved={(record) => { setRecords((current) => current.map((item) => item.id === record.id ? record : item)); setSelected(null); setNotice("Request updated. The change is recorded in Audit."); onChanged?.(); }} />}</section>;
}
