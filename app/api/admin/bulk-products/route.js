import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb, requireRole } from "@/lib/admin";
import { loadHierarchy } from "@/lib/categoryHierarchy";
import { auditPayload } from "@/lib/serverData";
import { documentVersion } from "@/lib/documentVersion.mjs";
import { normalizeBulkRequest, planBulkProducts } from "@/lib/bulkProducts.mjs";

export const dynamic = "force-dynamic";
const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const response = (value, status = 200) => NextResponse.json(value, { status, headers: { "cache-control": "private, no-store" } });
export async function POST(request) {
  const access = await requireRole(request, ["owner", "admin"]);
  if (access.error) return response({ error: access.error }, access.status);
  let body, values;
  try { body = await request.json(); values = normalizeBulkRequest(body); if (!["preview", "apply"].includes(body.mode)) throw new Error("Choose Preview or Apply."); }
  catch (error) { return response({ error: error.message || "Check the bulk changes." }, 400); }
  const store = adminDb(), requestHash = digest(values);
  if (body.mode === "apply" && !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId || "")) return response({ error: "Refresh the change preview before applying." }, 400);
  const operation = body.mode === "apply" ? store.collection("admin_bulk_operations").doc(body.requestId) : null;
  try {
    if (operation) {
      const old = await operation.get();
      if (old.exists) return old.data().staffId === access.user.uid && old.data().requestHash === requestHash ? response({ ok: true, duplicate: true, changedCount: old.data().changedCount, operationId: body.requestId }) : response({ error: "This operation reference belongs to different changes." }, 409);
    }
    const [all, hierarchy] = await Promise.all([store.collection("products").get(), loadHierarchy(store)]);
    const snapshots = new Map(all.docs.map((doc) => [doc.data().id || decodeURIComponent(doc.id), doc]));
    const products = all.docs.map((doc) => ({ ...doc.data(), id: doc.data().id || decodeURIComponent(doc.id) }));
    let plan;
    try { plan = planBulkProducts(products, values, hierarchy); } catch (error) { return response({ error: error.message }, 400); }
    const previewHash = digest({ values, rows: plan.rows, warnings: plan.warnings, versions: values.ids.map((id) => [id, documentVersion(snapshots.get(id))]) });
    if (body.mode === "preview") return response({ ...plan, previewHash });
    if (body.previewHash !== previewHash) return response({ error: "Products or selected changes have changed since the preview. No changes were saved. Preview again." }, 409);
    if (!plan.changedCount) return response({ error: "There are no changes to apply." }, 400);
    const batch = store.batch();
    for (const row of plan.rows.filter((row) => row.changes.length)) {
      const snap = snapshots.get(row.id);
      batch.update(snap.ref, { ...row.patch, updatedAt: FieldValue.serverTimestamp() }, snap.updateTime ? { lastUpdateTime: snap.updateTime } : {});
      batch.create(store.collection("admin_audit").doc(), auditPayload(access.user, "BULK_UPDATE_PRODUCT", "product", row.id, `Bulk update ${row.name}. Reason: ${values.reason}. Operation: ${body.requestId}`, { ...Object.fromEntries(row.changes.map((v) => [v.field, v.before])), price: snap.data().price ?? null, costPrice: snap.data().costPrice ?? null }, { ...row.patch, price: Object.hasOwn(row.patch, "price") ? row.patch.price : snap.data().price ?? null, costPrice: snap.data().costPrice ?? null }));
    }
    batch.create(operation, { staffId: access.user.uid, requestHash, changedCount: plan.changedCount, reason: values.reason, createdAt: FieldValue.serverTimestamp() });
    await batch.commit();
    return response({ ok: true, changedCount: plan.changedCount, operationId: body.requestId });
  } catch (error) {
    if ([6, 9, "already-exists", "failed-precondition"].includes(error.code)) return response({ error: "A selected product changed, or these changes were already submitted. Nothing was partially saved. Refresh and retry with the same operation." }, 409);
    return response({ error: "Bulk changes were not confirmed as saved. Retry with the same operation reference." }, 503);
  }
}
