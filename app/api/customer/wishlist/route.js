import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/admin";
import { customerIdentity } from "@/lib/customerAuth";
import { availableForSale, catalogueContext } from "@/lib/commerce";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const account = await customerIdentity(request);
  if (account.error) return NextResponse.json({ error: account.error }, { status: account.status });
  const snap = await adminDb().collection("customer_accounts").doc(account.uid).get();
  return NextResponse.json({ wishlist: snap.exists && Array.isArray(snap.data().wishlist) ? snap.data().wishlist : [] });
}

export async function POST(request) {
  const account = await customerIdentity(request);
  if (account.error) return NextResponse.json({ error: account.error }, { status: account.status });
  const body = await request.json().catch(() => ({}));
  const id = String(body.productId || "").trim();
  if (!id || id.length > 160) return NextResponse.json({ error: "Choose a valid product." }, { status: 400 });
  const store = adminDb();
  const accountRef = store.collection("customer_accounts").doc(account.uid);
  if (body.remove === true) {
    await accountRef.set({ email: account.email, wishlist: FieldValue.arrayRemove(id), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return NextResponse.json({ ok: true });
  }
  const [productSnap, context] = await Promise.all([store.collection("products").doc(encodeURIComponent(id)).get(), catalogueContext(store)]);
  if (!productSnap.exists || !availableForSale(productSnap.data(), context)) return NextResponse.json({ error: "This product is unavailable." }, { status: 404 });
  await accountRef.set({ email: account.email, wishlist: FieldValue.arrayUnion(id), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return NextResponse.json({ ok: true });
}

