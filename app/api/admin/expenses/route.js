import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb, requireRole } from "@/lib/admin";
import { auditPayload, nullableNumber, text } from "@/lib/serverData";

export async function POST(request) {
  const access = await requireRole(request, ["owner", "admin"]);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  const body = await request.json().catch(() => ({}));
  const amount = nullableNumber(body.amount);
  const description = text(body.description, 500);
  if (amount == null || amount <= 0 || !description) return NextResponse.json({ error: "Enter a positive amount and description." }, { status: 400 });
  const store = adminDb();
  const ref = store.collection("expenses").doc();
  const value = {
    expenseId: ref.id,
    amount,
    category: text(body.category, 100) || "Operating expense",
    description,
    paymentMethod: text(body.paymentMethod, 40) || "cash",
    staffId: access.user.uid,
    staffEmail: access.user.email,
    createdAt: FieldValue.serverTimestamp(),
  };
  const batch = store.batch();
  batch.create(ref, value);
  batch.create(store.collection("admin_audit").doc(), auditPayload(access.user, "RECORD_EXPENSE", "expense", ref.id, `Recorded ${amount.toFixed(2)} expense for ${description}.`, null, value));
  await batch.commit();
  return NextResponse.json({ ok: true, expenseId: ref.id });
}
