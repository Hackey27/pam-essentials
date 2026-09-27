import Link from "next/link";
import { notFound } from "next/navigation";

const phone = "+233 20 701 5198";
const whatsapp = "https://wa.me/233207015198";

const pages = {
  contact: { title: "Contact Us", body: ["Visit PAM Essentials & More in Awoshie, Accra, Ghana, or contact us about products and orders."] },
  delivery: { title: "Payment & Delivery", body: ["Choose pickup, shop-arranged delivery, or your own courier at checkout. For self-arranged delivery, your courier collects from PAM Essentials & More, Awoshie, Accra, Ghana. Add your destination for shop-arranged delivery.", "Pay on pickup or delivery is available. Online payment is coming soon."] },
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
  return <main className="info-page"><Link className="info-back" href="/">← Back to shop</Link><p className="eyebrow">PAM Essentials &amp; More</p><h1>{page.title}</h1>{page.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}<div className="info-contact"><a className="button whatsapp" href={whatsapp} target="_blank" rel="noreferrer">WhatsApp us</a><a href={`tel:${phone.replace(/\s/g, "")}`}>{phone}</a></div></main>;
}

