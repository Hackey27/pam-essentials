import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb, requireRole } from "@/lib/admin";
import { auditPayload, nullableNumber, slug, text } from "@/lib/serverData";

export async function POST(request) {
  const access = await requireRole(request, ["owner", "admin"]);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  const body = await request.json().catch(() => ({}));
  const name = text(body.name, 160);
  const ruleId = text(body.ruleId, 80) || slug(name).toUpperCase();
  const scopeType = ["GLOBAL", "CATEGORY", "PRODUCT"].includes(body.scopeType) ? body.scopeType : "GLOBAL";
  const discountType = ["PERCENT", "FIXED_AMOUNT"].includes(body.discountType) ? body.discountType : "PERCENT";
  const valueNumber = nullableNumber(body.value);
  if (!name || !ruleId || valueNumber == null || valueNumber < 0 || (discountType === "PERCENT" && valueNumber > 100)) {
    return NextResponse.json({ error: "Enter a valid rule name and discount value." }, { status: 400 });
  }
  const scopeId = scopeType === "GLOBAL" ? null : text(body.scopeId, 120);
  if (scopeType !== "GLOBAL" && !scopeId) return NextResponse.json({ error: "Choose a category or product for this rule." }, { status: 400 });
  const startDate = body.startDate ? new Date(body.startDate) : null;
  const endDate = body.endDate ? new Date(body.endDate) : null;
  if ((startDate && Number.isNaN(startDate.getTime())) || (endDate && Number.isNaN(endDate.getTime())) || (startDate && endDate && endDate < startDate)) {
    return NextResponse.json({ error: "Choose a valid discount date range." }, { status: 400 });
  }

  const store = adminDb();
  const ref = store.collection("discount_rules").doc(ruleId);
  const existing = await ref.get();
  if (body.create && existing.exists) return NextResponse.json({ error: "That rule ID already exists." }, { status: 409 });
  if (!body.create && !existing.exists) return NextResponse.json({ error: "Discount rule not found." }, { status: 404 });
  const value = {
    ruleId,
    name,
    scopeType,
    scopeId,
    discountType,
    value: valueNumber,
    minQty: Math.max(1, Math.floor(Number(body.minQty || 1))),
    startDate,
    endDate,
    active: body.active !== false,
    priority: Math.floor(Number(body.priority || 0)),
    updatedAt: FieldValue.serverTimestamp(),
  };
  const batch = store.batch();
  if (existing.exists) batch.update(ref, value);
  else batch.create(ref, { ...value, createdAt: FieldValue.serverTimestamp() });
  batch.create(store.collection("admin_audit").doc(), auditPayload(access.user, existing.exists ? "UPDATE_DISCOUNT" : "CREATE_DISCOUNT", "discount_rule", ruleId, `${existing.exists ? "Updated" : "Created"} discount ${name}.`, existing.exists ? existing.data() : null, value));
  await batch.commit();
  return NextResponse.json({ ok: true, ruleId });
}
