"use client";

import { useEffect, useRef } from "react";

export default function MobileBrowseMenu({ navigation, filters, onClose }) {
  const panelRef = useRef(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    const panel = panelRef.current;
    panelRef.current?.querySelector("button")?.focus({ preventScroll: true });
    const handleKey = (event) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
    };
    const handleOutsideClick = (event) => {
      if (!panel?.contains(event.target) && !event.target.closest(".mobile-browse-toggle")) onClose();
    };
    document.addEventListener("click", handleOutsideClick);
    const handleResize = () => { if (window.innerWidth > 767) onClose(); };
    window.addEventListener("keydown", handleKey);
    window.addEventListener("resize", handleResize);
    return () => {
      document.removeEventListener("click", handleOutsideClick);
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("resize", handleResize);
      if (previousFocus?.isConnected && (panel?.contains(document.activeElement) || document.activeElement === document.body)) previousFocus.focus({ preventScroll: true });
    };
  }, [onClose]);
  return <div className="mobile-browse-backdrop">
    <section id="mobile-browse-menu" ref={panelRef} className="mobile-browse-menu" role="dialog" aria-modal="false" aria-label="Navigation and product filters" onClick={(event) => event.stopPropagation()}>
      <div className="mobile-menu-heading"><h2>Browse PAM</h2><button type="button" aria-label="Close navigation and product filters" onClick={onClose}>×</button></div>
      <nav aria-label="Mobile navigation" onClick={(event) => { if (event.target.closest("a,button")) onClose(); }}>{navigation}</nav>
      <div className="mobile-menu-filters">{filters}</div>
      <button type="button" className="button primary full" onClick={onClose}>Apply filters</button>
    </section>
  </div>;
}
