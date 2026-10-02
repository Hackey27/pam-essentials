import { isPromotion, popularityScore } from "./catalogueBrowse.mjs";

export function sortProducts(products, sort, rules = []) {
  const byName = (a, b) => a.name.localeCompare(b.name);
  if (sort === "price-low") return [...products].sort((a, b) => a.price - b.price || byName(a, b));
  if (sort === "price-high") return [...products].sort((a, b) => b.price - a.price || byName(a, b));
  if (sort === "rating") return [...products].sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0) || popularityScore(b) - popularityScore(a) || byName(a, b));
  if (sort === "latest") return [...products].sort((a, b) => (Date.parse(b.createdAt || "") || 0) - (Date.parse(a.createdAt || "") || 0) || byName(a, b));
  if (sort === "promotions") return [...products].sort((a, b) => Number(isPromotion(b, rules)) - Number(isPromotion(a, rules)) || byName(a, b));
  if (sort === "popularity") return [...products].sort((a, b) => popularityScore(b) - popularityScore(a) || byName(a, b));
  return [...products].sort((a, b) => String(a.category || "").localeCompare(String(b.category || "")) || byName(a, b));
}
