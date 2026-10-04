"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { getHeroImageUrl } from "@/lib/heroImages.mjs";
import { galleryKey, heroImageList } from "@/lib/heroGallery.mjs";

const formats = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"], ["image/avif", "avif"]]);
const slots = [{ id: "web", label: "Website hero", hint: "Recommended 1920 × 720 px" }, { id: "mobile", label: "Mobile hero", hint: "Recommended 1080 × 1350 px" }];

export default function AdminHeroGallery({ settings, onSave, saving }) {
  const [drafts, setDrafts] = useState({ web: [], mobile: [] });
  const [uploading, setUploading] = useState("");
  const [percent, setPercent] = useState(null);
  const [message, setMessage] = useState("");
  useEffect(() => { setDrafts({ web: heroImageList(settings, "web"), mobile: heroImageList(settings, "mobile") }); }, [settings]);
  const update = (slot, index, field, value) => setDrafts((current) => ({ ...current, [slot]: current[slot].map((image, position) => position === index ? { ...image, [field]: value } : image) }));
  async function save(slot, list = drafts[slot]) {
    setMessage("");
    const result = await onSave({ key: galleryKey(slot), value: list, description: `Ordered ${slot} hero images` }, `${slot === "web" ? "Website" : "Mobile"} hero images updated.`);
    if (!result) setMessage("Hero image order could not be saved.");
    else setMessage("Hero images saved. Active images rotate in the assigned order.");
  }
  async function upload(file, slot) {
    if (!file || uploading || saving) return;
    if (!auth.currentUser) { setMessage("Sign in as an Owner or Admin to upload hero images."); return; }
    if (!formats.has(file.type) || !/\.(jpe?g|png|webp|avif)$/i.test(file.name) || !file.size || file.size > 20 * 1024 * 1024) { setMessage("Choose a JPG, PNG, WebP or AVIF image under 20 MB."); return; }
    if (drafts[slot].length >= 12) { setMessage("Each screen size supports up to 12 hero images."); return; }
    const safeName = file.name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").slice(0, 55) || "image";
    const path = `hero/${slot}/${Date.now()}-${crypto.randomUUID()}-${safeName}.${formats.get(file.type)}`;
    setUploading(slot); setPercent(null); setMessage("");
    try {
      const token = await auth.currentUser.getIdToken();
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/admin/hero-images");
        xhr.setRequestHeader("authorization", `Bearer ${token}`);
        xhr.setRequestHeader("content-type", file.type);
        xhr.setRequestHeader("x-hero-slot", slot);
        xhr.setRequestHeader("x-image-path", path);
        xhr.timeout = 120000;
        xhr.upload.onprogress = (event) => setPercent(event.lengthComputable ? Math.round(event.loaded / event.total * 100) : null);
        xhr.onload = () => { let body = {}; try { body = JSON.parse(xhr.responseText || "{}"); } catch {} xhr.status >= 200 && xhr.status < 300 ? resolve(body) : reject(new Error(body.error || `Upload failed (${xhr.status}).`)); };
        xhr.onerror = () => reject(new Error("Upload connection failed."));
        xhr.ontimeout = () => reject(new Error("Upload timed out."));
        xhr.send(file);
      });
      const next = [...drafts[slot], { path, sortOrder: Math.max(0, ...drafts[slot].map((image) => Number(image.sortOrder || 0))) + 1, active: true }];
      setDrafts((current) => ({ ...current, [slot]: next }));
      await save(slot, next);
    } catch (error) { setMessage(error.message || "Hero image upload failed."); }
    finally { setUploading(""); setPercent(null); }
  }
  return <section className="panel admin-hero-settings"><h2>Hero background images</h2><p>Upload several images for each screen size. Active images rotate in sort order. The existing single-image assignment remains the fallback until a gallery is saved.</p><div className="admin-hero-grid">{slots.map((slot) => <div className="admin-hero-slot" key={slot.id}><h3>{slot.label}</h3><p>{slot.hint}</p><div className="admin-hero-gallery">{drafts[slot.id].map((image, index) => <div className="admin-hero-gallery-item" key={image.path}><img src={getHeroImageUrl(image.path, 480)} alt={`${slot.label} image ${index + 1}`} /><label>Sort order<input type="number" min="0" step="1" value={image.sortOrder} onChange={(event) => update(slot.id, index, "sortOrder", Number(event.target.value))} /></label><label><input type="checkbox" checked={image.active} onChange={(event) => update(slot.id, index, "active", event.target.checked)} /> Active</label><button type="button" className="table-action" disabled={Boolean(uploading) || saving} onClick={() => save(slot.id, drafts[slot.id].filter((entry) => entry.path !== image.path))}>Remove assignment</button></div>)}{!drafts[slot.id].length && <div className="admin-hero-placeholder">No image assigned · existing hero design is shown</div>}</div><div className="admin-hero-actions"><label className="admin-upload-label">Add image<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={Boolean(uploading) || saving} onChange={(event) => { upload(event.target.files?.[0], slot.id); event.target.value = ""; }} /></label><button type="button" className="button secondary" disabled={Boolean(uploading) || saving} onClick={() => save(slot.id)}>Save order and visibility</button></div>{uploading === slot.id && <p role="status">Uploading {percent == null ? "…" : `${percent}%`}<progress value={percent ?? undefined} max="100" /></p>}</div>)}</div>{message && <p role="status" className="admin-image-message">{message}</p>}</section>;
}
