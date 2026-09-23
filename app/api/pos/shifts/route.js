import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb, requireRole } from "@/lib/admin";
import { serializeDoc } from "@/lib/productData";
import { text } from "@/lib/serverData";

export async function GET(request) {
  const access = await requireRole(request, ["owner", "admin", "supervisor", "cashier"]);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  const snapshot = await adminDb().collection("shifts").where("staffId", "==", access.user.uid).get();
  const shift = snapshot.docs.map(serializeDoc).find((item) => item.status === "open") || null;
  return NextResponse.json({ shift });
}

export async function POST(request) {
  const access = await requireRole(request, ["owner", "admin", "supervisor", "cashier"]);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  const body = await request.json().catch(() => ({}));
  const store = adminDb();
  if (body.action === "open") {
    const existing = await store.collection("shifts").where("staffId", "==", access.user.uid).get();
    const open = existing.docs.find((doc) => doc.data().status === "open");
    if (open) return NextResponse.json({ shift: serializeDoc(open), existing: true });
    const shiftId = `SHIFT-${Date.now().toString(36).toUpperCase()}`;
    const value = {
      shiftId,
      staffId: access.user.uid,
      staffEmail: access.user.email,
      deviceId: text(body.deviceId, 120),
      status: "open",
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
    const salesSnap = await store.collection("sales").where("shiftId", "==", shiftId).get();
    const sales = salesSnap.docs.map((doc) => doc.data());
    const summary = {
      transactions: sales.length,
      salesTotal: sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0),
      paymentMix: sales.reduce((mix, sale) => ({ ...mix, [sale.paymentMethod || "other"]: (mix[sale.paymentMethod || "other"] || 0) + Number(sale.total || 0) }), {}),
    };
    await ref.update({ status: "closed", endedAt: FieldValue.serverTimestamp(), summary });
    return NextResponse.json({ shift: { ...serializeDoc(snap), status: "closed", summary } });
  }
  return NextResponse.json({ error: "Choose open or close shift." }, { status: 400 });
}
