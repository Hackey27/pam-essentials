import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb, requireRole } from "@/lib/admin";
import { auditPayload, nullableNumber, slug, text } from "@/lib/serverData";

export async function POST(request) {
  const access = await requireRole(request, ["owner", "admin"]);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  const body = await request.json().catch(() => ({}));
  const name = text(body.name, 160);
  const dealId = text(body.dealId, 80) || `DEAL-${slug(name).toUpperCase()}`;
  const productIds = Array.isArray(body.productIds) ? [...new Set(body.productIds.map((id) => text(id, 160)).filter(Boolean))] : [];
  const finalPrice = nullableNumber(body.finalPrice);
  if (!name || !dealId || dealId.includes("/") || productIds.length < 2 || productIds.length > 20 || finalPrice == null || finalPrice <= 0) {
    return NextResponse.json({ error: "Enter a name, at least two products and a positive final price." }, { status: 400 });
  }
  const store = adminDb();
  const productSnaps = await store.getAll(...productIds.map((id) => store.collection("products").doc(encodeURIComponent(id))));
  if (productSnaps.some((snap) => !snap.exists || !(Number(snap.data().price) > 0) || snap.data().active === false || snap.data().archived === true)) {
    return NextResponse.json({ error: "Every bundle product must exist, be active and have a selling price." }, { status: 400 });
  }
  const aggregatePrice = Math.round(productSnaps.reduce((sum, snap) => sum + Number(snap.data().price), 0) * 100) / 100;
  const ref = store.collection("deal_bundles").doc(dealId);
  const existing = await ref.get();
  if (body.create && existing.exists) return NextResponse.json({ error: "That deal ID already exists." }, { status: 409 });
  if (!body.create && !existing.exists) return NextResponse.json({ error: "Deal bundle not found." }, { status: 404 });
  const value = {
    dealId, name, productIds, finalPrice, active: body.active !== false,
    updatedAt: FieldValue.serverTimestamp(),
  };
  const batch = store.batch();
  if (existing.exists) batch.update(ref, value);
  else batch.create(ref, { ...value, createdAt: FieldValue.serverTimestamp() });
  batch.create(store.collection("admin_audit").doc(), auditPayload(access.user, existing.exists ? "UPDATE_DEAL_BUNDLE" : "CREATE_DEAL_BUNDLE", "deal_bundle", dealId, `${existing.exists ? "Updated" : "Created"} deal bundle ${name}.`, existing.exists ? existing.data() : null, value));
  await batch.commit();
  return NextResponse.json({ ok: true, dealId, aggregatePrice });
}

