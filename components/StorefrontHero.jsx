"use client";

import { useLayoutEffect, useRef, useState } from "react";
import WhatsAppIcon from "@/components/WhatsAppIcon";
import { PRIMARY_WHATSAPP } from "@/lib/shop";

export default function StorefrontHero({ webUrl, mobileUrl, background }) {
  const reference = useRef(null);
  const [height, setHeight] = useState(null);
  useLayoutEffect(() => {
    const element = reference.current;
    if (!element) return;
    // Desktop keeps the approved 15% reduction; mobile is another 20% shorter than that preview.
    const measure = () => setHeight(element.getBoundingClientRect().height * (matchMedia("(max-width: 767px)").matches ? .68 : .85));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const content = (measuring = false) => <><div className="hero-content"><p className="eyebrow">Everyday Essentials, thoughtfully selected.</p>{measuring ? <div className="hero-measure-title">Find what you need.<br />Pick up or get it delivered.</div> : <h1>Find what you need.<br />Pick up or get it delivered.</h1>}<p>School, home, gifts and daily essentials in one simple shop.</p><div className="hero-actions">{measuring ? <><span className="button primary">Shop products</span><span className="button whatsapp"><WhatsAppIcon size={18} /> WhatsApp us</span></> : <><a className="button primary" href="#catalogue">Shop products</a><a className="button whatsapp" href={`https://wa.me/${PRIMARY_WHATSAPP}`} target="_blank" rel="noreferrer"><WhatsAppIcon size={18} /> WhatsApp us</a></>}</div></div><div className="hero-panel" aria-hidden="true"><span>P</span><span>A</span><span>M</span></div></>;
  return <div className="hero-stage"><div ref={reference} className="hero hero-size-reference" aria-hidden="true" inert>{content(true)}</div><section className={`hero hero-short${webUrl ? " has-web-image" : ""}${mobileUrl ? " has-mobile-image" : ""}`} style={height ? { height: `${height}px` } : undefined}><div className={`hero-flyer hero-flyer-web${webUrl ? " uploaded" : ""}`} aria-hidden="true" style={background(webUrl)} /><div className={`hero-flyer hero-flyer-mobile${mobileUrl ? " uploaded" : ""}`} aria-hidden="true" style={background(mobileUrl)} />{content()}</section></div>;
}
