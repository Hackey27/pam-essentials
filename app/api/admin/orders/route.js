import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb, requireRole } from "@/lib/admin";
import { auditPayload, text } from "@/lib/serverData";
import { fulfilmentComplete, fulfilmentCounts } from "@/lib/fulfilment.mjs";

const statuses = ["pending", "confirmed", "paid", "processing", "ready", "completed", "cancelled"];

export async function POST(request) {
  const access = await requireRole(request, ["owner", "admin", "supervisor", "cashier"]);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  const body = await request.json().catch(() => ({}));
  const orderId = text(body.orderId, 100);
  const status = text(body.status, 30).toLowerCase();
  const confirmingLine = body.action === "confirm-fulfilment-line";
  const actionId = text(body.actionId, 80);
  if (actionId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(actionId)) return NextResponse.json({ error: "Invalid order action ID." }, { status: 400 });
  if (!orderId || (!confirmingLine && !statuses.includes(status))) return NextResponse.json({ error: "Choose a valid order status." }, { status: 400 });

  const store = adminDb();
  try {
    const result = await store.runTransaction(async (tx) => {
      const ref = store.collection("orders").doc(orderId);
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error("Order not found.");
      const order = snap.data();
      if (actionId && (order.processedActionIds || []).includes(actionId)) return { orderId, status: order.status, paymentStatus: order.paymentStatus, fulfilmentCounts: fulfilmentCounts(order), duplicate: true };
      if (confirmingLine) {
        if (["completed", "cancelled"].includes(order.status)) throw new Error("This order cannot be changed after completion or cancellation.");
        const lineIndex = Number(body.lineIndex);
        const confirmedQuantity = Number(body.confirmedQuantity);
        const items = order.items || [];
        if (!Number.isInteger(lineIndex) || lineIndex < 0 || lineIndex >= items.length || !Number.isInteger(confirmedQuantity) || confirmedQuantity < 0 || confirmedQuantity > Number(items[lineIndex].quantity)) throw new Error("Choose a valid item quantity to confirm.");
        const counts = fulfilmentCounts(order);
        counts[lineIndex] = confirmedQuantity;
        tx.update(ref, { fulfilmentCounts: counts, fulfilmentUpdatedAt: FieldValue.serverTimestamp(), fulfilmentUpdatedBy: access.user.uid, updatedAt: FieldValue.serverTimestamp(), ...(actionId ? { processedActionIds: FieldValue.arrayUnion(actionId) } : {}) });
        tx.create(store.collection("admin_audit").doc(), auditPayload(access.user, "CONFIRM_ORDER_ITEM", "order", orderId, `Confirmed ${confirmedQuantity} of ${items[lineIndex].quantity} for ${items[lineIndex].name || items[lineIndex].productId}.`, { lineIndex, previousQuantity: fulfilmentCounts(order)[lineIndex] }, { lineIndex, confirmedQuantity }));
        return { orderId, fulfilmentCounts: counts, fulfilmentComplete: fulfilmentComplete({ ...order, fulfilmentCounts: counts }) };
      }
      if (status === "completed" && !fulfilmentComplete(order)) throw new Error("Confirm the full quantity of every order item before completing fulfilment.");
      const pickupCode = status === "ready" ? order.pickupCode || String(Math.floor(100000 + Math.random() * 900000)) : order.pickupCode || null;
      const paymentStatus = status === "paid" || (status === "completed" && body.confirmPayment) ? "paid" : order.paymentStatus || "pending";
      const countPurchases = !order.popularityCounted && paymentStatus === "paid";
      const productRefs = countPurchases ? (order.items || []).map((item) => store.collection("products").doc(encodeURIComponent(item.productId))) : [];
      const productSnaps = productRefs.length ? await tx.getAll(...productRefs) : [];
      tx.update(ref, {
        status,
        ...(actionId ? { processedActionIds: FieldValue.arrayUnion(actionId) } : {}),
        paymentStatus,
        popularityCounted: order.popularityCounted === true || countPurchases,
        pickupCode,
        statusHistory: FieldValue.arrayUnion({ status, at: new Date(), by: access.user.uid, email: access.user.email }),
        updatedAt: FieldValue.serverTimestamp(),
      });
      productRefs.forEach((productRef, index) => {
        if (productSnaps[index].exists) tx.update(productRef, { purchaseCount: FieldValue.increment(Number(order.items[index].quantity || 0)) });
      });
      tx.create(store.collection("admin_audit").doc(), auditPayload(access.user, "UPDATE_ORDER_STATUS", "order", orderId, `Changed order ${orderId} from ${order.status} to ${status}.`, { status: order.status }, { status, paymentStatus, pickupCode }));
      return { orderId, status, paymentStatus, pickupCode };
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error.message || "Order could not be updated." }, { status: 409 });
  }
}

