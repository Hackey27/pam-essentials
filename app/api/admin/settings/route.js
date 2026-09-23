import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb, requireRole } from "@/lib/admin";
import { auditPayload, nullableNumber, text } from "@/lib/serverData";

const allowed = new Set([
  "DEFAULT_LOW_STOCK_LEVEL", "DISCOUNT_STACKING", "TAX_ENABLED", "PRICES_INCLUDE_TAX", "VAT_RATE", "NHIL_RATE", "GETFUND_RATE", "RECEIPT_TAX_NOTE",
  "STORE_NAME", "STORE_LOCATION", "OPENING_HOURS", "WHATSAPP_NUMBER", "RECEIPT_FOOTER", "DELIVERY_OPTIONS", "DELIVERY_FEE",
]);
const booleans = new Set(["DISCOUNT_STACKING", "TAX_ENABLED", "PRICES_INCLUDE_TAX"]);
const numbers = new Set(["DEFAULT_LOW_STOCK_LEVEL", "VAT_RATE", "NHIL_RATE", "GETFUND_RATE", "DELIVERY_FEE"]);

export async function POST(request) {
  const access = await requireRole(request, ["owner", "admin"]);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  const body = await request.json().catch(() => ({}));
  const key = text(body.key, 80).toUpperCase();
  if (!allowed.has(key)) return NextResponse.json({ error: "That setting cannot be changed here." }, { status: 400 });
  if (key === "TAX_ENABLED" && (body.value === true || body.value === "true")) return NextResponse.json({ error: "Tax calculation remains disabled until registration and rates are verified." }, { status: 409 });

  const store = adminDb();
  const ref = store.collection("settings").doc(key);
  const existing = await ref.get();
  let value = typeof body.value === "string" ? text(body.value, 2000) : body.value;
  if (booleans.has(key)) value = body.value === true || body.value === "true";
  if (numbers.has(key)) value = nullableNumber(body.value);
  const setting = { key, value, description: text(body.description, 500), updatedAt: FieldValue.serverTimestamp(), updatedBy: access.user.uid };
  const batch = store.batch();
  batch.set(ref, { ...setting, ...(existing.exists ? {} : { createdAt: FieldValue.serverTimestamp() }) }, { merge: true });
  batch.create(store.collection("admin_audit").doc(), auditPayload(access.user, "UPDATE_SETTING", "setting", key, `Updated setting ${key}.`, existing.exists ? existing.data() : null, setting));
  await batch.commit();
  return NextResponse.json({ ok: true, key });
}
