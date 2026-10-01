import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb, requireRole } from "@/lib/admin";
import { auditPayload, nullableNumber, slug, text } from "@/lib/serverData";
import { findRuleOverlaps } from "@/lib/discountOverlap.mjs";

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
  if (scopeId) {
    const target = await store.collection(scopeType === "CATEGORY" ? "categories" : "products").doc(scopeType === "CATEGORY" ? scopeId : encodeURIComponent(scopeId)).get();
    if (!target.exists) return NextResponse.json({ error: "Choose an existing category or product for this rule." }, { status: 400 });
  }
  const minQty = Number(body.minQty || 1);
  const priority = Number(body.priority || 0);
  if (!Number.isInteger(minQty) || minQty < 1 || !Number.isInteger(priority)) return NextResponse.json({ error: "Minimum quantity and priority must be whole numbers." }, { status: 400 });
  const ref = store.collection("discount_rules").doc(ruleId);
  const existing = await ref.get();
  if (body.create && existing.exists) return NextResponse.json({ error: "That rule ID already exists." }, { status: 409 });
  if (!body.create && !existing.exists) return NextResponse.json({ error: "Discount rule not found." }, { status: 404 });
  const value = {
    ruleId,
    name,
    scopeType,
    scopeId,
    kind: body.kind === "promotion" ? "promotion" : "discount",
    discountType,
    value: valueNumber,
    minQty,
    startDate,
    endDate,
    active: body.active !== false && body.archived !== true,
    archived: body.archived === true,
    priority,
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (value.active) {
    const [rulesSnap, dealsSnap, productsSnap] = await Promise.all([
      store.collection("discount_rules").get(),
      store.collection("deal_bundles").get(),
      store.collection("products").get(),
    ]);
    const overlaps = findRuleOverlaps(value,
      rulesSnap.docs.map((doc) => ({ ruleId: doc.id, ...doc.data() })),
      dealsSnap.docs.map((doc) => ({ dealId: doc.id, ...doc.data() })),
      productsSnap.docs.map((doc) => ({ id: decodeURIComponent(doc.id), ...doc.data() })),
    );
    if (overlaps.length && body.acknowledgeOverlap !== true) return NextResponse.json({ error: "This rule may overlap an active discount, promotion or deal. Review the warning and acknowledge it before saving.", overlaps }, { status: 409 });
  }
  const batch = store.batch();
  if (existing.exists) batch.update(ref, value);
  else batch.create(ref, { ...value, createdAt: FieldValue.serverTimestamp() });
  batch.create(store.collection("admin_audit").doc(), auditPayload(access.user, existing.exists ? "UPDATE_DISCOUNT" : "CREATE_DISCOUNT", "discount_rule", ruleId, `${existing.exists ? "Updated" : "Created"} discount ${name}.`, existing.exists ? existing.data() : null, value));
  await batch.commit();
  return NextResponse.json({ ok: true, ruleId });
}

