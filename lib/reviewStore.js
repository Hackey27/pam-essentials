import { createHash } from "node:crypto";
import { availableOnStorefront, catalogueContext } from "@/lib/commerce";
import { reviewGroup } from "@/lib/productReviews.mjs";
export const reviewHash = (value) => createHash("sha256").update(value).digest("hex");
export const reviewKey = (product) => reviewHash(reviewGroup(product));
export const reviewId = (key, uid) => reviewHash(`${key}\0${uid}`);
export function validReviewProductId(id) { return typeof id === "string" && id.trim() === id && id.length > 0 && id.length <= 160 && !/[\x00-\x1f]/.test(id); }
export async function reviewProduct(store, id) {
  const [snap, context] = await Promise.all([store.collection("products").doc(encodeURIComponent(id)).get(), catalogueContext(store)]);
  return snap.exists && availableOnStorefront(snap.data(), context) ? { ...snap.data(), id: snap.data().id || id } : null;
}
export const publicReviewCollection = (store, key) => store.collection(`product_review_public/${key}/reviews`);
export const noReviewCache = { "cache-control": "private, no-store" };
