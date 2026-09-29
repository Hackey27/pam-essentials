"use client";

import { useEffect, useRef, useState } from "react";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";
import { getProductImageUrl, isProductImagePath, productImageFolder, safeImageSegment, variantCombinationKey } from "@/lib/productImages.mjs";

const allowed = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"], ["image/avif", "avif"]]);
const MAX_FILE_SIZE = 20 * 1024 * 1024;

function Preview({ path, label, localUrl }) {
  const [failed, setFailed] = useState(false);
  if (localUrl) return <img src={localUrl} alt={label || "Product image"} />;
  if (!isProductImagePath(path) || failed) return <span className="admin-image-empty">{label || "No image"}</span>;
  return <img src={getProductImageUrl(path, 200)} alt={label || "Product image"} loading="lazy" onError={() => setFailed(true)} />;
}

export default function AdminProductImages({ value, update, products, onBusyChange }) {
  const { role } = useAuth();
  const [progress, setProgress] = useState(null);
  const [message, setMessage] = useState("");
  const [uploadPreviews, setUploadPreviews] = useState({});
  const previewUrls = useRef([]);
  useEffect(() => () => previewUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);
  const folder = productImageFolder(value.id);
  const siblings = value.productGroupId ? products.filter((product) => product.productGroupId === value.productGroupId) : [];
  const combinations = [...new Map(siblings.map((product) => [variantCombinationKey(product), product]).filter(([key]) => key)).entries()];

  function setVariant(key, patch) {
    update("variantImages", (currentMap) => {
      const current = currentMap?.[key] || {};
      return { ...(currentMap || {}), [key]: { ...current, ...patch } };
    });
  }

  function updateGallery(paths, key) {
    if (key) update("variantImages", (currentMap) => {
      const current = currentMap?.[key] || {};
      return { ...(currentMap || {}), [key]: { ...current, galleryImagePaths: typeof paths === "function" ? paths(current.galleryImagePaths || []) : paths } };
    });
    else update("galleryImagePaths", (current) => typeof paths === "function" ? paths(current || []) : paths);
  }

  async function upload(file, kind, key = "", replaceIndex = -1) {
    if (!file) return;
    if (!auth.currentUser || !["owner", "admin"].includes(role)) { setMessage("Only an active Owner or Admin can upload product images. Sign in again if your session expired."); return; }
    if (!allowed.has(file.type) || !/\.(jpe?g|png|webp|avif)$/i.test(file.name)) { setMessage("Choose a JPG, PNG, WebP or AVIF image."); return; }
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) { setMessage("Images must be smaller than 20 MB."); return; }
    if (progress) { setMessage("Wait for the current upload to finish."); return; }
    const extension = allowed.get(file.type);
    const name = `${Date.now()}-${crypto.randomUUID()}-${safeImageSegment(file.name.replace(/\.[^.]+$/, ""))}.${extension}`;
    const prefix = key ? `products/${folder}/variants/${productImageFolder(key)}/${kind === "variant-main" ? "main" : "gallery"}` : `products/${folder}/${kind}`;
    const path = `${prefix}/${name}`;
    setMessage("");
    setProgress({ path });
    onBusyChange(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120000);
      let response;
      try {
        response = await fetch("/api/admin/images", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": file.type, "x-product-id": value.id, "x-image-path": path }, body: file, signal: controller.signal });
      } finally { clearTimeout(timeout); }
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Upload failed (${response.status}).`);
      const localUrl = URL.createObjectURL(file);
      previewUrls.current.push(localUrl);
      setUploadPreviews((current) => ({ ...current, [path]: localUrl }));
      if (kind === "card-preview") update("cardPreviewImagePath", path);
      else if (kind === "master") update("masterImagePath", path);
      else if (kind === "variant-main") setVariant(key, { imagePath: path });
      else {
        updateGallery((current) => { const next = [...current]; if (replaceIndex >= 0) next[replaceIndex] = path; else next.push(path); return next; }, key);
      }
      setMessage("✓ Upload complete. Save changes to assign this image to the product.");
    } catch (error) {
      setMessage(error?.name === "AbortError" ? "Upload timed out. Check the connection and try again." : error?.message || "Image upload failed.");
    } finally {
      setProgress(null);
      onBusyChange(false);
    }
  }

  function galleryEditor(paths, kind, key = "") {
    return <div className="admin-gallery-list">{paths.map((path, index) => <div className="admin-gallery-item" key={`${path}-${index}`}><Preview path={path} localUrl={uploadPreviews[path]} label={`Gallery image ${index + 1}`} /><div className="admin-gallery-actions"><button type="button" disabled={index === 0} onClick={() => { const next = [...paths]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; updateGallery(next, key); }}>↑</button><button type="button" disabled={index === paths.length - 1} onClick={() => { const next = [...paths]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; updateGallery(next, key); }}>↓</button><label className="admin-upload-label">Replace<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={Boolean(progress)} onChange={(event) => { upload(event.target.files?.[0], kind, key, index); event.target.value = ""; }} /></label><button type="button" onClick={() => updateGallery(paths.filter((_, position) => position !== index), key)}>Remove</button></div></div>)}</div>;
  }

  if (value.create) return <fieldset><legend>Product images</legend><p>Save this product first, then edit it to upload images.</p></fieldset>;

  return <fieldset className="admin-images"><legend>Product images</legend>
    <section><h3>Card preview image</h3><div className="admin-image-row"><Preview key={value.cardPreviewImagePath || "card-empty"} path={value.cardPreviewImagePath} localUrl={uploadPreviews[value.cardPreviewImagePath]} label="Card preview" /><div><label className="admin-upload-label">{value.cardPreviewImagePath ? "Replace image" : "Upload image"}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={Boolean(progress)} onChange={(event) => { upload(event.target.files?.[0], "card-preview"); event.target.value = ""; }} /></label>{value.cardPreviewImagePath && <button type="button" onClick={() => update("cardPreviewImagePath", "")}>Remove assignment</button>}</div></div></section>
    <section><h3>Master image (optional)</h3><div className="admin-image-row"><Preview key={value.masterImagePath || "master-empty"} path={value.masterImagePath} localUrl={uploadPreviews[value.masterImagePath]} label="Master image" /><div><label className="admin-upload-label">{value.masterImagePath ? "Replace image" : "Upload image"}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={Boolean(progress)} onChange={(event) => { upload(event.target.files?.[0], "master"); event.target.value = ""; }} /></label>{value.masterImagePath && <button type="button" onClick={() => update("masterImagePath", "")}>Remove assignment</button>}</div></div></section>
    <section><h3>Product gallery</h3>{galleryEditor(value.galleryImagePaths || [], "gallery")}<label className="admin-upload-label">Add gallery images<input type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" disabled={Boolean(progress)} onChange={async (event) => { for (const file of event.target.files || []) await upload(file, "gallery"); event.target.value = ""; }} /></label></section>
    <section><h3>Variant combination images</h3>{combinations.length ? combinations.map(([key, product]) => { const entry = value.variantImages?.[key] || {}; return <div className="admin-variant-images" key={key}><h4>{[product.size, product.colour, ...Object.values(product.variantOptions || {})].filter(Boolean).join(" · ") || product.name} <small>{product.id}</small></h4><div className="admin-image-row"><Preview key={entry.imagePath || key} path={entry.imagePath} localUrl={uploadPreviews[entry.imagePath]} label={`${product.name} variant`} /><div><label className="admin-upload-label">{entry.imagePath ? "Replace main image" : "Assign main image"}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={Boolean(progress)} onChange={(event) => { upload(event.target.files?.[0], "variant-main", key); event.target.value = ""; }} /></label>{entry.imagePath && <button type="button" onClick={() => setVariant(key, { imagePath: "" })}>Remove assignment</button>}</div></div>{galleryEditor(entry.galleryImagePaths || [], "variant-gallery", key)}<label className="admin-upload-label">Add variant gallery images<input type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" disabled={Boolean(progress)} onChange={async (event) => { for (const file of event.target.files || []) await upload(file, "variant-gallery", key); event.target.value = ""; }} /></label></div>; }) : <p>No variants configured for this product.</p>}</section>
    {progress && <p role="status">Uploading image… <progress /></p>}
    {message && <p role="status" className="admin-image-message">{message}</p>}
  </fieldset>;
}
