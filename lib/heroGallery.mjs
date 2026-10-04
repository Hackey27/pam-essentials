import { isHeroImagePath } from "./heroImages.mjs";

export const galleryKey = (slot) => slot === "mobile" ? "HERO_MOBILE_IMAGES" : "HERO_WEB_IMAGES";
export const legacyKey = (slot) => slot === "mobile" ? "HERO_MOBILE_IMAGE_PATH" : "HERO_WEB_IMAGE_PATH";

export function heroImageList(settings, slot) {
  const gallery = settings?.[galleryKey(slot)]?.value;
  if (Array.isArray(gallery)) return gallery.filter((image) => isHeroImagePath(image?.path, slot)).map((image) => ({ path: image.path, sortOrder: Number(image.sortOrder || 0), active: image.active !== false })).sort((a, b) => a.sortOrder - b.sortOrder || a.path.localeCompare(b.path));
  const legacy = settings?.[legacyKey(slot)]?.value;
  return isHeroImagePath(legacy, slot) ? [{ path: legacy, sortOrder: 0, active: true }] : [];
}

export function validHeroImageList(value, slot) {
  return Array.isArray(value) && value.length <= 12 && new Set(value.map((image) => image?.path)).size === value.length && value.every((image) => image && isHeroImagePath(image.path, slot) && Number.isSafeInteger(Number(image.sortOrder)) && Number(image.sortOrder) >= 0 && typeof image.active === "boolean");
}
