export const inquiryStatuses = ["new", "in-progress", "resolved"];
export const inquiryAcknowledgement = "Thank you—your pricing inquiry has been received. Our team will contact you using the details you provided.";

function field(value, max, label, required = false) {
  if (value == null) value = "";
  if (typeof value !== "string" || value.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)) throw new Error(`Check ${label}.`);
  const result = value.trim();
  if (required && !result) throw new Error(`${label} is required.`);
  return result;
}

export function validateInquiry(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Check your inquiry details.");
  const requestId = field(body.requestId, 36, "Inquiry reference", true);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) throw new Error("Reload the inquiry form and try again.");
  const productId = field(body.productId, 160, "Product", true);
  const name = field(body.name, 120, "Name", true);
  const phone = field(body.phone, 25, "Phone number");
  const email = field(body.email, 254, "Email").toLowerCase();
  if (!phone && !email) throw new Error("Enter a phone number or email so we can reply.");
  if (phone && (!/^\+?[0-9 ()-]{7,25}$/.test(phone) || phone.replace(/\D/g, "").length < 7)) throw new Error("Enter a valid phone number.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
  const measurements = field(body.measurements, 500, "Measurements");
  const message = field(body.message, 2000, "Message", true);
  const quantity = Number(body.quantity ?? 1);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) throw new Error("Quantity must be between 1 and 999.");
  if (body.website) throw new Error("The inquiry could not be submitted.");
  return { requestId: requestId.toLowerCase(), productId, name, phone, email, measurements, message, quantity };
}

export function inquiryReference(requestId) {
  return `PAM-INQ-${requestId.replaceAll("-", "").slice(0, 12).toUpperCase()}`;
}
