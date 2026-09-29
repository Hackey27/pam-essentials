"use client";

import { useEffect, useRef, useState } from "react";
import { ref, uploadBytesResumable } from "firebase/storage";
import { auth, storage } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";
import { getProductImageUrl, isProductImagePath, productImageFolder, safeImageSegment, variantCombinationKey } from "@/lib/productImages.mjs";

const allowed = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"], ["image/avif", "avif"]]);
const MAX_FILE_SIZE = 20 * 1024 * 1024;

function uploadError(error) {
  const messages = {
    "storage/unauthenticated": "Your sign-in expired. Sign in again before uploading.",
    "storage/unauthorized": "Storage denied this upload. Ask the owner to check deployed Storage rules and your Admin role.",
    "storage/bucket-not-found": "The configured image bucket was not found. Check Firebase Storage setup.",
    "storage/quota-exceeded": "The image bucket has reached its quota or needs billing enabled.",
    "storage/retry-limit-exceeded": "The upload timed out. Check your connection and try again.",
    "storage/canceled": "The upload was cancelled.",
  };
  return messages[error?.code] || error?.message || "Upload failed. Check your connection and Storage permissions.";
}

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
    setProgress({ path, percent: 0 });
    onBusyChange(true);
    try {
      await new Promise((resolve, reject) => {
        const task = uploadBytesResumable(ref(storage, path), file, { contentType: file.type, cacheControl: "public,max-age=31536000,immutable", customMetadata: { originalName: file.name } });
        let timer;
        let timedOut = false;
        const armTimeout = () => {
          clearTimeout(timer);
          timer = setTimeout(() => { timedOut = true; task.cancel(); reject(new Error("No upload progress for 45 seconds. Check your connection, bucket and Storage rules, then try again.")); }, 45000);
        };
        armTimeout();
        task.on("state_changed", (snapshot) => {
          setProgress({ path, percent: snapshot.totalBytes ? Math.round(100 * snapshot.bytesTransferred / snapshot.totalBytes) : 0 });
          armTimeout();
        }, (error) => { clearTimeout(timer); if (!timedOut) reject(error); }, () => { clearTimeout(timer); resolve(); });
      });
      const localUrl = URL.createObjectURL(file);
      previewUrls.current.push(localUrl);
      setUploadPreviews((current) => ({ ...current, [path]: localUrl }));
      if (kind === "card-preview") update("cardPreviewImagePath", path);
      else if (kind === "master") update("masterImagePath", path);
      else if (kind === "variant-main") setVariant(key, { imagePath: path });
      else {
        updateGallery((current) => { const next = [...current]; if (replaceIndex >= 0) next[replaceIndex] = path; else next.push(path); return next; }, key);
      }
      setMessage("✓ Upload complete. Preview is local until you save changes; the storefront image also requires the image service to access Storage.");
    } catch (error) {
      setMessage(uploadError(error));
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
    {progress && <p role="status">Uploading {progress.percent}% <progress value={progress.percent} max="100" /></p>}
    {message && <p role="status" className="admin-image-message">{message}</p>}
  </fieldset>;
}
