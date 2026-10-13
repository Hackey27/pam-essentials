import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb, requireRole } from "@/lib/admin";
import { auditPayload } from "@/lib/serverData";
import { inquiryStatuses } from "@/lib/inquiries.mjs";

export const dynamic = "force-dynamic";
const iso = (value) => value?.toDate?.()?.toISOString?.() || value || null;
export async function GET(request) {
  const access = await requireRole(request, ["owner", "admin"]);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  try {
    const store = adminDb(), cursor = new URL(request.url).searchParams.get("cursor");
    let query = store.collection("inquiries").orderBy("createdAt", "desc").limit(101);
    if (cursor) {
      if (!/^[0-9a-f-]{36}$/i.test(cursor)) return NextResponse.json({ error: "Invalid inquiry cursor." }, { status: 400 });
      const snap = await store.collection("inquiries").doc(cursor).get();
      if (!snap.exists) return NextResponse.json({ error: "Refresh the inquiry list." }, { status: 400 });
      query = query.startAfter(snap);
    }
    const focusId = new URL(request.url).searchParams.get("id");
    if (focusId && !/^[0-9a-f-]{36}$/i.test(focusId)) return NextResponse.json({ error: "Choose a valid inquiry." }, { status: 400 });
    const focused = focusId ? await store.collection("inquiries").doc(focusId).get() : null;
    if (focused && !focused.exists) return NextResponse.json({ error: "This inquiry is no longer available." }, { status: 404 });
    const snapshot = focused ? { docs: [focused] } : await query.get();
    const page = snapshot.docs.slice(0, 100);
    const inquiries = page.map((doc) => {
      const value = doc.data();
      return { id: doc.id, reference: value.reference, productId: value.productId, productName: value.productName, sku: value.sku, category: value.category, variantOptions: value.variantOptions || {}, name: value.name, phone: value.phone || "", email: value.email || "", measurements: value.measurements || "", quantity: value.quantity || 1, message: value.message, status: value.status || "new", internalNotes: value.internalNotes || "", customerReply: value.customerReply || "", quoteTotal: value.quoteTotal ?? null, customerUid: value.customerUid || "", updatedBy: value.updatedBy || "", createdAt: iso(value.createdAt), updatedAt: iso(value.updatedAt) };
    });
    return NextResponse.json({ inquiries, nextCursor: snapshot.docs.length > 100 ? page.at(-1).id : null, updatedAt: new Date().toISOString() }, { headers: { "cache-control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "Inquiries could not be loaded. Please try again." }, { status: 503 }); }
}
export async function POST(request) {
  const access = await requireRole(request, ["owner", "admin"]);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  const body = await request.json().catch(() => ({}));
  if (!/^[0-9a-f-]{36}$/i.test(body.id || "") || !inquiryStatuses.includes(body.status) || typeof body.internalNotes !== "string" || body.internalNotes.length > 2000) return NextResponse.json({ error: "Choose an inquiry status and use notes of at most 2,000 characters." }, { status: 400 });
  if (body.customerReply !== undefined && (typeof body.customerReply !== "string" || body.customerReply.length > 3000)) return NextResponse.json({ error: "Use a reply of up to 3,000 characters." }, { status: 400 });
  if (body.quoteTotal !== undefined && body.quoteTotal !== null && body.quoteTotal !== "" && (!/^\d+(?:\.\d{1,2})?$/.test(String(body.quoteTotal)) || Number(body.quoteTotal) <= 0 || Number(body.quoteTotal) > 10000000)) return NextResponse.json({ error: "Use a valid GHS quote." }, { status: 400 });
  if (body.quoteTotal != null && body.quoteTotal !== "" && !String(body.customerReply || "").trim()) return NextResponse.json({ error: "Add a customer-facing reply describing this quote." }, { status: 400 });
  try {
    const store = adminDb(), ref = store.collection("inquiries").doc(body.id);
    const saved = await store.runTransaction(async (transaction) => {
      const previous = await transaction.get(ref);
      if (!previous.exists) return false;
      const before = previous.data();
      const value = { ...(body.customerReply !== undefined ? { customerReply: body.customerReply.trim() } : {}), ...(body.quoteTotal !== undefined ? { quoteTotal: body.quoteTotal === "" || body.quoteTotal == null ? null : Number(body.quoteTotal) } : {}), ...(before.status !== body.status ? { statusHistory: [...(before.statusHistory || []), { status: body.status, at: new Date().toISOString() }] } : {}), status: body.status, internalNotes: body.internalNotes.trim(), updatedBy: access.user.displayName || access.user.email || access.user.uid, updatedAt: FieldValue.serverTimestamp() };
      transaction.update(ref, value);
      transaction.create(store.collection("admin_audit").doc(), auditPayload(access.user, "UPDATE_INQUIRY", "inquiry", body.id, `Updated ${before.reference}: ${body.status}.`, { status: before.status, internalNotes: before.internalNotes || "", customerReply: before.customerReply || "", quoteTotal: before.quoteTotal ?? null }, value));
      return true;
    });
    return saved ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Inquiry not found." }, { status: 404 });
  } catch { return NextResponse.json({ error: "Inquiry update was not confirmed. Refresh and try again." }, { status: 503 }); }
}
