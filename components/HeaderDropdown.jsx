"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function HeaderDropdown({ label, children, active = false, utility = false }) {
  const detailsRef = useRef(null);
  const menuRef = useRef(null);
  const focusMenu = useRef(false);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const menuId = useId();
  const close = (restoreFocus = false) => {
    if (detailsRef.current) detailsRef.current.open = false;
    setOpen(false);
    if (restoreFocus) detailsRef.current?.querySelector("summary")?.focus({ preventScroll: true });
  };
  const show = () => {
    const details = detailsRef.current;
    if (!details) return;
    details.closest(".store-shell")?.querySelectorAll(".utility-dropdown[open], .nav-dropdown[open]").forEach((item) => { if (item !== details) item.open = false; });
    details.open = true;
    setOpen(true);
  };
  const leave = (event) => {
    if (event.pointerType !== "mouse" || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (detailsRef.current?.contains(event.relatedTarget) || menuRef.current?.contains(event.relatedTarget)) return;
    close();
  };
  useLayoutEffect(() => {
    if (!open) { setPosition(null); return; }
    const place = () => {
      const summary = detailsRef.current?.querySelector("summary");
      const rect = summary?.getBoundingClientRect();
      if (!rect || !rect.width || rect.bottom <= 0 || rect.top >= window.innerHeight) { close(); return; }
      const mobile = window.matchMedia("(max-width: 767px)").matches && !utility;
      const top = mobile ? (detailsRef.current.closest(".store-header")?.getBoundingClientRect().bottom ?? rect.bottom) + 4 : rect.bottom + 10;
      const width = menuRef.current?.getBoundingClientRect().width || 240;
      setPosition({ top, left: mobile ? 16 : Math.max(16, Math.min(rect.left, window.innerWidth - width - 16)), right: mobile ? 16 : "auto", width: mobile ? "auto" : "max-content", maxHeight: Math.max(44, window.innerHeight - top - 32), visibility: "visible" });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open, utility]);
  useLayoutEffect(() => {
    if (open && position && focusMenu.current) { focusMenu.current = false; menuRef.current?.querySelector("a,button")?.focus({ preventScroll: true }); }
  }, [open, position]);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event) => { if (!detailsRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) close(); };
    const escape = (event) => { if (event.key === "Escape") { event.preventDefault(); close(true); } };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", escape); };
  }, [open]);
  const menuKeys = (event) => {
    if (event.key !== "Tab") return;
    const links = [...menuRef.current.querySelectorAll("a,button")];
    if (event.shiftKey && document.activeElement === links[0]) { event.preventDefault(); close(true); }
    else if (!event.shiftKey && document.activeElement === links.at(-1)) {
      const controls = [...document.querySelectorAll(".utility-bar summary, .store-header summary, .store-header .brand, .store-header input, .store-header .search-field button, .store-header .cart-button")].filter((item) => item.getBoundingClientRect().width && !item.closest("[inert]"));
      const next = controls[controls.indexOf(detailsRef.current.querySelector("summary")) + 1];
      if (next) { event.preventDefault(); close(); next.focus({ preventScroll: true }); }
    }
  };
  return <>
    <details ref={detailsRef} className={`${utility ? "utility-dropdown" : "nav-dropdown"}${active ? " active" : ""}`} onToggle={(event) => { const expanded = event.currentTarget.open; setOpen(expanded); if (expanded) show(); }} onPointerEnter={(event) => { if (event.pointerType === "mouse" && window.matchMedia("(hover: hover) and (pointer: fine)").matches) show(); }} onPointerLeave={leave}>
      <summary aria-controls={menuId} aria-expanded={open} onKeyDown={(event) => { if (event.key === "ArrowDown" || (event.key === "Tab" && !event.shiftKey && open)) { event.preventDefault(); focusMenu.current = true; show(); if (open && position) { focusMenu.current = false; menuRef.current?.querySelector("a,button")?.focus({ preventScroll: true }); } } }}>{label}<span aria-hidden="true">▾</span></summary>
    </details>
    {open && createPortal(<div ref={menuRef} id={menuId} className="dropdown-menu header-dropdown-overlay" style={position || { visibility: "hidden" }} onPointerEnter={() => { if (detailsRef.current?.open) setOpen(true); }} onPointerLeave={leave} onKeyDown={menuKeys} onClick={(event) => { if (event.target.closest("a,button")) close(); }}><div className="header-dropdown-scroll">{children}</div></div>, document.body)}
  </>;
}
