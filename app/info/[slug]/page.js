import Link from "next/link";
import FulfilmentInformation from "@/components/FulfilmentInformation";
import WhatsAppIcon from "@/components/WhatsAppIcon";
import { notFound } from "next/navigation";
import { adminDb } from "@/lib/admin";
import { isGoogleMapsUrl } from "@/lib/location.mjs";
import { CURRENT_SHOP_ADDRESS, currentShopAddress } from "@/lib/shopAddress.mjs";
import { PRIMARY_WHATSAPP, PRIMARY_PHONE_LABEL, SECONDARY_PHONE_LABEL, OPENING_HOURS } from "@/lib/shop";

export const dynamic = "force-dynamic";
const whatsapp = `https://wa.me/${PRIMARY_WHATSAPP}`;

const pages = {
  contact: { title: "Contact Us", body: ["Visit PAM Essentials & More in Awoshie, Accra, Ghana, or contact us about products and orders."] },
  delivery: { title: "Payment & Delivery", body: ["Choose pickup, shop-arranged delivery, or your own courier at checkout. Add your destination for shop-arranged delivery.", "Pay on pickup or delivery is available. Online payment is coming soon."] },
  returns: { title: "Returns & Exchanges", body: ["Please contact us with your order reference and details of the item if you need a return or exchange. We will review the request and explain the available options before you bring or send anything back."] },
  privacy: { title: "Privacy Policy", body: ["We use your checkout details to process and fulfil orders. Customer accounts store the information needed for order tracking and saved wishlists. Essential browser storage keeps your cart and sign-in session available.", "Contact us if you need help with information associated with your order or account."] },
  faqs: { title: "FAQs", body: ["Can I order without an account? Yes. You can check out as a guest. Create a customer account to track orders or save a wishlist.", "Can I order on WhatsApp? Yes. The cart can prepare a message with your chosen products, quantities and totals.", "Can I collect my order? Yes. Pickup is available from Awoshie, Accra, Ghana."] },
  about: { title: "About Us", body: ["PAM Essentials & More brings together school, home, gift and daily essentials in one simple shop in Awoshie, Accra, Ghana."] },
  story: { title: "Our Story", body: ["PAM Essentials & More is built around a straightforward idea: help customers find everyday essentials, then collect them or arrange delivery in the way that suits them."] },
  social: { title: "Follow Us", body: ["Our social profile links will be added here when they are available. For now, contact PAM Essentials & More directly on WhatsApp."] },
};

export function generateStaticParams() {
  return Object.keys(pages).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  return { title: `${pages[slug]?.title || "Information"} | PAM Essentials & More` };
}

export default async function InfoPage({ params }) {
  const { slug } = await params;
  const page = pages[slug];
  if (!page) notFound();
  let location = CURRENT_SHOP_ADDRESS, mapsUrl = "", hours = OPENING_HOURS;
  try {
    const store = adminDb();
    const [addressSnap, mapsSnap, hoursSnap] = await Promise.all(["STORE_LOCATION", "GOOGLE_MAPS_URL", "OPENING_HOURS"].map((key) => store.collection("settings").doc(key).get()));
    location = currentShopAddress(addressSnap.data()?.value);
    mapsUrl = isGoogleMapsUrl(mapsSnap.data()?.value) ? String(mapsSnap.data()?.value || "") : "";
    hours = String(hoursSnap.data()?.value || OPENING_HOURS);
  } catch { /* Keep contact information available if settings are temporarily unavailable. */ }
  const fulfilmentPage = slug === "delivery" || slug === "contact";
  return <main className={`info-page${fulfilmentPage ? " fulfilment-page" : ""}`}>
    <Link className="info-back" href="/">← Back to shop</Link>
    <header className={fulfilmentPage ? "info-hero" : "info-heading"}><p className="eyebrow">PAM Essentials &amp; More</p><h1>{page.title}</h1>{page.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</header>
    {fulfilmentPage && <FulfilmentInformation storeLocation={location} openingHours={hours} mapsUrl={mapsUrl} pickupOnly={slug === "contact"} />}
    {fulfilmentPage && <p className="fulfilment-help">Need help deciding? Message or call our team before you order.</p>}
    <div className="info-contact" id="contact"><a className="button whatsapp" href={whatsapp} target="_blank" rel="noreferrer"><WhatsAppIcon size={18} /> WhatsApp {PRIMARY_PHONE_LABEL}</a><a className={fulfilmentPage ? "button secondary" : ""} href="tel:+233596661439">Call {PRIMARY_PHONE_LABEL}</a><a className={fulfilmentPage ? "button secondary" : ""} href="tel:+233207015198">Call {SECONDARY_PHONE_LABEL}</a></div>
  </main>;
}
