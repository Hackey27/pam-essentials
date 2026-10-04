"use client";

import { useEffect, useState } from "react";

export default function FooterReturn() {
  const [position, setPosition] = useState(null);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("from") !== "footer") return;
    let disposed = false;
    let heading;
    let frame;
    const locate = () => {
      if (disposed) return;
      const nextHeading = document.querySelector(".catalogue-heading h2") || document.querySelector(".info-page h1, .account-main h1, .compare-main h1, main h1");
      if (nextHeading !== heading) {
        heading?.classList.remove("footer-return-title");
        heading = nextHeading;
        heading?.classList.add("footer-return-title");
      }
      if (!heading) { setPosition(null); return; }
      const rect = heading.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(heading);
      const textRect = range.getBoundingClientRect();
      const lineHeight = parseFloat(getComputedStyle(heading).lineHeight) || rect.height;
      const left = Math.max(12, Math.min(textRect.right + 12, rect.right - 44, window.innerWidth - 56));
      const top = rect.top + Math.max(0, (Math.min(lineHeight, rect.height) - 44) / 2);
      const visible = rect.width > 0 && rect.bottom > 0 && top < window.innerHeight;
      setPosition((current) => current?.left === left && current?.top === top && current?.visible === visible ? current : { left, top, visible });
    };
    const schedule = () => { if (!disposed) { cancelAnimationFrame(frame); frame = requestAnimationFrame(locate); } };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    document.fonts?.ready.then(schedule);
    locate();
    const returnFromInfo = (event) => {
      const link = event.target.closest?.("a.info-back");
      if (!link) return;
      event.preventDefault();
      window.location.assign("/?returnToFooter=1");
    };
    document.addEventListener("click", returnFromInfo, true);
    return () => {
      disposed = true;
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      document.removeEventListener("click", returnFromInfo, true);
      cancelAnimationFrame(frame);
      heading?.classList.remove("footer-return-title");
    };
  }, []);
  return position ? <a className="footer-return" style={{ left: position.left, top: position.top, visibility: position.visible ? "visible" : "hidden" }} href="/?returnToFooter=1" aria-label="Back to footer" title="Back to footer">←</a> : null;
}
