"use client";

import { useEffect, useState } from "react";

export default function FooterReturn() {
  const [fromFooter, setFromFooter] = useState(false);

  useEffect(() => {
    const active = new URLSearchParams(window.location.search).get("from") === "footer";
    setFromFooter(active);
    if (!active) return;
    const returnFromInfo = (event) => {
      const link = event.target.closest?.("a.info-back");
      if (!link) return;
      event.preventDefault();
      window.location.assign("/?returnToFooter=1");
    };
    document.addEventListener("click", returnFromInfo, true);
    return () => document.removeEventListener("click", returnFromInfo, true);
  }, []);

  return fromFooter ? <a className="footer-return" href="/?returnToFooter=1" aria-label="Back to footer" title="Back to footer">←</a> : null;
}
