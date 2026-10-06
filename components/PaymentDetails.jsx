import { MOMO_NUMBER, MOMO_MERCHANT_ID } from "@/lib/shop";

export default function PaymentDetails() {
  return <section className="detail-info-card payment-details"><h2>Secure payment</h2><p>Pay on pickup or delivery is available. Online payment is coming soon.</p><h3>Mobile Money</h3><dl><dt>Number</dt><dd>{MOMO_NUMBER}</dd><dt>Merchant ID</dt><dd>{MOMO_MERCHANT_ID}</dd></dl><p>Confirm the amount and recipient with us before sending payment.</p></section>;
}
