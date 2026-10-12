import { validateInquiry } from "./inquiries.mjs";

export const productRequestStatuses = ["new", "checking-availability", "quoted", "closed"];
export const requestPhotoLimit = 5;
export const requestPhotoBytes = 5 * 1024 * 1024;
export const optimizedPhotoBytes = 350 * 1024;
export const requestPhotoTypes = ["image/jpeg", "image/png", "image/webp"];
export const productRequestAcknowledgement = "Thank you! We’ve received your product request. Our team will review it and contact you with availability and pricing.";
const plain = (value, max, label) => {
  if (value == null) return "";
  if (typeof value !== "string" || value.length > max || /[\x00-\x1f\x7f]/.test(value)) throw new Error(`Check ${label}.`);
  return value.trim();
};
export function validateProductRequest(body) {
  const contact = validateInquiry({ ...body, productId: "product-request", message: body?.description });
  const productName = plain(body.productName, 160, "Product name");
  if (!productName) throw new Error("Product name is required.");
  const preferences = plain(body.preferences, 500, "Colour, size or material");
  const productLink = plain(body.productLink, 1000, "Product link");
  if (productLink) { try { if (!/^https?:$/.test(new URL(productLink).protocol)) throw new Error(); } catch { throw new Error("Use a complete http or https product link."); } }
  const budget = plain(body.budget, 30, "Budget");
  if (budget && (!/^\d+(?:\.\d{1,2})?$/.test(budget) || Number(budget) > 10000000)) throw new Error("Use a valid optional budget in GHS.");
  const preferredDate = plain(body.preferredDate, 10, "Preferred date");
  if (preferredDate && (!/^\d{4}-\d{2}-\d{2}$/.test(preferredDate) || Number.isNaN(new Date(preferredDate).getTime()) || new Date(preferredDate).toISOString().slice(0, 10) !== preferredDate)) throw new Error("Choose a valid preferred date.");
  if (typeof body.allowAlternatives !== "boolean" || body.acknowledged !== true) throw new Error("Confirm that this is a quotation request.");
  const { productId, message, ...details } = contact;
  return { ...details, productName, description: message, preferences, productLink, budget: budget ? Number(budget) : null, preferredDate, allowAlternatives: body.allowAlternatives, acknowledged: true };
}
export function productRequestReference(id) { return `PAM-REQ-${id.replaceAll("-", "").slice(0, 12).toUpperCase()}`; }
export function validateRequestQuote(body) {
  if (!productRequestStatuses.includes(body.status)) throw new Error("Choose a valid request status.");
  const internalNotes = String(body.internalNotes || "").trim();
  const quotation = String(body.quotation || "").trim();
  if (internalNotes.length > 3000 || quotation.length > 3000) throw new Error("Use notes of at most 3,000 characters.");
  let quoteTotal = null;
  if (body.quoteTotal !== "" && body.quoteTotal != null) {
    if (!/^[0-9]+(?:\.[0-9]{1,2})?$/.test(String(body.quoteTotal)) || Number(body.quoteTotal) <= 0 || Number(body.quoteTotal) > 10000000) throw new Error("Enter a valid total quote in GHS.");
    quoteTotal = Number(body.quoteTotal);
  }
  if (body.status === "quoted" && (!quotation || quoteTotal == null)) throw new Error("Quoted requests need the proposed product details and a total price.");
  return { status: body.status, internalNotes, quotation, quoteTotal };
}
