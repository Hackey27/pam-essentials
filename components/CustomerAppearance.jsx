"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { normalizeTypography, typographyCss } from "@/lib/typography.mjs";

let cached;
let loadedAt = 0;
export default function CustomerAppearance() {
  const pathname = usePathname();
  const staff = /^\/(admin|pos|login|api|images)(?:\/|$)/.test(pathname);
  const [theme, setTheme] = useState(cached || null);
  useEffect(() => {
    if (staff) { document.documentElement.classList.remove("pam-customer-theme"); return; }
    let active = true;
    const apply = (value) => { if (active) { setTheme(value); document.documentElement.classList.toggle("pam-customer-theme", Boolean(value)); } };
    const refresh = async () => {
      if (loadedAt && Date.now() - loadedAt < 30000) { apply(cached); return; }
      try {
        const response = await fetch("/api/appearance");
        if (!response.ok) return;
        const data = await response.json();
        cached = data.configured === true ? normalizeTypography(data.typography) : null; loadedAt = Date.now(); apply(cached);
      } catch {}
    };
    refresh();
    const visible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", visible);
    return () => { active = false; document.removeEventListener("visibilitychange", visible); document.documentElement.classList.remove("pam-customer-theme"); };
  }, [staff, pathname]);
  return !staff && theme ? <style>{typographyCss(theme)}</style> : null;
}
