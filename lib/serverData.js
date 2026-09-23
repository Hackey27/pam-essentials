import { FieldValue } from "firebase-admin/firestore";

export function auditPayload(user, action, entityType, entityId, description, oldValue = null, newValue = null) {
  return {
    timestamp: FieldValue.serverTimestamp(),
    admin: user.uid,
    adminEmail: user.email,
    action,
    entityType,
    entityId,
    description,
    oldValue,
    newValue,
  };
}

export function nullableNumber(value) {
  if (value === "" || value == null) return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

export function text(value, max = 500) {
  return String(value || "").trim().slice(0, max);
}

export function slug(value) {
  return text(value, 120).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
