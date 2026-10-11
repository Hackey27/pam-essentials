"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { customerCsv } from "@/lib/customerDirectory.mjs";

export default function AdminCustomers({ authorizedFetch, orders = [] }) {
  const fetchRef = useRef(authorizedFetch); fetchRef.current = authorizedFetch;
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [audience, setAudience] = useState("all");
  const [updatedAt, setUpdatedAt] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true); setError(""); setNotice("");
      try {
        let next = ""; const all = new Map(); const seen = new Set(); let updated = "";
        do {
          const response = await fetchRef.current(`/api/admin/customers${next ? `?pageToken=${encodeURIComponent(next)}` : ""}`, { signal: controller.signal });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Customer data could not be loaded.");
          for (const customer of data.customers || []) all.set(customer.uid, customer);
          next = data.nextPageToken || ""; updated = data.updatedAt;
          if (next && seen.has(next)) throw new Error("Account pagination failed. Refresh to retry.");
          seen.add(next);
        } while (next);
        if (!controller.signal.aborted) { setCustomers([...all.values()]); setUpdatedAt(updated); }
      } catch (reason) { if (!controller.signal.aborted) setError(reason.message); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    load(); return () => controller.abort();
  }, [revision]);
  const visible = useMemo(() => {
    const latest = new Map();
    for (const order of [...orders].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))) if (order.customerUid && !latest.has(order.customerUid)) latest.set(order.customerUid, order);
    return customers.map((customer) => { const order = latest.get(customer.uid); return { ...customer, name: customer.name || order?.customer || "", phone: customer.phone || order?.phone || "" }; })
      .filter((c) => (!query || [c.name, c.email, c.phone].some((value) => String(value).toLowerCase().includes(query.toLowerCase().trim()))) && (audience === "all" || !c.disabled && (audience === "email" ? c.marketingEmail && c.email : c.marketingPhone && c.phone)))
      .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
  }, [customers, orders, query, audience]);
  const contacts = (kind) => [...new Set(visible.filter((c) => !c.disabled && c[kind] && (kind === "email" ? c.marketingEmail : c.marketingPhone)).map((c) => c[kind]))];
  async function copy(kind) {
    try { const values = contacts(kind); await navigator.clipboard.writeText(values.join(kind === "email" ? "; " : "\n")); setNotice(`${values.length} opted-in ${kind === "email" ? "email addresses" : "phone numbers"} copied.`); }
    catch { setNotice("Copy was unavailable in this browser. Download the CSV instead."); }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([customerCsv(visible)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `pam-customers-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(`${visible.length} customer records downloaded.`);
  }
  const ready = !loading && !error;
  return <section className="panel customer-directory"><div className="panel-title"><div><h2>Customer accounts</h2><p>Registered customers, including accounts without orders or wishlists. Staff accounts are excluded.</p></div><button type="button" className="button secondary" disabled={loading} onClick={() => setRevision((value) => value + 1)}>Refresh</button></div>
    <p className="muted">Copy buttons include active customers who opted in to that contact method. CSV downloads include the selected records and their preferences. Missing names or phones use the customer’s latest linked order where available.</p>
    <div className="table-tools"><input aria-label="Search customers" placeholder="Search name, email or phone" value={query} onChange={(event) => setQuery(event.target.value)} /><select aria-label="Customer contact audience" value={audience} onChange={(event) => setAudience(event.target.value)}><option value="all">All customer accounts</option><option value="email">Opted in to email promotions</option><option value="phone">Opted in to phone promotions</option></select><span>{visible.length} customers</span></div>
    <div className="customer-export-actions"><button type="button" className="button primary" disabled={!ready || !visible.length} onClick={download}>Download CSV</button><button type="button" className="button secondary" disabled={!ready || !contacts("email").length} onClick={() => copy("email")}>Copy promotional emails</button><button type="button" className="button secondary" disabled={!ready || !contacts("phone").length} onClick={() => copy("phone")}>Copy promotional phone numbers</button></div>
    {notice && <p className="notice" role="status">{notice}</p>}{error && <p className="notice error-notice" role="alert">{error}</p>}
    {loading ? <p role="status">Loading customer accounts…</p> : <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Promotional preferences</th><th>Wishlist</th><th>Joined / last sign-in</th><th>Status</th></tr></thead><tbody>{visible.map((c) => <tr key={c.uid}><td>{c.name || "Not provided"}</td><td>{c.email || "Not provided"}<span>{c.emailVerified ? "Email verified" : "Email not verified"}</span></td><td>{c.phone || "Not provided"}</td><td><span>Email: {c.marketingEmail ? "Opted in" : "Not opted in"}</span><span>Phone: {c.marketingPhone ? "Opted in" : "Not opted in"}</span></td><td>{c.wishlistCount}</td><td>{c.createdAt ? new Date(c.createdAt).toLocaleDateString("en-GH") : "—"}<span>{c.lastSignInAt ? new Date(c.lastSignInAt).toLocaleString("en-GH") : "No sign-in recorded"}</span></td><td><span className={`badge ${c.disabled ? "danger" : "success"}`}>{c.disabled ? "Disabled" : "Active"}</span></td></tr>)}{!visible.length && <tr><td colSpan="7" className="empty-cell">No customer accounts match these filters.</td></tr>}</tbody></table></div>}
    {updatedAt && <p className="muted">Last refreshed: {new Date(updatedAt).toLocaleString("en-GH")}</p>}
  </section>;
}
