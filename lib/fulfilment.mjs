export function fulfilmentCounts(order) {
  return (order?.items || []).map((item, index) => Math.min(
    Math.max(0, Number(item.quantity) || 0),
    Math.max(0, Number(order?.fulfilmentCounts?.[index]) || 0),
  ));
}

export function fulfilmentComplete(order) {
  const items = order?.items || [];
  const counts = fulfilmentCounts(order);
  return items.length > 0 && items.every((item, index) => Number(item.quantity) > 0 && counts[index] >= Number(item.quantity));
}

export function matchingOrderLine(order, code, products = []) {
  const needle = String(code || "").trim().toLowerCase();
  if (!needle) return -1;
  return (order?.items || []).findIndex((item) => {
    const product = products.find((entry) => entry.id === item.productId);
    return [item.productId, item.sku, item.barcode, item.qrCode, product?.sku, product?.barcode, product?.qrCode, product?.productCode].some((value) => String(value || "").trim().toLowerCase() === needle);
  });
}
