import { NextResponse } from "next/server";
import { adminDb } from "@/lib/admin";
import { publicReview, reviewSummary } from "@/lib/productReviews.mjs";
import { noReviewCache, publicReviewCollection, reviewKey, reviewProduct, validReviewProductId } from "@/lib/reviewStore";
export const dynamic = "force-dynamic";
export async function GET(request) {
  const params = new URL(request.url).searchParams, productId = params.get("productId"), cursor = params.get("cursor");
  if (!validReviewProductId(productId) || cursor && !/^[a-f0-9]{64}$/.test(cursor)) return NextResponse.json({ error: "Choose a valid product or refresh reviews." }, { status: 400 });
  try {
    const store = adminDb(), product = await reviewProduct(store, productId);
    if (!product) return NextResponse.json({ error: "This product is unavailable." }, { status: 404 });
    const key = reviewKey(product), collection = publicReviewCollection(store, key);
    let query = collection.orderBy("createdAt", "desc").limit(21);
    if (cursor) { const snap = await collection.doc(cursor).get(); if (!snap.exists) return NextResponse.json({ error: "Reviews changed. Refresh the list." }, { status: 409 }); query = query.startAfter(snap); }
    const [result, summary] = await Promise.all([query.get(), store.collection("product_review_summaries").doc(key).get()]);
    const page = result.docs.slice(0, 20);
    return NextResponse.json({ reviews: page.map((doc) => publicReview(doc.id, doc.data())), summary: reviewSummary(summary.data()), nextCursor: result.docs.length > 20 ? page.at(-1).id : null }, { headers: noReviewCache });
  } catch { return NextResponse.json({ error: "Reviews could not be loaded. Please retry." }, { status: 503 }); }
}
