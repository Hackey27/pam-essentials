const HERO_IMAGE_PATH = /^hero\/(web|mobile)\/[a-z0-9][a-z0-9._-]{0,150}\.(?:jpe?g|png|webp|avif)$/i;

export function isHeroImagePath(path, slot = "") {
  if (typeof path !== "string" || path.includes("..")) return false;
  const match = HERO_IMAGE_PATH.exec(path);
  return Boolean(match && (!slot || match[1] === slot));
}

export function getHeroImageUrl(path, width = 2200) {
  if (!isHeroImagePath(path)) return "";
  return `/images/${path}?w=${Math.max(1, Math.min(2400, Math.round(Number(width) || 2200)))}&fmt=webp&q=82`;
}
