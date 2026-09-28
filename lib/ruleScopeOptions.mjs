export function ruleScopeOptions(scopeType, categories = [], products = []) {
  if (scopeType === "CATEGORY") return categories.map((category) => ({ id: category.categoryId, label: category.name }));
  if (scopeType === "PRODUCT") return products.map((product) => ({ id: product.id, label: `${product.name} · ${product.id}` }));
  return [];
}
