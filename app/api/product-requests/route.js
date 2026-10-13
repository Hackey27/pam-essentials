import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { optionalCustomerIdentity } from "@/lib/customerAuth";
import { adminDb } from "@/lib/admin";
import { productRequestAcknowledgement, productRequestReference, requestPhotoLimit, validateProductRequest } from "@/lib/productRequests.mjs";
import { prepareRequestPhoto } from "@/lib/requestPhotos.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const hash = (value) => createHash("sha256").update(value).digest("hex");
async function readForm(request) {
  const maxBytes = 26 * 1024 * 1024;
  const type = request.headers.get("content-type") || "";
  if (!type.startsWith("multipart/form-data;") || Number(request.headers.get("content-length") || 0) > maxBytes) throw new Error("Use the product request form with up to five 5 MB photos.");
  const reader = request.body?.getReader(), chunks = []; let bytes = 0;
  if (!reader) throw new Error("Complete the product request form.");
  while (true) { const next = await reader.read(); if (next.done) break; bytes += next.value.byteLength; if (bytes > maxBytes) { await reader.cancel(); throw new Error("Your request is too large."); } chunks.push(Buffer.from(next.value)); }
  return new Request(request.url, { method: "POST", headers: { "content-type": type }, body: Buffer.concat(chunks) }).formData();
}
export async function POST(request) {
  const account = await optionalCustomerIdentity(request);
  if (account.error) return NextResponse.json({ error: account.error }, { status: account.status });
  const origin = request.headers.get("origin"), host = request.headers.get("host");
  if (origin && ![new URL(request.url).origin, host ? `https://${host}` : ""].includes(origin)) return NextResponse.json({ error: "Send product requests from the PAM website." }, { status: 403 });
  let details, photos, files;
  try {
    const form = await readForm(request), raw = form.get("details");
    if (typeof raw !== "string" || raw.length > 10000) throw new Error("Check your request details.");
    details = validateProductRequest(JSON.parse(raw));
    files = form.getAll("photos");
    if (files.length > requestPhotoLimit) throw new Error("Use up to five photos.");
  } catch (error) { return NextResponse.json({ error: error instanceof SyntaxError ? "Check your request details." : error.message }, { status: 400 }); }
  try {
    const store = adminDb();
    const refs = [details.phone && `phone:${details.phone.replace(/\D/g, "")}`, details.email && `email:${details.email}`].filter(Boolean).map((value) => store.collection("product_request_limits").doc(hash(value)));
    const preflight = await store.getAll(...refs);
    if (preflight.some((doc) => doc.exists && Date.now() - doc.data().windowStart < 3600000 && doc.data().count >= 5)) {
      const existing = await store.collection("product_requests").doc(details.requestId).get();
      if (!existing.exists) return NextResponse.json({ error: "You have sent several requests recently. Please call or WhatsApp us, or try later." }, { status: 429 });
    }
    photos = [];
    try { for (const file of files) photos.push(await prepareRequestPhoto(file)); } catch (error) { return NextResponse.json({ error: error.message }, { status: 400 }); }
    const ref = store.collection("product_requests").doc(details.requestId);
    const fingerprint = hash(JSON.stringify({ details, photos: photos.map((photo) => hash(photo.base64)) }));
    const contacts = [details.phone && `phone:${details.phone.replace(/\D/g, "")}`, details.email && `email:${details.email}`].filter(Boolean);
    const limits = contacts.map((value) => store.collection("product_request_limits").doc(hash(value)));
    const result = await store.runTransaction(async (tx) => {
      const previous = await tx.get(ref);
      if (previous.exists) return previous.data().requestHash === fingerprint ? { reference: previous.data().reference, linkedToAccount: Boolean(account.uid && previous.data().customerUid === account.uid), duplicate: true } : { error: "This request reference was already used. Reopen the form to submit different details.", status: 409 };
      const snaps = await tx.getAll(...limits), now = Date.now();
      const values = snaps.map((doc) => doc.exists && now - doc.data().windowStart < 3600000 ? { count: doc.data().count, windowStart: doc.data().windowStart } : { count: 0, windowStart: now });
      if (values.some((value) => value.count >= 5)) return { error: "You have sent several requests recently. Please call or WhatsApp us, or try later.", status: 429 };
      const reference = productRequestReference(details.requestId), { requestId, ...fields } = details;
      const imageIds = photos.map((_, index) => `${requestId}_${index}`);
      tx.create(ref, { ...fields, ...(account.uid ? { customerUid: account.uid } : {}), statusHistory: [{ status: "new", at: new Date().toISOString() }], reference, requestHash: fingerprint, imageIds, status: "new", internalNotes: "", quotation: "", quoteTotal: null, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      photos.forEach((photo, index) => tx.create(store.collection("product_request_images").doc(imageIds[index]), { ...photo, requestId, createdAt: FieldValue.serverTimestamp() }));
      values.forEach((value, index) => { const next = { ...value, count: value.count + 1 }; if (snaps[index].exists) tx.update(limits[index], next); else tx.create(limits[index], next); });
      return { reference, linkedToAccount: Boolean(account.uid) };
    });
    if (result.error) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ ok: true, ...result, message: productRequestAcknowledgement, trackingCode: details.requestId }, { headers: { "cache-control": "no-store" } });
  } catch { return NextResponse.json({ error: "Your request has not been confirmed as saved. Retry the same form or contact us." }, { status: 503 }); }
}
