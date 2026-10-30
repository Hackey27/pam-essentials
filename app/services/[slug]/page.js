import {notFound} from "next/navigation";
import ServicesContent from "@/components/ServicesContent";
import {pamServices} from "@/lib/services.mjs";
export function generateStaticParams(){return pamServices.map(({slug})=>({slug}));}
export async function generateMetadata({params}){const {slug}=await params;return {title:`${pamServices.find(s=>s.slug===slug)?.title||"Services"} | PAM Essentials & More`};}
export default async function ServicePage({params}){const {slug}=await params;const service=pamServices.find(s=>s.slug===slug);if(!service)notFound();return <ServicesContent service={service}/>;}
