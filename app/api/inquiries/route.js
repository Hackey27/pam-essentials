import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/admin";
import { availableOnStorefront, catalogueContext } from "@/lib/commerce";
import { requiresPricingInquiry } from "@/lib/productPricing.mjs";
import { inquiryAcknowledgement, inquiryReference, validateInquiry } from "@/lib/inquiries.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const hash = (text) => createHash("sha256").update(text).digest("hex");
async function readBody(request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Check your inquiry details.");
  let total = 0; const chunks = [];
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    total += value.byteLength;
    if (total > 16384) { await reader.cancel(); throw new Error("Your inquiry is too large. Shorten the message and try again."); }
    chunks.push(Buffer.from(value));
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
export async function POST(request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "Send inquiries from the PAM website." }, { status: 403 });
  let body;
  try { body = validateInquiry(await readBody(request)); }
  catch (error) { return NextResponse.json({ error: error instanceof SyntaxError ? "Check your inquiry details." : error.message }, { status: 400 }); }
  try {
    const store = adminDb(), context = await catalogueContext(store);
    const productRef = store.collection("products").doc(encodeURIComponent(body.productId));
    const inquiryRef = store.collection("inquiries").doc(body.requestId);
    const bodyHash = hash(JSON.stringify(body));
    const contacts = [body.phone && `phone:${body.phone.replace(/\D/g, "")}`, body.email && `email:${body.email}`].filter(Boolean);
    const limitRefs = contacts.map((contact) => store.collection("inquiry_limits").doc(hash(contact)));
    const reference = inquiryReference(body.requestId), now = Date.now();
    const result = await store.runTransaction(async (transaction) => {
      const previous = await transaction.get(inquiryRef);
      if (previous.exists) {
        if (previous.data().requestHash !== bodyHash) return { status: 409, error: "This inquiry reference was used for different details. Reopen the form to send a new inquiry." };
        return { reference: previous.data().reference, duplicate: true };
      }
      const productSnap = await transaction.get(productRef);
      const limits = await transaction.getAll(...limitRefs);
      const product = productSnap.exists ? productSnap.data() : null;
      if (!product || !requiresPricingInquiry(product) || !availableOnStorefront(product, context)) return { status: 409, error: "This product no longer requires a pricing inquiry. Refresh its details." };
      const activeLimits = limits.map((snap) => {
        const value = snap.exists ? snap.data() : {};
        return now - Number(value.windowStart || 0) < 3600000 ? { count: Number(value.count || 0), windowStart: value.windowStart } : { count: 0, windowStart: now };
      });
      if (activeLimits.some((limit) => limit.count >= 5)) return { status: 429, error: "You have sent several inquiries recently. Please call or WhatsApp us, or try again later." };
      const { requestId, ...details } = body;
      transaction.create(inquiryRef, { ...details, reference, requestHash: bodyHash, productName: product.name, sku: product.sku || product.id || body.productId, category: product.category || "", variantOptions: product.variantOptions || {}, status: "new", internalNotes: "", createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      activeLimits.forEach((limit, index) => {
        const value = { count: limit.count + 1, windowStart: limit.windowStart };
        if (limits[index].exists) transaction.update(limitRefs[index], value);
        else transaction.create(limitRefs[index], value);
      });
      return { reference };
    });
    if (result.error) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ ok: true, ...result, message: inquiryAcknowledgement }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Your inquiry has not been confirmed as saved. Please retry using this form, or call/WhatsApp us." }, { status: 503 });
  }
}
