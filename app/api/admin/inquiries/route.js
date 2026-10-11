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
    const snapshot = await query.get();
    const page = snapshot.docs.slice(0, 100);
    const inquiries = page.map((doc) => {
      const value = doc.data();
      return { id: doc.id, reference: value.reference, productId: value.productId, productName: value.productName, sku: value.sku, category: value.category, variantOptions: value.variantOptions || {}, name: value.name, phone: value.phone || "", email: value.email || "", measurements: value.measurements || "", quantity: value.quantity || 1, message: value.message, status: value.status || "new", internalNotes: value.internalNotes || "", updatedBy: value.updatedBy || "", createdAt: iso(value.createdAt), updatedAt: iso(value.updatedAt) };
    });
    return NextResponse.json({ inquiries, nextCursor: snapshot.docs.length > 100 ? page.at(-1).id : null, updatedAt: new Date().toISOString() }, { headers: { "cache-control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "Inquiries could not be loaded. Please try again." }, { status: 503 }); }
}
export async function POST(request) {
  const access = await requireRole(request, ["owner", "admin"]);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  const body = await request.json().catch(() => ({}));
  if (!/^[0-9a-f-]{36}$/i.test(body.id || "") || !inquiryStatuses.includes(body.status) || typeof body.internalNotes !== "string" || body.internalNotes.length > 2000) return NextResponse.json({ error: "Choose an inquiry status and use notes of at most 2,000 characters." }, { status: 400 });
  try {
    const store = adminDb(), ref = store.collection("inquiries").doc(body.id);
    const saved = await store.runTransaction(async (transaction) => {
      const previous = await transaction.get(ref);
      if (!previous.exists) return false;
      const value = { status: body.status, internalNotes: body.internalNotes.trim(), updatedBy: access.user.displayName || access.user.email || access.user.uid, updatedAt: FieldValue.serverTimestamp() };
      transaction.update(ref, value);
      transaction.create(store.collection("admin_audit").doc(), auditPayload(access.user, "UPDATE_INQUIRY", "inquiry", body.id, `Updated ${previous.data().reference}: ${body.status}.`, { status: previous.data().status, internalNotes: previous.data().internalNotes || "" }, value));
      return true;
    });
    return saved ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Inquiry not found." }, { status: 404 });
  } catch { return NextResponse.json({ error: "Inquiry update was not confirmed. Refresh and try again." }, { status: 503 }); }
}
