import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { validateProductRequest, validateRequestQuote, optimizedPhotoBytes } from "../lib/productRequests.mjs";
import { prepareRequestPhoto } from "../lib/requestPhotos.mjs";
const body = { requestId: "47bbd9b4-380d-4123-8bb2-2be59d168a91", productName: "Rack", description: "An adjustable metal rack", name: "Ada", phone: "0207015198", quantity: 2, budget: "250.00", allowAlternatives: false, acknowledged: true };
test("guest requests validate contact, product requirements, optional GHS budget and safe links", () => {
  const request = validateProductRequest(body); assert.equal(request.budget, 250); assert.equal(request.productId, undefined);
  assert.throws(() => validateProductRequest({ ...body, acknowledged: false }), /Confirm/);
  assert.throws(() => validateProductRequest({ ...body, phone: "", email: "" }), /phone number or email/);
  assert.throws(() => validateProductRequest({ ...body, productLink: "javascript:alert(1)" }), /http/);
  assert.throws(() => validateProductRequest({ ...body, budget: "RMB 100" }), /GHS/);
  assert.throws(() => validateProductRequest({ ...body, preferredDate: "2026-02-31" }), /date/);
});
test("quoted status requires exact proposed details and positive GHS price; private notes bounded", () => {
  assert.deepEqual(validateRequestQuote({ status: "new", internalNotes: "Draft", quoteTotal: "", quotation: "" }), { status: "new", internalNotes: "Draft", quoteTotal: null, quotation: "" });
  assert.throws(() => validateRequestQuote({ status: "quoted", quoteTotal: "250", quotation: "" }), /details/);
  assert.throws(() => validateRequestQuote({ status: "quoted", quoteTotal: "-1", quotation: "Rack" }), /GHS/);
  assert.equal(validateRequestQuote({ status: "quoted", quoteTotal: "250.50", quotation: "Black rack, delivery included; arrival to confirm." }).quoteTotal, 250.5);
});
test("photos are re-encoded to bounded WebP with metadata removed; masquerading and oversized files rejected", async () => {
  const png = await sharp({ create: { width: 200, height: 120, channels: 3, background: "#00235b" } }).png().toBuffer();
  const photo = await prepareRequestPhoto(new File([png], "test.png", { type: "image/png" }));
  const metadata = await sharp(Buffer.from(photo.base64, "base64")).metadata();
  assert.equal(metadata.format, "webp"); assert.equal(metadata.exif, undefined); assert.ok(photo.bytes < optimizedPhotoBytes);
  await assert.rejects(() => prepareRequestPhoto(new File([png], "fake.jpg", { type: "image/jpeg" })), /could not be read/);
  await assert.rejects(() => prepareRequestPhoto(new File(["<svg/>"], "test.svg", { type: "image/svg+xml" })), /JPG/);
});
