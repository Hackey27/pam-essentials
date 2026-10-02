export const COMPARE_KEY = "pam-compare-products";

export function readCompare(storage) {
  try {
    const ids = JSON.parse(storage.getItem(COMPARE_KEY) || "[]");
    return Array.isArray(ids) ? [...new Set(ids.filter((id) => typeof id === "string" && id.length <= 160))].slice(0, 4) : [];
  } catch { return []; }
}

export function toggleCompare(storage, id) {
  const current = readCompare(storage);
  const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id].slice(0, 4);
  storage.setItem(COMPARE_KEY, JSON.stringify(next));
  return next;
}
