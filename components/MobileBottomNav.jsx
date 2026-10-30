"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {useAuth} from "./AuthProvider";
import {navigationTarget} from "@/lib/customerNavigation.mjs";
import { useEffect, useRef, useState } from "react";

const items = [
  { key: "services", label: "Services", href: "/?services=1" },
  { key: "delivery", label: "Payment & Delivery", href: "/info/delivery" },
  { key: "home", label: "Home", href: "/" },
  { key: "orders", label: "Orders", href: "/account?mode=signin#orders" },
  { key: "account", label: "Account", href: "/account?mode=signin" },
];

function NavIcon({ kind, selected }) {
  const fill = selected ? "currentColor" : "none";
  const detail = selected ? "#00235b" : "currentColor";
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === "account" && <><circle cx="12" cy="7" r="3.5" fill={fill} /><path d="M4 21v-2a8 8 0 0 1 16 0v2Z" fill={fill} /></>}
    {kind === "orders" && <><path d="M5 3h14v19l-3-2-4 2-4-2-3 2Z" fill={fill} /><path d="M9 8h6M9 12h6M9 16h4" stroke={detail} /></>}
    {kind === "home" && <><path d="m3 10 9-7 9 7v11H3Z" fill={fill} /><path d="M9 21v-7h6v7" stroke={detail} /></>}
    {kind === "delivery" && <><path d="M2 5h12v13H2ZM14 10h4l4 4v4h-8Z" fill={fill} /><path d="M17 12v3h4" stroke={detail} /><circle cx="6" cy="19" r="2" fill={selected ? "#00235b" : "none"} /><circle cx="18" cy="19" r="2" fill={selected ? "#00235b" : "none"} /></>}
    {kind === "services" && <path d="M21 3a6 6 0 0 0-7.6 7.6L3 21l-2-2L11.4 8.6A6 6 0 0 1 19 1l-4 4 4 4 4-4Z" fill={fill} />}
  </svg>;
}

export default function MobileBottomNav() {
  const pathname = usePathname();
  const router=useRouter();const {user}=useAuth();
  const staffPage = /^\/(admin|pos|login|api|images)(?:\/|$)/.test(pathname);
  const [hidden, setHidden] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [hash, setHash] = useState("");
  const navigationReset = useRef(false);
  useEffect(() => {
    if (staffPage) return;
    document.body.classList.add("customer-mobile-nav-space");
    let lastY = Math.max(0, window.scrollY), frame = 0, resetFrame = 0;
    navigationReset.current = true;
    resetFrame = requestAnimationFrame(() => { resetFrame = requestAnimationFrame(() => { lastY = Math.max(0, window.scrollY); navigationReset.current = false; }); });
    const update = () => {
      frame = 0;
      const y = Math.max(0, Math.min(window.scrollY, Math.max(0, document.documentElement.scrollHeight - window.innerHeight)));
      if (navigationReset.current || document.documentElement.dataset.customerRestoring === "true") { lastY = y; return; }
      if (y > lastY) setHidden(true);
      else if (y < lastY) setHidden(false);
      lastY = y;
    };
    const scroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    const location = () => setHash(window.location.hash);
    const ui = (event) => setBlocked(Boolean(event.detail?.overlay));
    const initialOverlay = document.querySelector(".store-shell")?.dataset.mobileOverlay;
    setBlocked(Boolean(initialOverlay)); setHidden(false); location();
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("hashchange", location);
    window.addEventListener("popstate", location);
    window.addEventListener("pam-storefront-ui", ui);
    const inquiry = (event) => setInquiryOpen(Boolean(event.detail?.open));
    window.addEventListener("pam-pricing-inquiry-ui", inquiry);
    return () => {
      document.body.classList.remove("customer-mobile-nav-space");
      cancelAnimationFrame(frame); cancelAnimationFrame(resetFrame);
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("hashchange", location);
      window.removeEventListener("popstate", location);
      window.removeEventListener("pam-storefront-ui", ui);
      window.removeEventListener("pam-pricing-inquiry-ui", inquiry);
    };
  }, [pathname, staffPage]);
  if (staffPage) return null;
  const active = pathname.startsWith("/account") ? hash === "#orders" ? "orders" : "account" : (pathname.startsWith("/services") || pathname === "/request-product") ? "services" : ["/info/delivery", "/info/contact"].includes(pathname) ? "delivery" : "home";
  const unavailable = hidden || blocked || inquiryOpen;
  return <nav className={`mobile-bottom-nav${unavailable ? " is-hidden" : ""}`} aria-label="Customer navigation" aria-hidden={unavailable} inert={unavailable}>
    {items.map((item) => <Link key={item.key} href={item.href} scroll={false} aria-label={item.label} aria-current={active === item.key ? "page" : undefined} className={active === item.key ? "selected" : ""} onClick={(event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      setHidden(false);
      navigationReset.current = true;
      requestAnimationFrame(() => requestAnimationFrame(() => { navigationReset.current = false; }));
      if (item.key === "home" && pathname === "/") { event.preventDefault(); return; }
      if (item.key === "services" && pathname === "/") { event.preventDefault(); window.dispatchEvent(new Event("pam-open-services")); return; }
      if (item.key === "orders") setHash("#orders");
      if (item.key === "account") setHash("");
      let href=item.href;try{href=navigationTarget(sessionStorage,user?.uid||"guest",item.key,item.href);}catch{}
      event.preventDefault();router.push(href,{scroll:false});
    }}><NavIcon kind={item.key} selected={active === item.key} /><span aria-hidden={active !== item.key}>{item.label}</span></Link>)}
  </nav>;
}
