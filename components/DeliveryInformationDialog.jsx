"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import PaymentDetails from "@/components/PaymentDetails";
import WhatsAppIcon from "@/components/WhatsAppIcon";
import { PRIMARY_WHATSAPP } from "@/lib/shop";

export default function DeliveryInformationDialog({ storeLocation, onClose }) {
  const closeButton = useRef(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const key = (event) => { if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); onClose(); } };
    window.addEventListener("keydown", key, true);
    return () => { document.body.style.overflow = overflow; window.removeEventListener("keydown", key, true); previousFocus?.focus(); };
  }, [onClose]);
  return createPortal(<div className="modal-backdrop delivery-information-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal delivery-information-modal" role="dialog" aria-modal="true" aria-label="Payment and delivery information"><header className="drawer-title"><h2>Payment &amp; Delivery</h2><button ref={closeButton} type="button" className="icon-button" onClick={onClose} aria-label="Close payment and delivery information">×</button></header><p>Choose pickup, shop-arranged delivery, or your own courier at checkout. Add your destination for shop-arranged delivery.</p><p>Courier collection: {storeLocation}</p><PaymentDetails /><a className="button whatsapp" href={`https://wa.me/${PRIMARY_WHATSAPP}`} target="_blank" rel="noreferrer"><WhatsAppIcon size={18} /> Message our team</a><a className="detail-link" href="/info/delivery">Open Payment &amp; Delivery page</a></section></div>, document.body);
}
