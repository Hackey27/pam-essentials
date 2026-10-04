import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb, requireRole } from "@/lib/admin";
import { serializeDoc } from "@/lib/productData";
import { text } from "@/lib/serverData";

export async function GET(request) {
  const access = await requireRole(request, ["owner", "admin", "supervisor", "cashier"]);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  const snapshot = await adminDb().collection("shifts").where("staffId", "==", access.user.uid).get();
  const shift = snapshot.docs.map((doc) => ({ ...serializeDoc(doc), startedAt: doc.data().startedAt?.toDate?.()?.toISOString?.() || null })).find((item) => item.status === "open") || null;
  return NextResponse.json({ shift: shift ? { ...shift, staffName: access.user.displayName } : null });
}

export async function POST(request) {
  const access = await requireRole(request, ["owner", "admin", "supervisor", "cashier"]);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  const body = await request.json().catch(() => ({}));
  const store = adminDb();
  if (body.action === "open") {
    const existing = await store.collection("shifts").where("staffId", "==", access.user.uid).get();
    const open = existing.docs.find((doc) => doc.data().status === "open");
    if (open) return NextResponse.json({ shift: { ...serializeDoc(open), staffName: access.user.displayName, startedAt: open.data().startedAt?.toDate?.()?.toISOString?.() || null }, existing: true });
    const shiftId = `SHIFT-${Date.now().toString(36).toUpperCase()}`;
    const value = {
      shiftId,
      staffId: access.user.uid,
      staffEmail: access.user.email,
      staffName: access.user.displayName,
      deviceId: text(body.deviceId, 120),
      status: "open",
      aggregationVersion: 1,
      transactionCount: 0,
      salesTotal: 0,
      paymentMix: {},
      startedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    };
    await store.collection("shifts").doc(shiftId).create(value);
    return NextResponse.json({ shift: { ...value, startedAt: new Date().toISOString(), createdAt: new Date().toISOString() } });
  }

  if (body.action === "close") {
    const shiftId = text(body.shiftId, 120);
    const ref = store.collection("shifts").doc(shiftId);
    const snap = await ref.get();
    if (!snap.exists || snap.data().staffId !== access.user.uid || snap.data().status !== "open") return NextResponse.json({ error: "Open shift not found." }, { status: 404 });
    let summary;
    if (snap.data().aggregationVersion === 1) summary = { transactions: 0, salesTotal: 0, paymentMix: {} };
    else {
      const salesSnap = await store.collection("sales").where("shiftId", "==", shiftId).get();
      const sales = salesSnap.docs.map((doc) => doc.data());
      summary = { transactions: sales.length, salesTotal: sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0), paymentMix: sales.reduce((mix, sale) => ({ ...mix, [sale.paymentMethod || "other"]: (mix[sale.paymentMethod || "other"] || 0) + Number(sale.total || 0) }), {}) };
    }
    try {
      await store.runTransaction(async (tx) => {
        const latest = await tx.get(ref);
        if (!latest.exists || latest.data().status !== "open" || latest.data().staffId !== access.user.uid) throw new Error("This shift has already ended.");
        const finalSummary = latest.data().aggregationVersion === 1 ? { transactions: Number(latest.data().transactionCount || 0), salesTotal: Number(latest.data().salesTotal || 0), paymentMix: latest.data().paymentMix || {} } : summary;
        summary = finalSummary;
        tx.update(ref, { status: "closed", endedAt: FieldValue.serverTimestamp(), summary: finalSummary });
      });
    } catch (error) { return NextResponse.json({ error: error.message || "Shift could not be ended." }, { status: 409 }); }
    return NextResponse.json({ shift: { ...serializeDoc(snap), status: "closed", endedAt: new Date().toISOString(), summary } });
  }
  return NextResponse.json({ error: "Choose open or close shift." }, { status: 400 });
}

