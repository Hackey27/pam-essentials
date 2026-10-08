"use client";

import { useEffect, useRef, useState } from "react";

export default function MobileBrowseMenu({ open, search, filters, resultCount, onClear, onClose }) {
  const panelRef = useRef(null);
  const [expanded, setExpanded] = useState(true);
  useEffect(() => {
    if (!open) return;
    setExpanded(true);
    const previousFocus = document.activeElement;
    const panel = panelRef.current;
    panel?.focus({ preventScroll: true });
    const handleKey = (event) => { if (event.key === "Escape") { event.preventDefault(); onClose(); } };
    const handleOutsideClick = (event) => {
      if (!panel?.contains(event.target) && !event.target.closest(".mobile-browse-toggle, .mobile-filter-inline, .mobile-filter-toggle")) onClose();
    };
    const handleResize = () => { if (window.innerWidth > 767) onClose(); };
    document.addEventListener("click", handleOutsideClick);
    window.addEventListener("keydown", handleKey);
    window.addEventListener("resize", handleResize);
    return () => {
      document.removeEventListener("click", handleOutsideClick);
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("resize", handleResize);
      if (previousFocus?.isConnected && (panel?.contains(document.activeElement) || document.activeElement === document.body)) previousFocus.focus({ preventScroll: true });
    };
  }, [open, onClose]);
  return <div className={`mobile-browse-backdrop${open ? " is-open" : ""}`} inert={!open} aria-hidden={!open}>
    <section id="mobile-browse-menu" ref={panelRef} tabIndex={-1} className="mobile-browse-menu" role="dialog" aria-modal="false" aria-label="Product filter panel" onClick={(event) => event.stopPropagation()}>
      <button type="button" className="filter-panel-heading" aria-expanded={expanded} aria-controls="filter-panel-content" onClick={() => setExpanded((current) => !current)}>Filter options <span aria-hidden="true" className={expanded ? "expanded" : ""}>▾</span></button>
      {expanded && <div className="filter-panel-content" id="filter-panel-content">
        <div className="filter-panel-scroll">{search}{filters}</div>
        <div className="mobile-filter-actions"><button type="button" className="button primary" onClick={onClose}><span>Apply filters</span><b>{resultCount}</b><span className="sr-only">results</span></button><button type="button" className="table-action" onClick={onClear}>Clear filters</button></div>
      </div>}
    </section>
  </div>;
}
