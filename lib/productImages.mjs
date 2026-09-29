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
  const imageMap = product?.variantImages || selected?.variantImages || {};
  return key && imageMap[key] && typeof imageMap[key] === "object" ? imageMap[key] : null;
}

export function cardImageSource(product) {
  const entry = variantImageEntry(product);
  const path = [product?.cardPreviewImagePath, entry?.imagePath, entry?.galleryImagePaths?.[0], product?.galleryImagePaths?.[0], product?.masterImagePath].find(isProductImagePath) || "";
  return path ? { path, url: getProductImageUrl(path, 350) } : { path: "", url: product?.imageUrl || "" };
}

export function detailImageSource(product, selected = product) {
  const entry = variantImageEntry(product, selected);
  const path = [entry?.imagePath, entry?.galleryImagePaths?.[0], product?.cardPreviewImagePath, product?.galleryImagePaths?.[0], product?.masterImagePath].find(isProductImagePath) || "";
  return path ? { path, url: getProductImageUrl(path, 1000) } : { path: "", url: selected?.imageUrl || product?.imageUrl || "" };
}

export function galleryImagePaths(product, selected = product) {
  const entry = variantImageEntry(product, selected);
  const paths = entry?.galleryImagePaths?.length ? entry.galleryImagePaths : product?.galleryImagePaths || [];
  return paths.filter(isProductImagePath);
}
