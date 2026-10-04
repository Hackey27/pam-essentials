"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

const blank = { title: "", body: "", style: "static", actionLabel: "", actionUrl: "", sortOrder: 1, startDate: "", endDate: "", active: true, archived: false };
const localDate = (value) => value ? new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";

export default function AdminAnnouncements() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function load() {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/announcements", { headers: { authorization: `Bearer ${token}` } });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Announcements could not be loaded.");
      setItems(payload.announcements || []);
    } catch (err) { setError(err.message); }
  }
  useEffect(() => { load(); }, [user]);
  const update = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  async function save(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/announcements", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(draft) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Announcement could not be saved.");
      setDraft(null); setNotice("Announcement saved."); await load();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <section className="admin-announcements">
    <div className="panel-title"><div><h2>Storefront announcements</h2><p>Visitors see current announcements on their first visit of a browsing session. They can turn future pop-ups off.</p></div><button type="button" className="button primary" onClick={() => setDraft({ ...blank, sortOrder: items.length + 1 })}>New announcement</button></div>
    {notice && <p className="notice success-notice">{notice}</p>}{error && <p className="notice error-notice" role="alert">{error}</p>}
    <div className="summary-grid">{items.map((item) => { const now = Date.now(); const status = item.archived ? "Archived" : item.active === false ? "Inactive" : item.startDate && new Date(item.startDate).getTime() > now ? "Scheduled" : item.endDate && new Date(item.endDate).getTime() < now ? "Expired" : "Active now"; return <button type="button" className="summary-card" key={item.announcementId} onClick={() => setDraft(item)}><strong>{item.title}</strong><span>{item.body}</span><span>{item.style === "crawler" ? "Crawler" : "Static"} · Order {item.sortOrder || 0}</span><span className={status === "Active now" ? "badge success" : "badge warning"}>{status}</span></button>; })}{!items.length && <p>No announcements yet. Add one to show a first-visit pop-up.</p>}</div>
    {draft && <div className="modal-backdrop" onMouseDown={() => setDraft(null)}><form className="modal announcement-editor" onSubmit={save} onMouseDown={(event) => event.stopPropagation()}><div className="drawer-title"><h2>{draft.announcementId ? "Edit announcement" : "New announcement"}</h2><button type="button" className="icon-button" onClick={() => setDraft(null)} aria-label="Close announcement editor">×</button></div><label>Title<input required maxLength="120" value={draft.title || ""} onChange={(event) => update("title", event.target.value)} /></label><label>Message<textarea required maxLength="1200" rows="5" value={draft.body || ""} onChange={(event) => update("body", event.target.value)} /></label><div className="form-grid"><label>Presentation<select value={draft.style || "static"} onChange={(event) => update("style", event.target.value)}><option value="static">Static</option><option value="crawler">Crawler</option></select></label><label>Sort order<input type="number" min="0" step="1" value={draft.sortOrder ?? 0} onChange={(event) => update("sortOrder", Number(event.target.value))} /></label></div><div className="form-grid"><label>Start date and time<input type="datetime-local" value={localDate(draft.startDate)} onChange={(event) => update("startDate", event.target.value ? new Date(event.target.value).toISOString() : "")} /></label><label>End date and time<input type="datetime-local" value={localDate(draft.endDate)} onChange={(event) => update("endDate", event.target.value ? new Date(event.target.value).toISOString() : "")} /></label></div><div className="form-grid"><label>Action label<input maxLength="80" placeholder="Shop now" value={draft.actionLabel || ""} onChange={(event) => update("actionLabel", event.target.value)} /></label><label>Action link<input placeholder="/#catalogue or https://…" value={draft.actionUrl || ""} onChange={(event) => update("actionUrl", event.target.value)} /></label></div><div className="toggle-row"><label><input type="checkbox" checked={draft.active !== false} onChange={(event) => update("active", event.target.checked)} /> Active</label><label><input type="checkbox" checked={draft.archived === true} onChange={(event) => update("archived", event.target.checked)} /> Archived</label></div><button type="submit" className="button primary" disabled={busy}>{busy ? "Saving…" : "Save announcement"}</button></form></div>}
  </section>;
}
