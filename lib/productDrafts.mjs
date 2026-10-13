export const draftMaxAge = 7 * 86400000;
export function draftKey(uid, id = "new") { return `pam-product-draft-v1:${encodeURIComponent(uid)}:${encodeURIComponent(id)}`; }
export function draftSignature(value) { return JSON.stringify(value); }
export function writeProductDraft(storage, uid, editor, baseline, now = Date.now()) {
  if (!uid || editor?.type !== "product") return;
  const id = editor.data.create ? "new" : editor.data.id;
  const record = { version: 1, uid, id, at: now, data: editor.data, baseline };
  const content = JSON.stringify(record);
  if (content.length > 500000) throw new Error("This draft is too large to recover automatically. Save the product before leaving.");
  storage.setItem(draftKey(uid, id), content);
}
export function readProductDraft(storage, uid, id = "new", now = Date.now()) {
  try {
    const draft = JSON.parse(storage.getItem(draftKey(uid, id)) || "null");
    if (!draft || draft.version !== 1 || draft.uid !== uid || draft.id !== id || !Number.isFinite(draft.at) || !draft.data || typeof draft.data !== "object" || Array.isArray(draft.data) || typeof draft.baseline !== "string" || now - draft.at > draftMaxAge || draft.at > now + 60000) return null;
    return draft;
  } catch { return null; }
}
export function removeProductDraft(storage, uid, id = "new") { storage.removeItem(draftKey(uid, id)); }
export function recoveredDraftChanges(draft, current) {
  let baseline; try { baseline = JSON.parse(draft.baseline); } catch { return []; }
  if (!baseline || typeof baseline !== "object" || Array.isArray(baseline)) return [];
  const ignored = new Set(["expectedVersion", "editVersion", "create", "acknowledgeOverlap", "variantDirty", ...(!current.create ? ["id"] : [])]);
  const equal = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  return Object.entries(draft.data).filter(([key, value]) => !ignored.has(key) && !equal(value, baseline[key])).map(([field, value]) => ({ field, value, before: baseline[field] ?? null, current: current[field] ?? null, conflict: !equal(current[field], baseline[field]) && !equal(current[field], value) }));
}
