import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/admin";
import { availableForSale, catalogueContext } from "@/lib/commerce";

export async function POST(request) {
  if (process.env.STORE_PUBLIC !== "true") return NextResponse.json({ recorded: false });
  const body = await request.json().catch(() => ({}));
  const productId = String(body.productId || "").trim();
  const visitorId = String(body.visitorId || "").trim();
  if (!productId || productId.length > 100 || !/^[0-9a-f-]{36}$/i.test(visitorId)) {
    return NextResponse.json({ error: "Invalid engagement event." }, { status: 400 });
  }
  const store = adminDb();
  const context = await catalogueContext(store);
  const productRef = store.collection("products").doc(encodeURIComponent(productId));
  const day = new Date().toISOString().slice(0, 10);
  const eventRef = store.collection("product_clicks").doc(`${day}-${encodeURIComponent(productId)}-${visitorId}`);
  const recorded = await store.runTransaction(async (tx) => {
    const [product, event] = await tx.getAll(productRef, eventRef);
    if (!product.exists || !availableForSale(product.data(), context) || event.exists) return false;
    tx.create(eventRef, { productId, day, createdAt: FieldValue.serverTimestamp() });
    tx.update(productRef, { clickCount: FieldValue.increment(1) });
    return true;
  });
  return NextResponse.json({ recorded });
}

