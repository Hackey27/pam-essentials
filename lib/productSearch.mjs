// Read existing keyword/tag formats without changing stored product records.
export function productSearchKeywords(product) {
  const values = (value) => Array.isArray(value) ? value.flatMap(values) : typeof value === "string" ? value.split(/[,;\n]+/).map((item) => item.trim()).filter(Boolean) : [];
  return [...new Set([...values(product.keywords), ...values(product.tags)])];
}

export function normalizeSearchText(value) {
  return String(value || "").normalize("NFKC").toLowerCase().replace(/[\p{P}\p{S}]+/gu, " ").replace(/\s+/g, " ").trim();
}
