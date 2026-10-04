export function normalizeBarcode(value) {
  return String(value || "").trim().replace(/\s+/g, "").toLowerCase();
}

export function parseBarcodes(value) {
  return String(value || "").split(",").map((code) => code.trim()).filter(Boolean);
}

export function barcodeEntries(product) {
  if (Array.isArray(product?.barcodeEntries)) return product.barcodeEntries;
  const legacy = String(product?.barcode || "").trim();
  return legacy ? [{ code: legacy, sku: product.sku || product.id || "", archived: false }] : [];
}

export function activeBarcodes(product) {
  return barcodeEntries(product).filter((entry) => !entry.archived).map((entry) => entry.code);
}

export function allBarcodeCodes(product) {
  return barcodeEntries(product).map((entry) => entry.code);
}

export function planBarcodes(product, { additions = "", archive = [], multiple = false, sku = "", now = new Date().toISOString() } = {}) {
  const existing = barcodeEntries(product).map((entry) => ({ ...entry }));
  const archived = new Set(archive.map(normalizeBarcode));
  const known = new Set(existing.map((entry) => normalizeBarcode(entry.code)));
  if (existing.some((entry) => entry.archived && archived.has(normalizeBarcode(entry.code)))) return { error: "That barcode is already archived." };
  if (archive.some((code) => !known.has(normalizeBarcode(code)))) return { error: "Only assigned barcodes can be archived." };
  if (String(product?.sku || product?.id || "") !== String(sku) && existing.some((entry) => !entry.archived && !archived.has(normalizeBarcode(entry.code)))) return { error: "Archive active barcodes before changing the SKU." };
  for (const entry of existing) if (archived.has(normalizeBarcode(entry.code))) { entry.archived = true; entry.archivedAt = now; }
  const pending = parseBarcodes(additions);
  if (pending.some((code) => code.length > 100 || /[\r\n]/.test(code))) return { error: "Each barcode must be at most 100 characters on one line." };
  if (new Set(pending.map(normalizeBarcode)).size !== pending.length) return { error: "The barcode list contains duplicates." };
  if (pending.some((code) => known.has(normalizeBarcode(code)))) return { error: "An assigned or archived barcode cannot be added again." };
  if (existing.length + pending.length > 100) return { error: "A product can have at most 100 barcode records." };
  for (const code of pending) existing.push({ code, sku, archived: false, createdAt: now });
  const active = existing.filter((entry) => !entry.archived);
  if (active.length > 1 && !multiple) return { error: "Check Multiple barcodes for this product before assigning more than one active code." };
  return { entries: existing, barcode: active[0]?.code || "", multipleBarcodes: active.length > 1 || Boolean(multiple) };
}
