export const pricingInquiryLabel = "Request a measurement-based quote";

export function hasSellingPrice(product) {
  return Number.isFinite(Number(product?.price)) && Number(product.price) > 0;
}

export function requiresPricingInquiry(product) {
  return product?.contactForPrice === true && !hasSellingPrice(product);
}
