"use client";
import SkeletonScreen from "./SkeletonScreen";
import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";

export default function CustomerProfile({onSaved}) {
  const [profile, setProfile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  async function request(options = {}) {
    const token = await auth.currentUser?.getIdToken();
    const response = await fetch("/api/customer/profile", { ...options, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" } });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || "Your details could not be saved."); return data.profile;
  }
  useEffect(() => {
    const controller = new AbortController(); setError("");
    request({ signal: controller.signal }).then(setProfile).catch((reason) => { if (!controller.signal.aborted) setError(reason.message); });
    return () => controller.abort();
  }, [revision]);
  async function save(event) {
    event.preventDefault(); if (busy) return; setBusy(true); setError(""); setNotice("");
    try { const saved=await request({ method: "POST", body: JSON.stringify(profile) }); setProfile(saved);onSaved?.(saved); setNotice("Your details and contact preferences have been saved."); }
    catch (reason) { setError(reason.message); } finally { setBusy(false); }
  }
  const update = (field, value) => setProfile((current) => ({ ...current, [field]: value }));
  return <section className="panel account-panel customer-profile"><h2>Your details &amp; contact preferences</h2>
    {error && <p className="notice error-notice" role="alert">{error}</p>}{notice && <p className="notice" role="status">{notice}</p>}
    {!profile ? error ? <button type="button" className="button secondary" onClick={() => setRevision((value) => value + 1)}>Retry</button> : <SkeletonScreen type="info" count={2} label="Loading contact details"/> : <form onSubmit={save}><label>Name<input autoComplete="name" maxLength={120} value={profile.name} onChange={(event) => update("name", event.target.value)} /></label><label>Phone<input type="tel" autoComplete="tel" maxLength={40} value={profile.phone} onChange={(event) => update("phone", event.target.value)} /></label><p>Email: {profile.email}</p><div className="customer-preferences"><label><input type="checkbox" checked={profile.marketingEmail} onChange={(event) => update("marketingEmail", event.target.checked)} /> I would like promotional messages from PAM by email.</label><label><input type="checkbox" checked={profile.marketingPhone} onChange={(event) => update("marketingPhone", event.target.checked)} /> I would like promotional messages from PAM by phone (SMS or WhatsApp).</label></div><button className="button primary" disabled={busy}>{busy ? "Saving…" : "Update details & preferences"}</button></form>}
  </section>;
}
