"use client";

import { useEffect, useState } from "react";

export default function FooterReturn() {
  const [fromFooter, setFromFooter] = useState(false);

  useEffect(() => {
    const active = window.location.pathname !== "/" && new URLSearchParams(window.location.search).get("from") === "footer";
    setFromFooter(active);
    if (!active) return;
    const returnFromInfo = (event) => {
      const link = event.target.closest?.("a.info-back");
      if (!link) return;
      event.preventDefault();
      window.location.assign("/#store-footer");
    };
    document.addEventListener("click", returnFromInfo, true);
    return () => document.removeEventListener("click", returnFromInfo, true);
  }, []);

  return fromFooter ? <a className="footer-return" href="/#store-footer">← Close and return to footer</a> : null;
}
