"use client";

import BrandLogo from "@/components/BrandLogo";
import { PRIMARY_WHATSAPP, PRIMARY_PHONE_LABEL, SECONDARY_PHONE_LABEL } from "@/lib/shop";
import { CURRENT_SHOP_ADDRESS } from "@/lib/shopAddress.mjs";

export default function CustomerFooter({ storeLocation = CURRENT_SHOP_ADDRESS, mapsUrl = "", dealsActive = false, idPrefix = "" }) {
  const sectionId = (name) => idPrefix ? `${idPrefix}-${name}` : name;
  return <>
      <section className="why-shop" id={sectionId("services")} aria-labelledby={sectionId("why-shop-title")}><div><p className="eyebrow">Why shop with PAM?</p><h2 id={sectionId("why-shop-title")}>Everyday shopping made easier</h2></div><ul><li>✓ Affordable everyday essentials</li><li>✓ Convenient ordering</li><li>✓ Pickup or delivery</li><li>✓ WhatsApp ordering</li></ul></section>
      <footer className="store-footer" id={sectionId("delivery")}>
        <div className="footer-grid" id={sectionId("store-footer")}>
          <div className="footer-brand"><BrandLogo background="navy" /><p>School, home, gifts and daily essentials in one simple shop.</p><p className="footer-payment">Secured payment: Online payment is coming soon. Pay on pickup or delivery is available.</p></div>
          <nav aria-label="Shop links"><h2>Shop</h2><a href="/?from=footer#catalogue">All Products</a><a href="/?from=footer#catalogue">Categories</a>{dealsActive && <a href="/?browse=deals&from=footer#catalogue">Deals</a>}<a href="/?browse=new&from=footer#catalogue">New Arrivals</a></nav>
          <nav aria-label="Customer service links"><h2>Customer Service</h2><a href="/info/contact?from=footer">Contact Us</a><a href={`https://wa.me/${PRIMARY_WHATSAPP}`} target="_blank" rel="noreferrer">WhatsApp</a><a href="/account?from=footer#orders">Track My Order</a><a href="/info/delivery?from=footer">Delivery Information</a><a href="/info/returns?from=footer">Returns &amp; Exchanges</a><a href="/info/privacy?from=footer">Privacy Policy</a><a href="/info/faqs?from=footer">FAQs</a></nav>
          <div className="footer-contact"><h2>Contact</h2><p>{storeLocation}</p>{mapsUrl && <a href={mapsUrl} target="_blank" rel="noreferrer">View on Google Maps</a>}<a href="tel:+233596661439">{PRIMARY_PHONE_LABEL}</a><a href="tel:+233207015198">{SECONDARY_PHONE_LABEL}</a></div>
          <nav aria-label="About PAM links"><h2>About PAM</h2><a href="/info/about?from=footer">About Us</a><a href="/info/story?from=footer">Our Story</a></nav>
          <nav aria-label="Social links"><h2>Follow Us</h2><a href="https://www.facebook.com/share/1HM5dDyhHT/" target="_blank" rel="noreferrer">Facebook</a><a href="/info/social?platform=Instagram&from=footer">Instagram</a><a href="/info/social?platform=TikTok&from=footer">TikTok</a></nav>
        </div>
        <p className="footer-bottom">© 2026 PAM Essentials &amp; More</p>
      </footer>
  </>;
}
