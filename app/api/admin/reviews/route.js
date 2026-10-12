import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb, requireRole } from "@/lib/admin";
import { auditPayload } from "@/lib/serverData";
import { changeReviewSummary, moderationValues, publicReview, reviewDate } from "@/lib/productReviews.mjs";
import { noReviewCache, publicReviewCollection } from "@/lib/reviewStore";
export const dynamic = "force-dynamic";
const valid = (id) => /^[a-f0-9]{64}$/.test(id || "");
export async function GET(request) {
  const access = await requireRole(request, ["owner", "admin"]); if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  try {
    const store = adminDb(), cursor = new URL(request.url).searchParams.get("cursor"); let query = store.collection("product_reviews").orderBy("updatedAt", "desc").limit(101);
    if (cursor) { if (!valid(cursor)) return NextResponse.json({ error: "Refresh the review list." }, { status: 400 }); const snap = await store.collection("product_reviews").doc(cursor).get(); if (!snap.exists) return NextResponse.json({ error: "Refresh the review list." }, { status: 409 }); query = query.startAfter(snap); }
    const result = await query.get(), page = result.docs.slice(0, 100);
    return NextResponse.json({ reviews: page.map((doc) => { const v = doc.data(); return { ...publicReview(doc.id, v), productId: v.productId, sku: v.sku, status: v.status, reason: v.reason, revision: v.revision, moderatedBy: v.moderatedBy || "", moderatedAt: reviewDate(v.moderatedAt) }; }), nextCursor: result.docs.length > 100 ? page.at(-1).id : null, updatedAt: new Date().toISOString() }, { headers: noReviewCache });
  } catch { return NextResponse.json({ error: "Reviews could not be loaded. Please retry." }, { status: 503 }); }
}
export async function POST(request) {
  const access = await requireRole(request, ["owner", "admin"]); if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  let body, values;
  try { body = await request.json(); if (!valid(body.id) || !Number.isInteger(body.revision)) throw new Error("Refresh and choose a valid review."); values = moderationValues(body); }
  catch (error) { return NextResponse.json({ error: error.message }, { status: 400 }); }
  try {
    const store = adminDb(), ref = store.collection("product_reviews").doc(body.id);
    const result = await store.runTransaction(async (tx) => {
      const before = await tx.get(ref); if (!before.exists) return { error: "Review not found.", status: 404 };
      const old = before.data(); if (old.revision !== body.revision) return { error: "This review changed. Refresh before moderating.", status: 409 };
      const summaryRef = store.collection("product_review_summaries").doc(old.reviewKey), summary = await tx.get(summaryRef), stamp = FieldValue.serverTimestamp();
      const next = { ...old, ...values, revision: old.revision + 1, updatedAt: stamp, moderatedAt: stamp, moderatedBy: access.user.displayName, replyAt: values.reply ? stamp : null };
      tx.update(ref, { ...values, revision: next.revision, updatedAt: stamp, moderatedAt: stamp, moderatedBy: access.user.displayName, replyAt: next.replyAt });
      const mirror = publicReviewCollection(store, old.reviewKey).doc(body.id);
      if (values.status === "published") tx.set(mirror, { ...publicReview(body.id, { ...next, createdAt: old.createdAt }), createdAt: old.createdAt, updatedAt: stamp, replyAt: next.replyAt }); else tx.delete(mirror);
      tx.set(summaryRef, { ...changeReviewSummary(summary.data(), old, next), updatedAt: stamp });
      tx.create(store.collection("admin_audit").doc(), auditPayload(access.user, "MODERATE_PRODUCT_REVIEW", "review", body.id, `Review ${values.status}. ${values.reason}`, { status: old.status, reply: old.reply || "" }, values));
      return { ok: true };
    });
    return NextResponse.json(result.error ? { error: result.error } : result, { status: result.status || 200, headers: noReviewCache });
  } catch { return NextResponse.json({ error: "Moderation was not confirmed as saved. Refresh and retry." }, { status: 503 }); }
}
