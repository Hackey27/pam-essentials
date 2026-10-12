export const reviewStatuses = ["pending", "published", "rejected", "hidden"];
export const reviewGroup = (product) => product.productGroupId ? `group:${product.productGroupId}` : `product:${product.id}`;
const clean = (value, max, label, required = false) => {
  if (typeof value !== "string" || value.trim().length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) throw new Error(`Check ${label}.`);
  const result = value.trim(); if (required && !result) throw new Error(`Enter ${label}.`); return result;
};
export function reviewValues(body) {
  if (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5) throw new Error("Choose a rating from 1 to 5 stars.");
  const text = clean(body.text, 2000, "your review", true);
  if (text.length < 5) throw new Error("Please write at least 5 characters about the product.");
  return { rating: body.rating, text, title: clean(body.title ?? "", 120, "the review title"), publicName: clean(body.publicName, 80, "your public display name", true) };
}
export function moderationValues(body) {
  if (!reviewStatuses.includes(body.status)) throw new Error("Choose a review status.");
  const reason = clean(body.reason ?? "", 500, "the moderation reason");
  if (["hidden", "rejected"].includes(body.status) && !reason) throw new Error("Enter a reason for hiding or rejecting this review.");
  return { status: body.status, reason, reply: clean(body.reply ?? "", 2000, "the PAM reply") };
}
export function reviewSummary(value = {}) {
  const ratingCounts = Object.fromEntries([1, 2, 3, 4, 5].map((star) => [star, Math.max(0, Math.floor(Number(value.ratingCounts?.[star]) || 0))]));
  const count = Object.values(ratingCounts).reduce((sum, n) => sum + n, 0);
  const total = Object.entries(ratingCounts).reduce((sum, [star, n]) => sum + Number(star) * n, 0);
  return { ratingCounts, count, average: count ? Math.round(total / count * 10) / 10 : 0 };
}
export function changeReviewSummary(summary, before, after) {
  const { ratingCounts } = reviewSummary(summary);
  for (const [review, delta] of [[before, -1], [after, 1]]) if (review?.status === "published" && Number.isInteger(review.rating) && review.rating >= 1 && review.rating <= 5) ratingCounts[review.rating] = Math.max(0, ratingCounts[review.rating] + delta);
  return reviewSummary({ ratingCounts });
}
export function verifiedReviewPurchase(orders, product) {
  return orders.some((order) => order.status === "completed" && order.paymentStatus === "paid" && (order.items || []).some((item) => Number(item.quantity) > 0 && item.productId === product.id));
}
export const reviewDate = (value) => value?.toDate?.()?.toISOString?.() || value || null;
export function publicReview(id, value) {
  return { id, rating: value.rating, title: value.title || "", text: value.text, publicName: value.publicName, variant: value.variant || "", productName: value.productName, verifiedPurchase: value.verifiedPurchase === true, reply: value.reply || "", createdAt: reviewDate(value.createdAt), updatedAt: reviewDate(value.updatedAt), replyAt: reviewDate(value.replyAt) };
}
