"use client";

import { pricingInquiryLabel } from "@/lib/productPricing.mjs";

export default function PricingInquiryButton({ product, className = "" }) {
  return <button type="button" className={`button pricing-inquiry-button ${className}`} onClick={() => window.dispatchEvent(new CustomEvent("pam-open-pricing-inquiry", { detail: { product } }))}>{pricingInquiryLabel}</button>;
}
