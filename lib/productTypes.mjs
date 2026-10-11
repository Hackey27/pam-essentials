const labelKey = (value) => String(value || "").trim().normalize("NFKC").toLocaleLowerCase("en");

// Optional CSV metadata overrides browsing groups, without moving the product's category hierarchy.
export function productType(product, subcategories = []) {
  const parent = product.categoryId || product.category || "uncategorised";
  const assigned = subcategories.find((sub) => sub.categoryId === product.categoryId && (product.subcategoryId && (sub.subcategoryId === product.subcategoryId || sub.id === product.subcategoryId) || product.subcategory && sub.name === product.subcategory));
  const explicit = typeof product.productType === "string" ? product.productType.trim() : "";
  const name = explicit || assigned?.name || product.subcategory || product.category || "Other products";
  const matched = subcategories.find((sub) => sub.categoryId === product.categoryId && labelKey(sub.name) === labelKey(name));
  const fallback = !matched && labelKey(name) === labelKey(product.category || "Other products");
  return { key: `${parent}::${labelKey(name)}`, name, category: product.category, rank: fallback ? Number.MAX_SAFE_INTEGER : matched ? Number(matched.sortOrder ?? 999999) : 999999 };
}

export function groupProductsByType(products, subcategories = []) {
  const groups = new Map();
  for (const product of products) {
    const type = productType(product, subcategories);
    if (!groups.has(type.key)) groups.set(type.key, { key: type.key, name: type.name, category: type.category, products: [] });
    groups.get(type.key).products.push(product);
  }
  return [...groups.values()];
}
