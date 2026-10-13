"use client";

import { useEffect, useRef, useState } from "react";
import { inquiryStatuses } from "@/lib/inquiries.mjs";
import WhatsAppIcon from "@/components/WhatsAppIcon";
import { variantDetail } from "@/lib/variantDisplay.mjs";

const date = (value) => value ? new Date(value).toLocaleString("en-GH", { dateStyle: "medium", timeStyle: "short" }) : "—";
const label = (status) => status === "in-progress" ? "In progress" : status === "resolved" ? "Resolved" : "New";
function InquiryDetails({ inquiry, authorizedFetch, onSaved, onClose }) {
  const [status, setStatus] = useState(inquiry.status), [notes, setNotes] = useState(inquiry.internalNotes);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const saving = useRef(false), panel = useRef(null);
  const phone = inquiry.phone.replace(/[^+\d]/g, "");
  const whatsappPhone = phone.replace(/^0(?=\d{9}$)/, "233").replace(/\D/g, "");
  async function save(event) {
    event.preventDefault(); if (saving.current) return;
    saving.current = true; setBusy(true); setError("");
    try {
      const response = await authorizedFetch("/api/admin/inquiries", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: inquiry.id, status, internalNotes: notes }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      onSaved({ ...inquiry, status, internalNotes: notes, updatedAt: new Date().toISOString() });
    } catch (reason) { setError(reason.message || "Inquiry update was not confirmed."); }
    finally { saving.current = false; setBusy(false); }
  }
  useEffect(() => {
    const prior = document.activeElement, overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; panel.current?.querySelector("button")?.focus();
    const key = (event) => {
      if (event.key === "Escape" && !saving.current) onClose();
      if (event.key === "Tab") {
        const items = [...panel.current.querySelectorAll("button:not(:disabled),a[href],select:not(:disabled),textarea:not(:disabled)")];
        if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); }
        else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0]?.focus(); }
      }
    };
    window.addEventListener("keydown", key);
    return () => { document.body.style.overflow = overflow; window.removeEventListener("keydown", key); prior?.focus(); };
  }, []);
  return <div className="modal-backdrop"><section ref={panel} className="modal admin-inquiry-detail" role="dialog" aria-modal="true" aria-label="Inquiry details"><header className="drawer-title"><h2>{inquiry.reference}</h2><button type="button" className="icon-button" disabled={busy} onClick={onClose} aria-label="Close inquiry details">×</button></header><dl className="inquiry-details"><dt>Received</dt><dd>{date(inquiry.createdAt)}</dd><dt>Customer</dt><dd>{inquiry.name}</dd><dt>Contact</dt><dd>{inquiry.phone || "No phone provided"}<br />{inquiry.email || "No email provided"}</dd><dt>Product / SKU</dt><dd>{inquiry.productName}<br />{inquiry.sku}{variantDetail(inquiry) && <><br />{variantDetail(inquiry)}</>}</dd><dt>Quantity</dt><dd>{inquiry.quantity}</dd><dt>Measurements</dt><dd>{inquiry.measurements || "Not provided"}</dd><dt>Inquiry</dt><dd className="inquiry-message-text">{inquiry.message}</dd><dt>Last updated</dt><dd>{date(inquiry.updatedAt)}{inquiry.updatedBy && ` · ${inquiry.updatedBy}`}</dd></dl><div className="inquiry-contact-actions">{phone && <><a className="button secondary" href={`tel:${phone}`}>Call customer</a><a className="button whatsapp" href={`https://wa.me/${whatsappPhone}?text=${encodeURIComponent(`Hello ${inquiry.name}, regarding your PAM pricing inquiry ${inquiry.reference} for ${inquiry.productName}:`)}`} target="_blank" rel="noreferrer"><WhatsAppIcon size={18} /> WhatsApp customer</a></>}{inquiry.email && <a className="button secondary" href={`mailto:${inquiry.email}?subject=${encodeURIComponent(`PAM pricing inquiry ${inquiry.reference}`)}`}>Email customer</a>}</div><p>Contact buttons open your calling or messaging app. Messages are sent when you choose to send them there.</p><form onSubmit={save}><label>Status<select value={status} disabled={busy} onChange={(event) => setStatus(event.target.value)}>{inquiryStatuses.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label><label>Internal staff notes<textarea rows={4} maxLength={2000} value={notes} disabled={busy} onChange={(event) => setNotes(event.target.value)} /></label><small>Internal notes are only available in Admin. Updating status does not send a customer message.</small>{error && <p className="notice error-notice" role="alert">{error}</p>}<button className="button primary" disabled={busy}>{busy ? "Saving…" : "Save inquiry update"}</button></form></section></div>;
}
export default function AdminInquiries({ authorizedFetch, initialRecord = null, onChanged }) {
  const [records, setRecords] = useState([]), [cursor, setCursor] = useState(null), [updated, setUpdated] = useState("");
  const [loading, setLoading] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [query, setQuery] = useState(""), [status, setStatus] = useState("all"), [selected, setSelected] = useState(null);
  const live = useRef(true), fetching = useRef(false);
  const focusRecord = useRef(initialRecord);
  async function load(append = false) {
    if (fetching.current) return; fetching.current = true; setLoading(true); setError("");
    try {
      const response = await authorizedFetch(`/api/admin/inquiries${focusRecord.current ? `?id=${encodeURIComponent(focusRecord.current.id)}` : append && cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      if (!live.current) return;
      setRecords((current) => append ? [...current, ...data.inquiries.filter((item) => !current.some((row) => row.id === item.id))] : data.inquiries); if (focusRecord.current) { setSelected(data.inquiries[0] || null); focusRecord.current = null; } setCursor(data.nextCursor); setUpdated(data.updatedAt);
    } catch (reason) { if (live.current) setError(reason.message || "Inquiries could not be loaded."); }
    finally { fetching.current = false; if (live.current) setLoading(false); }
  }
  useEffect(() => { live.current = true; load(); return () => { live.current = false; }; }, []);
  const shown = records.filter((item) => (status === "all" || item.status === status) && [item.reference, item.name, item.phone, item.email, item.productName, item.sku, item.measurements, item.message].some((value) => String(value || "").toLowerCase().includes(query.toLowerCase())));
  return <section className="admin-inquiries"><div className="panel-title"><div><h2>Customer inquiries</h2><p>Measurement-based pricing requests · {records.filter((item) => item.status === "new").length} new in loaded records</p></div><button type="button" className="button secondary" disabled={loading} onClick={() => load()}>Refresh inquiries</button></div><div className="inquiry-admin-filters"><label>Search inquiries<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Reference, customer, product or SKU" /></label><label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option>{inquiryStatuses.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label></div>{updated && <p className="muted">Last loaded {date(updated)}{cursor && " · Load older inquiries to search earlier records."}</p>}{loading && <p role="status">Loading inquiries…</p>}{error && <p className="notice error-notice" role="alert">{error}</p>}{notice && <p className="notice success-notice" role="status">{notice}</p>}<div className="data-table-wrap"><table className="data-table"><thead><tr><th>Reference / received</th><th>Customer / contact</th><th>Product / measurements</th><th>Status</th><th>Action</th></tr></thead><tbody>{shown.map((item) => <tr key={item.id}><td><b>{item.reference}</b><span>{date(item.createdAt)}</span></td><td><b>{item.name}</b><span>{item.phone || item.email}</span></td><td><b>{item.productName}</b><span>{item.quantity} requested · {item.measurements || "Measurements not provided"}</span></td><td><span className={item.status === "resolved" ? "badge success" : "badge warning"}>{label(item.status)}</span></td><td><button type="button" className="table-action" onClick={() => { setSelected(item); setNotice(""); }}>Open inquiry</button></td></tr>)}{!shown.length && !loading && !error && <tr><td colSpan={5} className="empty-cell">{records.length ? "No inquiries match these filters." : "No inquiries received yet."}</td></tr>}</tbody></table></div>{cursor && <button type="button" className="button secondary" disabled={loading} onClick={() => load(true)}>Load older inquiries</button>}{selected && <InquiryDetails key={selected.id} inquiry={selected} authorizedFetch={authorizedFetch} onClose={() => setSelected(null)} onSaved={(item) => { setRecords((current) => current.map((row) => row.id === item.id ? item : row)); setSelected(null); setNotice("Inquiry updated. The change is recorded in Audit."); onChanged?.(); }} />}</section>;
}
