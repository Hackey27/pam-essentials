import Link from "next/link";
import { notFound } from "next/navigation";

const services = {
  secretarial: "Secretarial services",
  printing: "Printing",
  communication: "Communication consultancy",
  "laptop-repairs": "Laptop repairs and purchases",
};

export function generateStaticParams() { return Object.keys(services).map((slug) => ({ slug })); }
export async function generateMetadata({ params }) {
  const { slug } = await params;
  return { title: `${services[slug] || "Services"} | PAM Essentials & More` };
}

export default async function ServicePage({ params }) {
  const { slug } = await params;
  if (!services[slug]) notFound();
  return <main className="info-page"><Link className="info-back" href="/">← Back to shop</Link><p className="eyebrow">PAM Essentials &amp; More Services</p><h1>{services[slug]}</h1><p className="service-coming-soon">Coming soon!</p></main>;
}
