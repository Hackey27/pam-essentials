"use client";

import { useEffect, useRef } from "react";

export default function MobileBrowseMenu({ navigation, filters, onClose }) {
  const panelRef = useRef(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector("button")?.focus({ preventScroll: true });
    const handleKey = (event) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key !== "Tab") return;
      const items = [...panelRef.current.querySelectorAll("button, a, input, select, summary")].filter((item) => !item.disabled && item.getClientRects().length);
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    const handleResize = () => { if (window.innerWidth > 767) onClose(); };
    window.addEventListener("keydown", handleKey);
    window.addEventListener("resize", handleResize);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("resize", handleResize);
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [onClose]);
  return <div className="mobile-browse-backdrop" onClick={onClose}>
    <section id="mobile-browse-menu" ref={panelRef} className="mobile-browse-menu" role="dialog" aria-modal="true" aria-label="Navigation and product filters" onClick={(event) => event.stopPropagation()}>
      <div className="mobile-menu-heading"><h2>Browse PAM</h2><button type="button" aria-label="Close navigation and product filters" onClick={onClose}>×</button></div>
      <nav aria-label="Mobile navigation" onClick={(event) => { if (event.target.closest("a,button")) onClose(); }}>{navigation}</nav>
      <div className="mobile-menu-filters">{filters}</div>
      <button type="button" className="button primary full" onClick={onClose}>Apply filters and browse</button>
    </section>
  </div>;
}
