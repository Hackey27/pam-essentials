import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/admin";
import { customerIdentity } from "@/lib/customerAuth";
import { changeReviewSummary, publicReview, reviewValues, verifiedReviewPurchase } from "@/lib/productReviews.mjs";
import { noReviewCache, publicReviewCollection, reviewHash, reviewId, reviewKey, reviewProduct, validReviewProductId } from "@/lib/reviewStore";
import { variantDetail } from "@/lib/variantDisplay.mjs";
export const dynamic = "force-dynamic";
export async function GET(request) {
  const account = await customerIdentity(request); if (account.error) return NextResponse.json({ error: account.error }, { status: account.status });
  const id = new URL(request.url).searchParams.get("productId"); if (!validReviewProductId(id)) return NextResponse.json({ error: "Choose a valid product." }, { status: 400 });
  try {
    const store = adminDb(), product = await reviewProduct(store, id); if (!product) return NextResponse.json({ error: "This product is unavailable." }, { status: 404 });
    const snap = await store.collection("product_reviews").doc(reviewId(reviewKey(product), account.uid)).get();
    return NextResponse.json({ review: snap.exists ? { ...publicReview(snap.id, snap.data()), status: snap.data().status, revision: snap.data().revision, reason: snap.data().reason || "" } : null }, { headers: noReviewCache });
  } catch { return NextResponse.json({ error: "Your review could not be loaded. Retry before submitting." }, { status: 503 }); }
}
export async function POST(request) {
  const account = await customerIdentity(request); if (account.error) return NextResponse.json({ error: account.error }, { status: account.status });
  if (Number(request.headers.get("content-length") || 0) > 16000) return NextResponse.json({ error: "Review is too long." }, { status: 413 });
  let body, values;
  try { body = await request.json(); if (!validReviewProductId(body.productId)) throw new Error("Choose a valid product."); values = reviewValues(body); if (!Number.isInteger(body.revision) || body.revision < 0) throw new Error("Load your latest review before submitting."); }
  catch (error) { return NextResponse.json({ error: error.message }, { status: 400 }); }
  try {
    const store = adminDb(), product = await reviewProduct(store, body.productId); if (!product) return NextResponse.json({ error: "This product is unavailable." }, { status: 404 });
    const orders = await store.collection("orders").where("customerUid", "==", account.uid).get();
    const verifiedPurchase = verifiedReviewPurchase(orders.docs.map((doc) => doc.data()), product);
    const key = reviewKey(product), id = reviewId(key, account.uid), ref = store.collection("product_reviews").doc(id), summaryRef = store.collection("product_review_summaries").doc(key), mirror = publicReviewCollection(store, key).doc(id), limitRef = store.collection("product_review_limits").doc(reviewHash(account.uid));
    const payloadHash = reviewHash(JSON.stringify({ productId: product.id, ...values }));
    const result = await store.runTransaction(async (tx) => {
      const [before, summary, limit] = await Promise.all([tx.get(ref), tx.get(summaryRef), tx.get(limitRef)]), old = before.data();
      if (old?.payloadHash === payloadHash) return { ok: true, duplicate: true, status: old.status };
      if (body.revision !== (old?.revision || 0)) return { error: "Your review changed. Refresh before saving.", status: 409 };
      const now = Date.now(), last = limit.data(), sameWindow = last && now - last.windowStart < 3600000;
      if (sameWindow && last.count >= 5) return { error: "Please wait before submitting more reviews.", status: 429 };
      const stamp = FieldValue.serverTimestamp();
      const next = { ...values, productId: product.id, productName: product.name, sku: product.sku || product.id, variant: variantDetail(product), reviewKey: key, customerUid: account.uid, verifiedPurchase, status: "pending", reason: "", reply: "", replyAt: null, revision: (old?.revision || 0) + 1, payloadHash, createdAt: old?.createdAt || stamp, updatedAt: stamp };
      tx.set(ref, next); tx.set(limitRef, { windowStart: sameWindow ? last.windowStart : now, count: sameWindow ? last.count + 1 : 1 });
      if (old?.status === "published") { tx.delete(mirror); tx.set(summaryRef, { ...changeReviewSummary(summary.data(), old, next), updatedAt: stamp }); }
      return { ok: true, status: "pending" };
    });
    return NextResponse.json(result.error ? { error: result.error } : { ...result, message: result.duplicate ? "Your review is already saved." : "Thank you! Your review has been submitted and is awaiting moderation." }, { status: result.error ? result.status : 200, headers: noReviewCache });
  } catch { return NextResponse.json({ error: "Your review was not confirmed as saved. Please retry." }, { status: 503 }); }
}
