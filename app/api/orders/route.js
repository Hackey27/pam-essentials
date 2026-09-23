import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/admin";
import { availableForSale, catalogueContext, resolveDiscount } from "@/lib/commerce";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const requested = Array.isArray(body.items) ? body.items : [];
  const customer = String(body.customer || "").trim();
  const phone = String(body.phone || "").trim();
  if (!requested.length || !customer || !phone) {
    return NextResponse.json({ error: "Name, phone number and order items are required." }, { status: 400 });
  }

  const store = adminDb();
  const context = await catalogueContext(store);
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
  let subtotal = 0;
  let discount = 0;
  for (let index = 0; index < normalizedItems.length; index += 1) {
    const item = normalizedItems[index];
    const snap = productSnaps[index];
    if (!snap.exists || !availableForSale(snap.data(), context.activeCategoryIds)) {
      return NextResponse.json({ error: "A selected product is no longer available." }, { status: 409 });
    }
    const product = snap.data();
    const quantity = item.quantity;
    if (Number(product.stock) < quantity) {
      return NextResponse.json({ error: `Only ${product.stock} × ${product.name} remain.` }, { status: 409 });
    }
    const lineTotal = Number(product.price) * quantity;
    const applied = resolveDiscount(product, quantity, context.rules);
    subtotal += lineTotal;
    discount += applied.amount;
    items.push({
      productId: product.id,
      name: product.name,
      quantity,
      unitPrice: Number(product.price),
      lineTotal: Math.round((lineTotal - applied.amount) * 100) / 100,
      categorySnapshot: { id: product.categoryId, name: product.category },
      discountRuleSnapshot: applied.rule ? { ruleId: applied.rule.ruleId, name: applied.rule.name, amount: applied.amount } : null,
    });
  }
  const orderId = `ORD-${Date.now().toString(36).toUpperCase()}`;
  const total = Math.round((subtotal - discount) * 100) / 100;
  await store.collection("orders").doc(orderId).set({
    orderId,
    customer,
    phone,
    items,
    subtotal: Math.round(subtotal * 100) / 100,
    discount: Math.round(discount * 100) / 100,
    total,
    channel: "website",
    deliveryMethod: body.deliveryMethod || "pickup",
    landmark: String(body.landmark || "").trim(),
    paymentStatus: "pending",
    status: "pending",
    statusHistory: [{ status: "pending", at: new Date(), by: "customer" }],
    createdAt: FieldValue.serverTimestamp(),
  });
  return NextResponse.json({ orderId, total });
}
