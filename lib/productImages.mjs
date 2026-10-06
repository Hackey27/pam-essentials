const IMAGE_EXTENSIONS = /\.(?:jpe?g|png|webp|avif)$/i;
const IMAGE_PATH = /^products\/[a-z0-9_-]+\/(?:card-preview|gallery|master|variants\/[a-z0-9_-]+\/(?:main|gallery))\/[a-z0-9._-]+\.(?:jpe?g|png|webp|avif)$/i;
const OPTION_KEYS = ["size", "colour", "material", "storage", "version", "duration", "platform"];

export function safeImageSegment(value) {
  return String(value || "").normalize("NFKD").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72) || "item";
}

export function productImageFolder(id) {
  const value = String(id || "");
  let hash = 2166136261;
  for (const byte of new TextEncoder().encode(value)) hash = Math.imul(hash ^ byte, 16777619) >>> 0;
  return `${safeImageSegment(value)}-${hash.toString(36)}`;
}

export function variantCombinationKey(product) {
  if (!product) return "";
  const options = { ...(product.variantOptions && typeof product.variantOptions === "object" ? product.variantOptions : {}) };
  for (const key of OPTION_KEYS) if (product[key] != null && String(product[key]).trim()) options[key] = product[key];
  return Object.entries(options)
    .filter(([, value]) => value != null && String(value).trim())
    .map(([key, value]) => [String(key).trim().toLowerCase(), String(value).trim()])
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("|");
}

export function isProductImagePath(path) {
  return typeof path === "string" && path.length <= 500 && IMAGE_PATH.test(path) && !path.includes("..") && IMAGE_EXTENSIONS.test(path);
}

export function getProductImageUrl(path, width = 350, format = "webp", quality = 80) {
  if (!isProductImagePath(path)) return "";
  const size = Math.max(1, Math.min(2400, Math.round(Number(width) || 350)));
  const fmt = format === "avif" ? "avif" : "webp";
  const q = Math.max(40, Math.min(95, Math.round(Number(quality) || 80)));
  return `/images/${path}?w=${size}&fmt=${fmt}&q=${q}`;
}

export function variantImageEntry(product, selected = product) {
  const key = variantCombinationKey(selected);
  const selectedMap = selected?.variantImages || {};
  const originMap = product?.variantImages || {};
  const entry = selectedMap[key] || originMap[key];
  return key && entry && typeof entry === "object" ? entry : null;
}

export function cardImageSource(product) {
  const entry = variantImageEntry(product);
  const path = [product?.cardPreviewImagePath, entry?.imagePath, entry?.galleryImagePaths?.[0], product?.galleryImagePaths?.[0], product?.masterImagePath].find(isProductImagePath) || "";
  return path ? { path, url: getProductImageUrl(path, 350) } : { path: "", url: product?.imageUrl || "" };
}

export function detailImageSource(product, selected = product) {
  const entry = variantImageEntry(product, selected);
  const selectedPath = [entry?.imagePath, entry?.galleryImagePaths?.[0], selected?.cardPreviewImagePath, selected?.galleryImagePaths?.[0], selected?.masterImagePath].find(isProductImagePath) || "";
  if (selectedPath) return { path: selectedPath, url: getProductImageUrl(selectedPath, 1000) };
  if (selected?.imageUrl) return { path: "", url: selected.imageUrl };
  const originPath = [product?.cardPreviewImagePath, product?.galleryImagePaths?.[0], product?.masterImagePath].find(isProductImagePath) || "";
  return originPath ? { path: originPath, url: getProductImageUrl(originPath, 1000) } : { path: "", url: product?.imageUrl || "" };
}

export function galleryImagePaths(product, selected = product) {
  const entry = variantImageEntry(product, selected);
  const paths = entry?.galleryImagePaths?.length ? entry.galleryImagePaths : selected?.galleryImagePaths?.length ? selected.galleryImagePaths : product?.galleryImagePaths || [];
  return paths.filter(isProductImagePath);
}

// Inline carousel and full-screen gallery use the same variant-aware image list.
export function productGallery(product, selected = product, variants = []) {
  const images = [];
  const add = (source, label) => {
    if (!source?.url || images.some((image) => source.path ? image.source.path === source.path : image.source.url === source.url)) return;
    images.push({ source, label });
  };
  add(detailImageSource(product, selected), "Main image");
  const paths = galleryImagePaths(product, selected);
  for (const path of paths) add({ path, url: getProductImageUrl(path, 1000) }, "Gallery image");
  // Retain legacy image arrays without requiring a catalogue migration.
  const legacyImages = Array.isArray(selected?.images) ? selected.images : [];
  for (const url of legacyImages) if (typeof url === "string" && /^https?:\/\//i.test(url)) add({ path: "", url }, "Gallery image");
  if (!paths.length && !legacyImages.length) {
    for (const variant of variants) add(cardImageSource(variant), variant.name);
  }
  return images;
}
