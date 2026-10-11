import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb, requireRole } from "@/lib/admin";
import { loadHierarchy } from "@/lib/categoryHierarchy";
import { auditPayload } from "@/lib/serverData";
import { importPreview, maxImportBytes, planCatalogueImport } from "@/lib/catalogueImport.mjs";

export const runtime = "nodejs";
const canonical = (value) => {
  if (typeof value?.toJSON === "function") return canonical(value.toJSON());
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
};
const hash = (value) => createHash("sha256").update(value).digest("hex");
async function bodyJson(request) {
  const limit = maxImportBytes * 2 + 65536;
  if (Number(request.headers.get("content-length") || 0) > limit) throw new Error("The import request is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Choose a CSV file first.");
  const chunks = []; let total = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    total += value.byteLength;
    if (total > limit) { await reader.cancel(); throw new Error("The import request is too large."); }
    chunks.push(Buffer.from(value));
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
}
export async function POST(request) {
  const access = await requireRole(request, ["owner", "admin"]);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  let body;
  try { body = await bodyJson(request); } catch { return NextResponse.json({ error: "Use a valid UTF-8 CSV file no larger than 2 MB." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.csv !== "string" || Buffer.byteLength(body.csv, "utf8") > maxImportBytes || !/^[^\/\\\x00-\x1f]{1,160}\.csv$/i.test(body.fileName || "") || !["preview", "apply"].includes(body.mode)) return NextResponse.json({ error: "Choose a UTF-8 .csv file (maximum 2 MB)." }, { status: 400 });
  const store = adminDb(), csvHash = hash(body.csv);
  let job;
  if (body.mode === "apply") {
    if (!/^[0-9a-f-]{36}$/i.test(body.requestId || "") || !/^[0-9a-f]{64}$/i.test(body.previewHash || "")) return NextResponse.json({ error: "Preview this file before applying it." }, { status: 400 });
    job = store.collection("catalogue_imports").doc(`${access.user.uid}_${body.requestId}`);
    const previous = await job.get();
    if (previous.exists) return previous.data().csvHash === csvHash ? NextResponse.json({ ...previous.data().result, duplicate: true }) : NextResponse.json({ error: "This import reference was already used for a different file." }, { status: 409 });
  }
  try {
    const [snapshot, hierarchy] = await Promise.all([store.collection("products").get(), loadHierarchy(store)]);
    const records = snapshot.docs.map((doc) => ({ docId: doc.id, data: doc.data(), updateTime: doc.updateTime, ref: doc.ref }));
    const plan = planCatalogueImport(body.csv, records, hierarchy);
    if (plan.errors.length) return NextResponse.json({ error: "Correct the listed rows and preview the file again.", errors: plan.errors }, { status: 400 });
    const previewHash = hash(body.csv + JSON.stringify(canonical(plan.entries.map(({ sku, id, before, patch, record }) => ({ sku, id, before, patch, version: record?.updateTime ?? null })))));
    if (body.mode === "preview") return NextResponse.json({ summary: plan.summary, rows: importPreview(plan), previewHash });
    if (body.previewHash !== previewHash) return NextResponse.json({ error: "Products changed since this preview. Preview again before applying; nothing was imported." }, { status: 409 });
    const changes = plan.entries.filter((entry) => entry.status !== "unchanged"), batch = store.batch();
    const now = FieldValue.serverTimestamp();
    for (const entry of changes) {
      if (entry.record) batch.update(entry.record.ref, { ...entry.patch, updatedAt: now }, { lastUpdateTime: entry.record.updateTime });
      else batch.create(store.collection("products").doc(encodeURIComponent(entry.id)), { id: entry.id, sku: entry.sku, description: "", keywords: [], stock: 0, costPrice: null, active: true, archived: false, pinned: false, newArrival: false, collections: [], lowStockLevel: 8, imageUrl: "", images: [], cardPreviewImagePath: "", galleryImagePaths: [], masterImagePath: "", variantImages: {}, productGroupId: "", variantOptions: {}, ...entry.patch, createdAt: now, updatedAt: now, source: "CSV import" });
    }
    const result = { ok: true, ...plan.summary };
    batch.create(job, { admin: access.user.uid, csvHash, fileName: body.fileName, result, createdAt: now });
    batch.create(store.collection("admin_audit").doc(), auditPayload(access.user, "IMPORT_CATALOGUE_CSV", "catalogue", body.requestId, `Imported ${body.fileName}: ${plan.summary.created} new products, ${plan.summary.updated} updated; stock and image links preserved.`, null, { fileName: body.fileName, summary: plan.summary, products: changes.map(({ sku, id, status, before, patch }) => ({ sku, id, status, fields: Object.keys(patch), nameBefore: before?.name ? String(before.name).slice(0, 160) : null, nameAfter: (patch.name || before?.name) ? String(patch.name || before.name).slice(0, 160) : null, priceBefore: before?.price ?? null, priceAfter: patch.price ?? before?.price ?? null })) }));
    await batch.commit();
    return NextResponse.json(result);
  } catch (error) {
    if ([6, 9, 10, "already-exists", "failed-precondition", "aborted"].includes(error.code)) {
      const previous = job ? await job.get() : null;
      if (previous?.exists && previous.data().csvHash === csvHash) return NextResponse.json({ ...previous.data().result, duplicate: true });
      return NextResponse.json({ error: "Products changed during import. Preview again; no partial updates were applied." }, { status: 409 });
    }
    if (!error.code && /CSV|column|heading|row|quote/i.test(error.message || "")) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("Catalogue import failed", { code: error.code });
    return NextResponse.json({ error: "Catalogue import failed. No success has been recorded; try previewing again." }, { status: 503 });
  }
}
