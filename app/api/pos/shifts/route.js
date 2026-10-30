import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb, requireRole } from "@/lib/admin";
import { serializeDoc } from "@/lib/productData";
import { text } from "@/lib/serverData";
import { auditPayload } from "@/lib/serverData";
import { cashCents, cashPosition } from "@/lib/posOperations.mjs";
import { randomUUID } from "node:crypto";
import { shiftTimestamp } from "@/lib/posTime.mjs";

export async function GET(request) {
  const access = await requireRole(request, ["owner", "admin", "supervisor", "cashier"]);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  const snapshot = await adminDb().collection("shifts").where("staffId", "==", access.user.uid).get();
  const shift = snapshot.docs.map((doc) => ({ ...serializeDoc(doc), startedAt: shiftTimestamp(doc.data().startedAt) })).find((item) => item.status === "open") || null;
  return NextResponse.json({ shift: shift ? { ...shift, staffName: access.user.displayName } : null });
}

export async function POST(request) {
  const access = await requireRole(request, ["owner", "admin", "supervisor", "cashier"]);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  const body = await request.json().catch(() => ({}));
  const store = adminDb();
  if (body.action === "open") {
    let openingCash;
    try { openingCash = cashCents(body.openingCash ?? 0) / 100; } catch (e) { return NextResponse.json({ error: e.message }, { status: 400 }); }
    const existing = await store.collection("shifts").where("staffId", "==", access.user.uid).get();
    const open = existing.docs.find((doc) => doc.data().status === "open");
    if (open) return NextResponse.json({ shift: { ...serializeDoc(open), staffName: access.user.displayName, startedAt: shiftTimestamp(open.data().startedAt) }, existing: true });
    const shiftId = `SHIFT-${randomUUID()}`;
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
      openingCash,
      cashLedgerVersion: 1,
      cashExpenses: 0,
      cashMovementNet: 0,
      startedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    };
    const lock = store.collection("staff_shift_locks").doc(access.user.uid);
    const result = await store.runTransaction(async tx => {
      const pointer = await tx.get(lock);
      const current = pointer.exists && pointer.data().shiftId ? await tx.get(store.collection("shifts").doc(pointer.data().shiftId)) : null;
      if (current?.exists && current.data().status === "open") return { ...serializeDoc(current), startedAt: shiftTimestamp(current.data().startedAt) };
      tx.create(store.collection("shifts").doc(shiftId), value);
      tx.set(lock, { staffId: access.user.uid, shiftId });
      tx.create(store.collection("admin_audit").doc(), auditPayload(access.user, "OPEN_POS_SHIFT", "shift", shiftId, "Recorded opening cash float.", null, { openingCash, deviceId: value.deviceId }));
      return { shiftId };
    });
    const saved = await store.collection("shifts").doc(result.shiftId || result.id).get();
    return NextResponse.json({ shift: { ...serializeDoc(saved), staffName: access.user.displayName, startedAt: shiftTimestamp(saved.data().startedAt) } });
  }

  if (body.action === "close") {
    let countedCash;
    try { countedCash = cashCents(body.countedCash) / 100; } catch (e) { return NextResponse.json({ error: e.message }, { status: 400 }); }
    const shiftId = text(body.shiftId, 120);
    const ref = store.collection("shifts").doc(shiftId);
    const snap = await ref.get();
    if (!snap.exists || snap.data().staffId !== access.user.uid || snap.data().status !== "open") return NextResponse.json({ error: "Open shift not found." }, { status: 404 });
    let summary;
    try {
      await store.runTransaction(async (tx) => {
        const latest = await tx.get(ref);
        if (!latest.exists || latest.data().status !== "open" || latest.data().staffId !== access.user.uid) throw new Error("This shift has already ended.");
        const legacyExpenses = latest.data().cashLedgerVersion === 1 ? [] : (await tx.get(store.collection("expenses").where("shiftId", "==", shiftId))).docs.map(d => d.data());
        const legacySales = latest.data().aggregationVersion === 1 ? [] : (await tx.get(store.collection("sales").where("shiftId", "==", shiftId))).docs.map(d => d.data());
        const finalSummary = latest.data().aggregationVersion === 1 ? { transactions: Number(latest.data().transactionCount || 0), salesTotal: Number(latest.data().salesTotal || 0), paymentMix: latest.data().paymentMix || {} } : { transactions: legacySales.filter(s => s.saleType !== "reversal").length, salesTotal: legacySales.reduce((n,s)=>n+Number(s.total||0),0), paymentMix: legacySales.reduce((mix,s)=>({...mix,[s.paymentMethod||"cash"]:(mix[s.paymentMethod||"cash"]||0)+Number(s.total||0)}),{}) };
        const position = cashPosition({ ...latest.data(), paymentMix: finalSummary.paymentMix }, legacyExpenses);
        if (!position.openingRecorded) throw new Error("Record the opening cash in Shift cash before closing this legacy shift.");
        const variance = Math.round((countedCash - position.expectedCash) * 100) / 100;
        const varianceReason = text(body.varianceReason, 500);
        if (variance !== 0 && !varianceReason) throw new Error("Explain the difference between expected and counted cash.");
        finalSummary.cashReconciliation = { ...position, countedCash, variance, varianceReason };
        finalSummary.reversals = Number(latest.data().reversalCount || 0);
        summary = finalSummary;
        tx.update(ref, { status: "closed", endedAt: FieldValue.serverTimestamp(), summary: finalSummary });
        tx.create(store.collection("admin_audit").doc(), auditPayload(access.user, "CLOSE_POS_SHIFT", "shift", shiftId, varianceReason || "Cash count matched.", null, finalSummary));
      });
    } catch (error) { return NextResponse.json({ error: error.message || "Shift could not be ended." }, { status: 409 }); }
    return NextResponse.json({ shift: { ...serializeDoc(snap), status: "closed", endedAt: new Date().toISOString(), summary } });
  }
  return NextResponse.json({ error: "Choose open or close shift." }, { status: 400 });
}
