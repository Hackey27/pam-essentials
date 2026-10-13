import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb, requireRole } from "@/lib/admin";
import { auditPayload } from "@/lib/serverData";
import { serializeDoc } from "@/lib/productData";
import { normalizeProductView } from "@/lib/adminWorkspace.mjs";
const send = (body, status = 200) => NextResponse.json(body, { status, headers: { "cache-control": "private, no-store" } });
export async function GET(request) {
  const access = await requireRole(request, ["owner", "admin"]); if (access.error) return send({ error: access.error }, access.status);
  try { const records = await adminDb().collection("admin_product_views").where("staffId", "==", access.user.uid).get(); return send({ views: records.docs.map(serializeDoc).filter((v) => !v.archived).sort((a, b) => a.name.localeCompare(b.name)) }); }
  catch { return send({ error: "Saved views could not be loaded." }, 503); }
}
export async function POST(request) {
  const access = await requireRole(request, ["owner", "admin"]); if (access.error) return send({ error: access.error }, access.status);
  let body, filters;
  try { body = await request.json(); filters = normalizeProductView(body.filters); if (typeof body.name !== "string" || !body.name.trim() || body.name.length > 60 || body.id && !/^[0-9a-f-]{36}$/i.test(body.id) || body.archived !== undefined && typeof body.archived !== "boolean") throw new Error("Use a view name of up to 60 characters."); }
  catch (error) { return send({ error: error.message || "Check this view." }, 400); }
  try {
    const store = adminDb(), id = body.id || randomUUID(), ref = store.collection("admin_product_views").doc(id);
    const current = await ref.get();
    if (current.exists && current.data().staffId !== access.user.uid || body.archived && !current.exists) return send({ error: "This view is not available to your account." }, 404);
    if (current.exists && current.data().name === body.name.trim() && JSON.stringify(current.data().filters) === JSON.stringify(filters) && current.data().archived === (body.archived === true)) return send({ ok: true, id, duplicate: true });
    const own = await store.collection("admin_product_views").where("staffId", "==", access.user.uid).get();
    if (!current.exists && own.docs.filter((doc) => !doc.data().archived).length >= 30) return send({ error: "You can keep up to 30 saved views. Remove an unused view first." }, 400);
    const value = { staffId: access.user.uid, name: body.name.trim(), filters, archived: body.archived === true, updatedAt: FieldValue.serverTimestamp(), ...(!current.exists ? { createdAt: FieldValue.serverTimestamp() } : {}) };
    const batch = store.batch(); if (current.exists) batch.update(ref, value, current.updateTime ? { lastUpdateTime: current.updateTime } : {}); else batch.create(ref, value);
    batch.create(store.collection("admin_audit").doc(), auditPayload(access.user, value.archived ? "ARCHIVE_PRODUCT_VIEW" : "SAVE_PRODUCT_VIEW", "product-view", id, `${value.archived ? "Removed" : "Saved"} personal view ${value.name}.`, current.exists ? current.data() : null, value));
    await batch.commit(); return send({ ok: true, id });
  } catch { return send({ error: "The view was not confirmed as saved. Refresh and retry." }, 503); }
}
