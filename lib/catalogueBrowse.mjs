export const curatedSearches = ["Water bottles", "Lunch boxes", "Pens", "Pencils", "School supplies"];

const schoolCategories = new Set(["Writing Materials & Accessories", "Drawing Materials", "Art", "Lunch Box"]);

export function matchesSearch(product, query) {
  const term = String(query || "").trim().toLowerCase();
  if (!term) return true;
  if (term === "school supplies") return schoolCategories.has(product.category);
  const words = term.replace(/\bboxes\b/g, "box").replace(/\bbottles\b/g, "bottle").replace(/\bpens\b/g, "pen").replace(/\bpencils\b/g, "pencil").split(/\s+/).filter(Boolean);
  const text = [product.name, product.id, product.category, product.subcategory, product.subSubcategory, ...(product.keywords || [])].join(" ").toLowerCase();
  return words.every((word) => text.includes(word));
}

export function matchingRules(product, rules) {
  return rules.filter((rule) =>
    rule.scopeType === "GLOBAL" ||
    (rule.scopeType === "CATEGORY" && rule.scopeId === product.categoryId) ||
    (rule.scopeType === "PRODUCT" && rule.scopeId === product.id)
  );
}

export function isOnSale(product, rules) {
  return matchingRules(product, rules).some((rule) =>
    rule.scopeType !== "GLOBAL" || /sale|deal|promo/i.test(rule.name || "")
  );
}

export function isPromotion(product, rules) {
  return hasCollection(product, "Promotion") ||
    matchingRules(product, rules).some((rule) => /promo/i.test(rule.name || ""));
}

export function hasCollection(product, name) {
  return (product.collections || []).some((item) => String(item).toLowerCase() === name.toLowerCase());
}

export function isNewArrival(product) {
  return product.newArrival === true;
}

export function isBestSeller(product) {
  return product.bestSeller === true || Number(product.purchaseCount || 0) >= 3;
}

export function inCollection(product, collection, rules) {
  if (!collection) return true;
  if (collection === "New Arrivals") return isNewArrival(product);
  if (collection === "Best Sellers") return isBestSeller(product);
  if (collection === "Promotion") return isPromotion(product, rules);
  if (collection === "Back to School") return hasCollection(product, collection) || schoolCategories.has(product.category);
  if (collection === "PAM Deals") return hasCollection(product, collection);
  return hasCollection(product, collection);
}

export function popularityScore(product) {
  return Number(product.clickCount || 0) + Number(product.purchaseCount || 0) * 5;
}

