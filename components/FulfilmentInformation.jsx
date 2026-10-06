import PaymentDetails from "@/components/PaymentDetails";
import { CURRENT_SHOP_ADDRESS } from "@/lib/shopAddress.mjs";
import { OPENING_HOURS } from "@/lib/shop";

export default function FulfilmentInformation({ storeLocation = CURRENT_SHOP_ADDRESS, openingHours = OPENING_HOURS, mapsUrl = "", pickupOnly = false }) {
  return <div className={`fulfilment-layout${pickupOnly ? " pickup-only" : ""}`}>
    {!pickupOnly && <section className="fulfilment-options" aria-label="Delivery and pickup options">
      <article className="fulfilment-card"><span className="fulfilment-step" aria-hidden="true">1</span><h2>Shop pickup</h2><p>Choose pickup at checkout and collect your order from PAM.</p><p>Keep your order reference handy when collecting.</p></article>
      <article className="fulfilment-card"><span className="fulfilment-step" aria-hidden="true">2</span><h2>Shop-arranged delivery</h2><p>Choose delivery and enter your destination at checkout.</p><p>Our team will confirm delivery arrangements and any delivery charge with you.</p></article>
      <article className="fulfilment-card"><span className="fulfilment-step" aria-hidden="true">3</span><h2>Your own courier</h2><p>Arrange a courier to collect from the shop.</p><p>The shop collection address is included with your order and receipt.</p></article>
    </section>}
    <div className="fulfilment-details"><section className="fulfilment-card pickup-card" id="location"><p className="eyebrow">Visit PAM</p><h2>Pickup location</h2><address>{storeLocation}</address><dl><dt>Opening hours</dt><dd>{openingHours}</dd><dt>Collection</dt><dd>Shop pickup or your own courier</dd></dl>{mapsUrl && <a className="button secondary" href={mapsUrl} target="_blank" rel="noreferrer">Open in Google Maps ↗</a>}</section>{!pickupOnly && <PaymentDetails />}</div>
  </div>;
}
