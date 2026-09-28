import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb, requireRole } from "@/lib/admin";
import { auditPayload, nullableNumber, text } from "@/lib/serverData";
import { serializeDoc } from "@/lib/productData";

export const dynamic = "force-dynamic";

const roles = ["owner", "admin", "supervisor", "cashier"];
const methods = ["cash", "mobile-money", "card", "bank-transfer"];

async function activeShift(store, shiftId, uid) {
  if (!shiftId) return null;
  const snap = await store.collection("shifts").doc(shiftId).get();
  return snap.exists && snap.data().staffId === uid && snap.data().status === "open" ? snap : null;
}

export async function GET(request) {
  const access = await requireRole(request, roles);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  const shiftId = text(new URL(request.url).searchParams.get("shiftId"), 120);
  const store = adminDb();
  if (!await activeShift(store, shiftId, access.user.uid)) return NextResponse.json({ error: "An open shift is required." }, { status: 403 });
  const snapshot = await store.collection("expenses").where("shiftId", "==", shiftId).get();
  const expenses = snapshot.docs.map((doc) => ({ ...serializeDoc(doc), recordedAt: doc.data().recordedAt?.toDate?.()?.toISOString?.() || null })).sort((a, b) => String(b.recordedAt || b.createdAt).localeCompare(String(a.recordedAt || a.createdAt)));
  return NextResponse.json({ expenses });
}

export async function POST(request) {
  const access = await requireRole(request, roles);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  const body = await request.json().catch(() => ({}));
  const shiftId = text(body.shiftId, 120);
  const store = adminDb();
  if (!await activeShift(store, shiftId, access.user.uid)) return NextResponse.json({ error: "An open shift is required." }, { status: 403 });
  const amount = nullableNumber(body.amount);
  const description = text(body.description, 500);
  const category = text(body.category, 100);
  const paymentMethod = text(body.paymentMethod, 40);
  const expenseDate = text(body.expenseDate, 10);
  const today = new Date().toISOString().slice(0, 10);
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(expenseDate) && !Number.isNaN(Date.parse(`${expenseDate}T12:00:00Z`)) && new Date(`${expenseDate}T12:00:00Z`).toISOString().slice(0, 10) === expenseDate && expenseDate <= today;
  if (amount == null || amount <= 0 || amount > 1_000_000_000 || !description || !category || !methods.includes(paymentMethod) || !validDate) return NextResponse.json({ error: "Enter a valid date, category, description, positive amount and payment method." }, { status: 400 });
  const ref = store.collection("expenses").doc();
  const value = {
    expenseId: ref.id,
    shiftId,
    expenseDate,
    amount,
    category,
    description,
    paymentMethod,
    staffId: access.user.uid,
    staffEmail: access.user.email,
    createdAt: expenseDate === today ? FieldValue.serverTimestamp() : Timestamp.fromDate(new Date(`${expenseDate}T12:00:00Z`)),
    recordedAt: FieldValue.serverTimestamp(),
  };
  const batch = store.batch();
  batch.create(ref, value);
  batch.create(store.collection("admin_audit").doc(), auditPayload(access.user, "RECORD_EXPENSE", "expense", ref.id, `Recorded ${amount.toFixed(2)} expense for ${description}.`, null, value));
  await batch.commit();
  return NextResponse.json({ ok: true, expenseId: ref.id });
}

