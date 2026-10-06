"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import FulfilmentInformation from "@/components/FulfilmentInformation";
import WhatsAppIcon from "@/components/WhatsAppIcon";
import { PRIMARY_WHATSAPP } from "@/lib/shop";

export default function DeliveryInformationDialog({ storeLocation, openingHours, mapsUrl, onClose }) {
  const closeButton = useRef(null);
  const panelRef = useRef(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const key = (event) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); onClose(); }
      if (event.key === "Tab") {
        const controls = Array.from(panelRef.current?.querySelectorAll("button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex='0']") || []);
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener("keydown", key, true);
    return () => { document.body.style.overflow = overflow; window.removeEventListener("keydown", key, true); previousFocus?.focus(); };
  }, [onClose]);
  return createPortal(<div className="modal-backdrop delivery-information-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section ref={panelRef} className="modal delivery-information-modal" role="dialog" aria-modal="true" aria-label="Payment and delivery information"><header className="drawer-title"><h2>Payment &amp; Delivery</h2><button ref={closeButton} type="button" className="icon-button" onClick={onClose} aria-label="Close payment and delivery information">×</button></header><p>Choose the option that suits you at checkout. Our team is a message away if you need help.</p><FulfilmentInformation storeLocation={storeLocation} openingHours={openingHours} mapsUrl={mapsUrl} /><p className="fulfilment-help">Need help deciding?</p><a className="button whatsapp" href={`https://wa.me/${PRIMARY_WHATSAPP}`} target="_blank" rel="noreferrer"><WhatsAppIcon size={18} /> Message our team</a><a className="detail-link" href="/info/delivery">Open Payment &amp; Delivery page</a></section></div>, document.body);
}
