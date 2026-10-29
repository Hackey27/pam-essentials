// Match public product identities without changing stored SKUs or identifiers.
export function productRouteCandidates(value) {
  if (typeof value !== "string" || !value) return [];
  const candidates = [];
  for (let depth = 0; depth < 3; depth++) {
    if (candidates.includes(value)) break;
    candidates.push(value);
    try { value = decodeURIComponent(value); } catch { break; }
  }
  return candidates;
}

export function resolveStorefrontProduct(products, routeId) {
  if (!Array.isArray(products)) return null;
  const candidates = productRouteCandidates(routeId);
  // Prefer real internal IDs before accepting current-SKU links after a rename.
  for (const id of candidates) {
    const product = products.find((item) => item.id === id);
    if (product) return product;
  }
  for (const sku of candidates) {
    const product = products.find((item) => item.sku === sku);
    if (product) return product;
  }
  return null;
}
