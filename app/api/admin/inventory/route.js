import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb, requireRole } from "@/lib/admin";
import { auditPayload, text } from "@/lib/serverData";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const type = body.type === "adjust" ? "adjust" : "receive";
  const access = await requireRole(request, type === "adjust" ? ["owner", "admin"] : ["owner", "admin", "supervisor"]);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  const productId = text(body.productId, 80);
  const quantity = Math.trunc(Number(body.quantity));
  if (!productId || !Number.isFinite(quantity) || quantity === 0 || (type === "receive" && quantity < 1)) {
    return NextResponse.json({ error: "Choose a product and enter a valid quantity." }, { status: 400 });
  }
  const reason = text(body.reason, 160);
  const supplier = text(body.supplier, 160);
  if (type === "adjust" && !reason) return NextResponse.json({ error: "A reason is required for stock adjustments." }, { status: 400 });
  if (type === "receive" && !supplier) return NextResponse.json({ error: "Supplier is required when receiving stock." }, { status: 400 });

  const store = adminDb();
  try {
    const result = await store.runTransaction(async (tx) => {
      const productRef = store.collection("products").doc(encodeURIComponent(productId));
      const productSnap = await tx.get(productRef);
      if (!productSnap.exists) throw new Error("Product not found.");
      const oldStock = Number(productSnap.data().stock || 0);
      const change = type === "receive" ? Math.abs(quantity) : quantity;
      const newStock = oldStock + change;
      if (newStock < 0) throw new Error("This adjustment would take stock below zero.");
      tx.update(productRef, { stock: newStock, updatedAt: FieldValue.serverTimestamp() });
      const movementRef = store.collection("stock_movements").doc();
      tx.create(movementRef, {
        type,
        productId,
        productName: productSnap.data().name,
        quantity: change,
        qtyChange: change,
        oldStock,
        newStock,
        supplier: type === "receive" ? supplier : "",
        reason: type === "adjust" ? reason : "",
        notes: text(body.notes, 1000),
        staff: access.user.uid,
        staffEmail: access.user.email,
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.create(store.collection("admin_audit").doc(), auditPayload(access.user, type === "receive" ? "RECEIVE_STOCK" : "ADJUST_STOCK", "product", productId, `${type === "receive" ? "Received" : "Adjusted"} ${change} units; stock ${oldStock} → ${newStock}.`, { stock: oldStock }, { stock: newStock }));
      return { oldStock, newStock, change };
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error.message || "Stock could not be updated." }, { status: 409 });
  }
}
