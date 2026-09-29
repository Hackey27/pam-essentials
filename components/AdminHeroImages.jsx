"use client";

import { useEffect, useRef, useState } from "react";
import { auth } from "@/lib/firebase";
import { getHeroImageUrl, isHeroImagePath } from "@/lib/heroImages.mjs";

const formats = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"], ["image/avif", "avif"]]);
const slots = [
  { id: "web", key: "HERO_WEB_IMAGE_PATH", label: "Web hero background image", dimensions: "Recommended: 1920 × 720 px · safe minimum: 1600 × 600 px · wide banner" },
  { id: "mobile", key: "HERO_MOBILE_IMAGE_PATH", label: "Mobile hero background image", dimensions: "Recommended: 1080 × 1350 px · safe minimum: 900 × 1125 px · portrait 4:5" },
];

export default function AdminHeroImages({ settings, onSave, saving }) {
  const [uploading, setUploading] = useState("");
  const [percent, setPercent] = useState(null);
  const [message, setMessage] = useState("");
  const [previews, setPreviews] = useState({});
  const previewUrls = useRef([]);
  useEffect(() => () => previewUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);

  async function upload(file, slot) {
    if (!file) return;
    if (!auth.currentUser) { setMessage("Sign in as an Owner or Admin to upload hero images."); return; }
    if (!formats.has(file.type) || !/\.(jpe?g|png|webp|avif)$/i.test(file.name)) { setMessage("Choose a JPG, PNG, WebP or AVIF image."); return; }
    if (!file.size || file.size > 20 * 1024 * 1024) { setMessage("Images must be smaller than 20 MB."); return; }
    if (uploading || saving) return;
    const safeName = file.name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").slice(0, 55) || "image";
    const path = `hero/${slot}/${Date.now()}-${crypto.randomUUID()}-${safeName}.${formats.get(file.type)}`;
    setMessage(""); setUploading(slot); setPercent(null);
    try {
      const token = await auth.currentUser.getIdToken();
      const result = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/admin/hero-images");
        xhr.setRequestHeader("authorization", `Bearer ${token}`);
        xhr.setRequestHeader("content-type", file.type);
        xhr.setRequestHeader("x-hero-slot", slot);
        xhr.setRequestHeader("x-image-path", path);
        xhr.timeout = 120000;
        xhr.upload.onprogress = (event) => setPercent(event.lengthComputable ? Math.round(event.loaded / event.total * 100) : null);
        xhr.onload = () => { let body = {}; try { body = JSON.parse(xhr.responseText || "{}"); } catch {} if (xhr.status >= 200 && xhr.status < 300) resolve(body); else reject(new Error(body.error || `Upload failed (${xhr.status}).`)); };
        xhr.onerror = () => reject(new Error("The upload connection failed. Try again."));
        xhr.ontimeout = () => reject(new Error("Upload timed out. Check the connection and try again."));
        xhr.send(file);
      });
      const preview = URL.createObjectURL(file);
      previewUrls.current.push(preview);
      setPreviews((current) => ({ ...current, [slot]: { path: result.path, url: preview } }));
      const config = slots.find((item) => item.id === slot);
      const saved = await onSave({ key: config.key, value: result.path, description: config.label }, `${config.label} updated.`);
      if (!saved) throw new Error("Image uploaded, but its setting could not be saved. Please retry the assignment.");
      setMessage(`${config.label} uploaded and saved (${result.width} × ${result.height}px).`);
    } catch (error) { setMessage(error.message || "Hero image upload failed."); }
    finally { setUploading(""); setPercent(null); }
  }

  async function remove(config) {
    if (uploading || saving) return;
    setMessage("");
    const saved = await onSave({ key: config.key, value: "", description: config.label }, `${config.label} removed.`);
    if (saved) { setPreviews((current) => ({ ...current, [config.id]: null })); setMessage(`${config.label} removed. The existing hero design is the fallback.`); }
    else setMessage("The hero image assignment could not be removed.");
  }

  return <section className="panel admin-hero-settings"><h2>Hero background images</h2><p>Upload separate storefront backgrounds for wide and narrow screens. JPG, PNG, WebP or AVIF; maximum 20 MB.</p><div className="admin-hero-grid">{slots.map((config) => {
    const path = settings[config.key]?.value || "";
    const preview = previews[config.id]?.path === path ? previews[config.id].url : isHeroImagePath(path, config.id) ? getHeroImageUrl(path, 700) : "";
    return <div className="admin-hero-slot" key={config.id}><h3>{config.label}</h3><p>{config.dimensions}</p>{preview ? <img src={preview} alt={`Current ${config.id} hero background`} /> : <div className="admin-hero-placeholder">No image assigned · existing hero design is shown</div>}<div className="admin-hero-actions"><label className="admin-upload-label">{path ? "Replace image" : "Upload image"}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={Boolean(uploading) || saving} onChange={(event) => { upload(event.target.files?.[0], config.id); event.target.value = ""; }} /></label>{path && <button type="button" className="table-action" disabled={Boolean(uploading) || saving} onClick={() => remove(config)}>Remove image</button>}</div>{uploading === config.id && <p role="status">Uploading {percent == null ? "…" : `${percent}%`}<progress value={percent ?? undefined} max="100" /></p>}</div>;
  })}</div>{message && <p role="status" className="admin-image-message">{message}</p>}</section>;
}
