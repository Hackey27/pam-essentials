import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/admin";
import { customerIdentity } from "@/lib/customerAuth";

export async function POST(request) {
  const account = await customerIdentity(request);
  if (account.error) return NextResponse.json({ error: account.error }, { status: account.status });
  const body = await request.json().catch(() => ({}));
  const reference = String(body.reference || "").trim().toUpperCase();
  const phone = String(body.phone || "").replace(/\s+/g, "").trim();
  if (!/^ORD-[A-Z0-9]+$/.test(reference) || !phone) return NextResponse.json({ error: "Enter a valid order reference and phone number." }, { status: 400 });
  const store = adminDb();
  try {
    await store.runTransaction(async (tx) => {
      const ref = store.collection("orders").doc(reference);
      const snap = await tx.get(ref);
      const order = snap.data();
      if (!snap.exists || String(order.phone || "").replace(/\s+/g, "") !== phone || order.customerUid && order.customerUid !== account.uid) throw new Error("No claimable order matched those details.");
      tx.update(ref, { customerUid: account.uid, updatedAt: FieldValue.serverTimestamp() });
    });
    return NextResponse.json({ ok: true, orderId: reference });
  } catch (error) { return NextResponse.json({ error: error.message || "The order could not be claimed." }, { status: 404 }); }
}

