import Link from "next/link";
import ServiceIcon from "./ServiceIcon";
import WhatsAppIcon from "./WhatsAppIcon";
import {pamServices} from "@/lib/services.mjs";
import {PRIMARY_PHONE_LABEL,PRIMARY_WHATSAPP} from "@/lib/shop";
export default function ServicesContent({service}){
 return <main className="info-page services-page"><Link className="info-back" href={service?"/services":"/"}>← {service?"All services":"Back to shop"}</Link>
 <header className="services-title-band"><span className="service-title-icon"><ServiceIcon kind={service?.slug}/></span><div><p>PAM Essentials &amp; More</p><h1>{service?.title||"Services"}</h1></div></header>
 {service?<section className="service-offerings"><p>{service.description}</p>{service.items.length>0&&<ul>{service.items.map((item,index)=><li key={item}><span className="service-offering-number">{String(index+1).padStart(2,"0")}</span><span>{item}</span></li>)}</ul>}{service.url&&<a className="button primary" href={service.url} target="_blank" rel="noopener noreferrer">Visit Hack-Key Tech ↗</a>}</section>:<section className="services-card-grid" aria-label="Our services">{pamServices.map(item=><Link href={"/services/"+item.slug} className="service-choice-card" key={item.slug}><span className="service-card-icon"><ServiceIcon kind={item.slug}/></span><h2>{item.title}</h2><p>{item.description}</p><span className="service-explore">Explore service →</span></Link>)}</section>}
 <section className="services-contact-card"><h2>Contact us if you need any of these services.</h2><p>Tell us what you need and our team will help you with the next steps.</p><div><a className="button primary" href="tel:+233596661439">Call {PRIMARY_PHONE_LABEL}</a><a className="button secondary" href={"https://wa.me/"+PRIMARY_WHATSAPP} target="_blank" rel="noopener noreferrer"><WhatsAppIcon size={20}/> WhatsApp us</a></div></section>
 </main>;
}
