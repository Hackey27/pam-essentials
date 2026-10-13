"use client";
import { useEffect, useRef } from "react";
export default function useAdminModal(onClose, busy) {
  const panel = useRef(null), close = useRef(onClose), locked = useRef(busy);
  close.current = onClose; locked.current = busy;
  useEffect(() => {
    const previous = document.activeElement;
    panel.current?.querySelector("button,input,select")?.focus({ preventScroll: true });
    const keys = (event) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); if (!locked.current) close.current(); }
      if (event.key === "Tab") {
        const items = [...panel.current.querySelectorAll("button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],summary")].filter((v) => v.getClientRects().length);
        if (!items.length) return;
        if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); }
        else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0]?.focus(); }
      }
    };
    const unload = (event) => { if (locked.current) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("keydown", keys); window.addEventListener("beforeunload", unload);
    return () => { window.removeEventListener("keydown", keys); window.removeEventListener("beforeunload", unload); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  return panel;
}
