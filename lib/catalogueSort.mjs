import { productType } from "./productTypes.mjs";
import { isPromotion, popularityScore } from "./catalogueBrowse.mjs";

export function sortProducts(products, sort, rules = [], categories = [], subcategories = []) {
  const byName = (a, b) => a.name.localeCompare(b.name);
  if (sort === "price-low") return [...products].sort((a, b) => a.price - b.price || byName(a, b));
  if (sort === "price-high") return [...products].sort((a, b) => b.price - a.price || byName(a, b));
  if (sort === "rating") return [...products].sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0) || popularityScore(b) - popularityScore(a) || byName(a, b));
  if (sort === "latest") return [...products].sort((a, b) => (Date.parse(b.createdAt || "") || 0) - (Date.parse(a.createdAt || "") || 0) || byName(a, b));
  if (sort === "promotions") return [...products].sort((a, b) => Number(isPromotion(b, rules)) - Number(isPromotion(a, rules)) || byName(a, b));
  if (sort === "popularity") return [...products].sort((a, b) => popularityScore(b) - popularityScore(a) || byName(a, b));
  const ordered = [...categories].sort((a, b) => Number(a.sortOrder ?? 999999) - Number(b.sortOrder ?? 999999) || a.name.localeCompare(b.name));
  const ids = new Map(ordered.map((category, index) => [category.categoryId || category.id, index]));
  const names = new Map(ordered.map((category, index) => [category.name, index]));
  const rank = (product) => ids.get(product.categoryId) ?? names.get(product.category) ?? 999999;
  const types = new Map(sort === "types" ? products.map((product) => [product, productType(product, subcategories)]) : []);
  const compareTypes = (a, b) => types.get(a).rank - types.get(b).rank || types.get(a).key.localeCompare(types.get(b).key);
  return [...products].sort((a, b) => rank(a) - rank(b) || (rank(a) === 999999 ? String(a.category || "").localeCompare(String(b.category || "")) : 0) || (sort === "types" ? compareTypes(a, b) : 0) || byName(a, b));
}
