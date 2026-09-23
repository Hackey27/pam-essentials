import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/admin";
import { isSellable } from "@/lib/productData";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const requested = Array.isArray(body.items) ? body.items : [];
  const customer = String(body.customer || "").trim();
  const phone = String(body.phone || "").trim();
  if (!requested.length || !customer || !phone) {
    return NextResponse.json({ error: "Name, phone number and order items are required." }, { status: 400 });
  }

  const store = adminDb();
  const quantities = new Map();
  for (const item of requested) {
    const id = String(item.id || "").trim();
    const quantity = Math.floor(Number(item.quantity));
    const combinedQuantity = (quantities.get(id) || 0) + quantity;
    if (!id || !Number.isFinite(quantity) || quantity < 1 || combinedQuantity > 999) {
      return NextResponse.json({ error: "Each order item needs a valid product and quantity." }, { status: 400 });
    }
    quantities.set(id, combinedQuantity);
  }

  const normalizedItems = [...quantities].map(([id, quantity]) => ({ id, quantity }));
  const productRefs = normalizedItems.map(({ id }) => store.collection("products").doc(encodeURIComponent(id)));
  const productSnaps = await store.getAll(...productRefs);
  const items = [];
  let total = 0;
  for (let index = 0; index < normalizedItems.length; index += 1) {
    const item = normalizedItems[index];
    const snap = productSnaps[index];
    if (!snap.exists || !isSellable(snap.data())) continue;
    const product = snap.data();
    const quantity = item.quantity;
    const lineTotal = Number(product.price) * quantity;
    total += lineTotal;
    items.push({ productId: product.id, name: product.name, quantity, unitPrice: Number(product.price), lineTotal });
  }
  if (!items.length) return NextResponse.json({ error: "No order items are currently available." }, { status: 409 });

  const orderId = `ORD-${Date.now().toString(36).toUpperCase()}`;
  await store.collection("orders").doc(orderId).set({
    orderId,
    customer,
    phone,
    items,
    total: Math.round(total * 100) / 100,
    channel: "website",
    deliveryMethod: body.deliveryMethod || "pickup",
    landmark: String(body.landmark || "").trim(),
    paymentStatus: "pending",
    status: "pending",
    createdAt: FieldValue.serverTimestamp(),
  });
  return NextResponse.json({ orderId, total: Math.round(total * 100) / 100 });
}
