"use client";

import { useEffect } from "react";
import { createCompactSearchTimer } from "@/lib/compactSearch.mjs";

export default function useCompactSearch({ open, searchRef, onClose }) {
  useEffect(() => {
    if (!open) return;
    const timer = createCompactSearchTimer({ onClose });
    const inside = (target) => searchRef.current?.contains(target) || target.closest?.(".compact-search-toggle");
    const activity = (event) => {
      if (inside(event.target)) timer.interact(event.type === "input");
      else if (event.type === "pointerdown" || event.type === "focusin") timer.outside();
    };
    const pageScroll = () => timer.pageScroll();
    const events = ["input", "keydown", "pointerdown", "pointermove", "focusin", "wheel", "touchmove"];
    events.forEach((name) => document.addEventListener(name, activity, { passive: true }));
    // Non-capturing: scrolling a suggestion list does not count as page scrolling.
    window.addEventListener("scroll", pageScroll, { passive: true });
    return () => {
      timer.dispose();
      events.forEach((name) => document.removeEventListener(name, activity));
      window.removeEventListener("scroll", pageScroll);
    };
  }, [open, searchRef, onClose]);
}
