export function relatedCategoryProducts(product, products) {
  if (!product) return [];
  const categoryName = String(product.category || "").trim().toLowerCase();
  if (!product.categoryId && !categoryName) return [];
  return products.filter((item) => {
    if (item.id === product.id || item.active === false || item.archived) return false;
    if (product.categoryId && item.categoryId) return item.categoryId === product.categoryId;
    return categoryName && String(item.category || "").trim().toLowerCase() === categoryName;
  }).sort((a, b) => {
    const sameSub = (item) => product.subcategoryId ? item.subcategoryId === product.subcategoryId : Boolean(product.subcategory) && item.subcategory === product.subcategory;
    return Number(sameSub(b)) - Number(sameSub(a)) || a.name.localeCompare(b.name);
  });
}

// Keep the native scroll position in the middle copy, preserving the visible offset.
export function centredCarouselPosition(left, cycle) {
  if (!(cycle > 0) || !Number.isFinite(left)) return 0;
  return cycle + ((left % cycle) + cycle) % cycle;
}
