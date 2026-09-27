import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/admin";
import { customerIdentity, optionalCustomerIdentity } from "@/lib/customerAuth";
import { availableForSale, catalogueContext, resolveDiscount } from "@/lib/commerce";
import { deliveryMethods, SHOP_ADDRESS } from "@/lib/shop";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const account = await customerIdentity(request);
  if (account.error) return NextResponse.json({ error: account.error }, { status: account.status });
  const url = new URL(request.url);
  const orderId = String(url.searchParams.get("reference") || "").trim().toUpperCase();
  const store = adminDb();
  const snaps = orderId ? [await store.collection("orders").doc(orderId).get()] : (await store.collection("orders").where("customerUid", "==", account.uid).get()).docs;
  const orders = snaps.filter((snap) => snap.exists && snap.data().customerUid === account.uid).map((snap) => {
    const order = snap.data();
    return { orderId: snap.id, status: order.status, paymentStatus: order.paymentStatus, deliveryMethod: order.deliveryMethod, originAddress: order.originAddress || "", deliveryAddress: order.deliveryAddress || "", total: Number(order.total || 0), pickupCode: order.pickupCode || null, items: (order.items || []).map(({ name, quantity, sku, colour, size }) => ({ name, quantity, sku, colour, size })), createdAt: order.createdAt?.toDate?.()?.toISOString?.() || null, updatedAt: order.updatedAt?.toDate?.()?.toISOString?.() || null };
  }).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  if (orderId) return orders[0] ? NextResponse.json({ order: orders[0] }) : NextResponse.json({ error: "This order is not linked to your account." }, { status: 404 });
  return NextResponse.json({ orders });
}

export async function POST(request) {
  const account = await optionalCustomerIdentity(request);
  if (account.error) return NextResponse.json({ error: account.error }, { status: account.status });
  const body = await request.json().catch(() => ({}));
  const requested = Array.isArray(body.items) ? body.items : [];
  const customer = String(body.customer || "").trim();
  const phone = String(body.phone || "").trim();
  if (!requested.length || !customer || !phone) {
    return NextResponse.json({ error: "Name, phone number and order items are required." }, { status: 400 });
  }
  const deliveryMethod = String(body.deliveryMethod || "pickup");
  const deliveryAddress = String(body.deliveryAddress || body.landmark || "").trim().slice(0, 500);
  if (!deliveryMethods.includes(deliveryMethod) || (deliveryMethod === "delivery-shop" && !deliveryAddress)) return NextResponse.json({ error: "Choose a valid fulfilment method and delivery address." }, { status: 400 });

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
  const cartQuantity = normalizedItems.reduce((sum, item) => sum + item.quantity, 0);
  const productRefs = normalizedItems.map(({ id }) => store.collection("products").doc(encodeURIComponent(id)));
  const productSnaps = await store.getAll(...productRefs);
  const items = [];
  let subtotal = 0;
  let discount = 0;
  for (let index = 0; index < normalizedItems.length; index += 1) {
    const item = normalizedItems[index];
    const snap = productSnaps[index];
    if (!snap.exists || !availableForSale(snap.data(), context)) {
      return NextResponse.json({ error: "A selected product is no longer available." }, { status: 409 });
    }
    const product = snap.data();
    const quantity = item.quantity;
    if (Number(product.stock) < quantity) {
      return NextResponse.json({ error: `Only ${product.stock} × ${product.name} remain.` }, { status: 409 });
    }
    const lineTotal = Number(product.price) * quantity;
    const applied = resolveDiscount(product, quantity, context.rules, new Date(), cartQuantity);
    subtotal += lineTotal;
    discount += applied.amount;
    items.push({
      productId: product.id,
      productGroupId: product.productGroupId || "",
      variantId: product.productGroupId ? product.id : "",
      sku: product.id,
      colour: product.colour || "",
      size: product.size || "",
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
    customerUid: account.uid,
    items,
    subtotal: Math.round(subtotal * 100) / 100,
    discount: Math.round(discount * 100) / 100,
    total,
    channel: body.channel === "whatsapp" ? "whatsapp" : "website",
    deliveryMethod,
    originAddress: SHOP_ADDRESS,
    deliveryAddress: deliveryMethod === "pickup" ? "" : deliveryAddress,
    landmark: deliveryMethod === "pickup" ? "" : deliveryAddress,
    paymentStatus: "pending",
    status: "pending",
    statusHistory: [{ status: "pending", at: new Date(), by: "customer" }],
    createdAt: FieldValue.serverTimestamp(),
  });
  return NextResponse.json({ orderId, total });
}

