import test from "node:test";
import assert from "node:assert/strict";
import { changeReviewSummary, moderationValues, publicReview, reviewGroup, reviewSummary, reviewValues, verifiedReviewPurchase } from "../lib/productReviews.mjs";
test("review values are bounded and whitelisted, all honest star ratings supported", () => {
  const input = { rating: 1, publicName: "Ada", title: "", text: "Not the size I expected", status: "published", verifiedPurchase: true };
  assert.deepEqual(reviewValues(input), { rating: 1, publicName: "Ada", title: "", text: input.text });
  for (const patch of [{ rating: 0 }, { rating: 6 }, { rating: 2.5 }, { rating: "5" }, { text: "bad" }, { text: "x".repeat(2001) }, { publicName: "" }]) assert.throws(() => reviewValues({ ...input, ...patch }));
  assert.throws(() => moderationValues({ status: "hidden", reason: "" })); assert.throws(() => moderationValues({ status: "invented" }));
  assert.deepEqual(moderationValues({ status: "published", text: "rewritten" }), { status: "published", reason: "", reply: "" });
});
test("published-only summaries remain consistent through edits, replies, rejection and hiding", () => {
  const pending = { rating: 1, status: "pending" }, published = { ...pending, status: "published" }, five = { rating: 5, status: "published" };
  let value = changeReviewSummary(undefined, null, pending); assert.equal(value.count, 0);
  value = changeReviewSummary(value, pending, published); assert.equal(value.average, 1);
  value = changeReviewSummary(value, null, five); assert.equal(value.count, 2); assert.equal(value.average, 3);
  value = changeReviewSummary(value, five, { ...five, reply: "Thank you" }); assert.equal(value.count, 2);
  value = changeReviewSummary(value, published, pending); assert.equal(value.count, 1); assert.equal(value.average, 5);
  value = changeReviewSummary(value, five, { ...five, status: "hidden" }); assert.deepEqual(value, reviewSummary());
});
test("grouped variants preserve exact purchase verification and public data contains no private identity or moderation", () => {
  const p = { id: "pink", productGroupId: "bottle" };
  assert.equal(reviewGroup(p), reviewGroup({ id: "blue", productGroupId: "bottle" })); assert.notEqual(reviewGroup(p), reviewGroup({ id: "bottle" }));
  const valid = { status: "completed", paymentStatus: "paid", items: [{ productId: "pink", quantity: 1 }] };
  assert.equal(verifiedReviewPurchase([valid], p), true);
  for (const order of [{ ...valid, status: "ready" }, { ...valid, paymentStatus: "pending" }, { ...valid, items: [{ productId: "blue", quantity: 1 }] }, { ...valid, items: [{ productId: "pink", quantity: 0 }] }]) assert.equal(verifiedReviewPurchase([order], p), false);
  const result = publicReview("id", { ...valid, rating: 5, text: "Good", publicName: "Ada", customerUid: "private", email: "private@test", reason: "private", payloadHash: "private" });
  for (const name of ["customerUid", "email", "reason", "payloadHash", "paymentStatus"]) assert.equal(result[name], undefined);
});
