import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb, requireRole } from "@/lib/admin";
import { auditPayload } from "@/lib/serverData";
import { validateRequestQuote } from "@/lib/productRequests.mjs";

export const dynamic = "force-dynamic";
const uuid = /^[0-9a-f-]{36}$/i;
const date = (value) => value?.toDate?.()?.toISOString?.() || value || null;
export async function GET(request) {
  const access = await requireRole(request, ["owner", "admin"]);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  try {
    const store = adminDb(), params = new URL(request.url).searchParams;
    if (params.has("image")) {
      const id = params.get("request"), index = Number(params.get("image"));
      if (!uuid.test(id || "") || !Number.isInteger(index) || index < 0 || index > 4) return NextResponse.json({ error: "Invalid request image." }, { status: 400 });
      const record = await store.collection("product_requests").doc(id).get();
      const imageId = record.exists && record.data().imageIds?.[index];
      if (!imageId) return NextResponse.json({ error: "Image not found." }, { status: 404 });
      const image = await store.collection("product_request_images").doc(imageId).get();
      if (!image.exists || image.data().requestId !== id) return NextResponse.json({ error: "Image not found." }, { status: 404 });
      return new Response(Buffer.from(image.data().base64, "base64"), { headers: { "content-type": "image/webp", "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
    }
    let query = store.collection("product_requests").orderBy("createdAt", "desc").limit(101);
    const cursor = params.get("cursor");
    if (cursor) {
      if (!uuid.test(cursor)) return NextResponse.json({ error: "Invalid cursor." }, { status: 400 });
      const snap = await store.collection("product_requests").doc(cursor).get();
      if (!snap.exists) return NextResponse.json({ error: "Refresh the request list." }, { status: 400 });
      query = query.startAfter(snap);
    }
    const focusId = params.get("id");
    if (focusId && !uuid.test(focusId)) return NextResponse.json({ error: "Choose a valid request." }, { status: 400 });
    const focused = focusId ? await store.collection("product_requests").doc(focusId).get() : null;
    if (focused && !focused.exists) return NextResponse.json({ error: "This request is no longer available." }, { status: 404 });
    const result = focused ? { docs: [focused] } : await query.get(), page = result.docs.slice(0, 100);
    const requests = page.map((doc) => {
      const v = doc.data();
      return { id: doc.id, reference: v.reference, name: v.name, phone: v.phone || "", email: v.email || "", productName: v.productName, description: v.description, quantity: v.quantity, measurements: v.measurements || "", preferences: v.preferences || "", productLink: v.productLink || "", budget: v.budget ?? null, preferredDate: v.preferredDate || "", allowAlternatives: v.allowAlternatives === true, imageCount: v.imageIds?.length || 0, status: v.status || "new", internalNotes: v.internalNotes || "", quotation: v.quotation || "", quoteTotal: v.quoteTotal ?? null, updatedBy: v.updatedBy || "", createdAt: date(v.createdAt), updatedAt: date(v.updatedAt) };
    });
    return NextResponse.json({ requests, nextCursor: result.docs.length > 100 ? page.at(-1).id : null, updatedAt: new Date().toISOString() }, { headers: { "cache-control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "Product requests could not be loaded. Please retry." }, { status: 503 }); }
}
export async function POST(request) {
  const access = await requireRole(request, ["owner", "admin"]);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  let body, values;
  try { body = await request.json(); if (!uuid.test(body.id || "")) throw new Error("Choose a valid request."); values = validateRequestQuote(body); }
  catch (error) { return NextResponse.json({ error: error.message }, { status: 400 }); }
  try {
    const store = adminDb(), ref = store.collection("product_requests").doc(body.id);
    const saved = await store.runTransaction(async (tx) => {
      const before = await tx.get(ref); if (!before.exists) return false;
      const next = { ...values, updatedBy: access.user.displayName || access.user.uid, updatedAt: FieldValue.serverTimestamp() };
      tx.update(ref, next);
      tx.create(store.collection("admin_audit").doc(), auditPayload(access.user, "UPDATE_PRODUCT_REQUEST", "product-request", body.id, `Updated ${before.data().reference}: ${values.status}.`, { status: before.data().status, quoteTotal: before.data().quoteTotal ?? null }, next));
      return true;
    });
    return saved ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Request not found." }, { status: 404 });
  } catch { return NextResponse.json({ error: "The update was not confirmed as saved. Refresh and retry." }, { status: 503 }); }
}
