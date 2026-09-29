export function normalizeCode(value) {
  return String(value || "").trim().replace(/\s+/g, "").toLowerCase();
}

export function matchingProducts(products, scannedValue) {
  const code = normalizeCode(scannedValue);
  if (!code) return [];
  return products.filter((product) => [product.barcode, product.qrCode, product.productCode, product.sku, product.id].some((value) => normalizeCode(value) === code));
}
