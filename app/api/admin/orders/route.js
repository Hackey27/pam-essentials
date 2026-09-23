import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb, requireRole } from "@/lib/admin";
import { auditPayload, text } from "@/lib/serverData";

const statuses = ["pending", "confirmed", "paid", "processing", "ready", "completed", "cancelled"];

export async function POST(request) {
  const access = await requireRole(request, ["owner", "admin", "supervisor", "cashier"]);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  const body = await request.json().catch(() => ({}));
  const orderId = text(body.orderId, 100);
  const status = text(body.status, 30).toLowerCase();
  if (!orderId || !statuses.includes(status)) return NextResponse.json({ error: "Choose a valid order status." }, { status: 400 });

  const store = adminDb();
  try {
    const result = await store.runTransaction(async (tx) => {
      const ref = store.collection("orders").doc(orderId);
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error("Order not found.");
      const order = snap.data();
      const pickupCode = status === "ready" ? order.pickupCode || String(Math.floor(100000 + Math.random() * 900000)) : order.pickupCode || null;
      const paymentStatus = status === "paid" || (status === "completed" && body.confirmPayment) ? "paid" : order.paymentStatus || "pending";
      tx.update(ref, {
        status,
        paymentStatus,
        pickupCode,
        statusHistory: FieldValue.arrayUnion({ status, at: new Date(), by: access.user.uid, email: access.user.email }),
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.create(store.collection("admin_audit").doc(), auditPayload(access.user, "UPDATE_ORDER_STATUS", "order", orderId, `Changed order ${orderId} from ${order.status} to ${status}.`, { status: order.status }, { status, paymentStatus, pickupCode }));
      return { orderId, status, paymentStatus, pickupCode };
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error.message || "Order could not be updated." }, { status: 409 });
  }
}
