"use client";

import { useEffect, useState } from "react";
import { useSelectedLayoutSegments } from "next/navigation";
import CustomerFooter from "@/components/CustomerFooter";
import { loadStorefrontCatalogue } from "@/lib/storefrontCatalogue";

export default function CustomerPageFooter() {
  const segments = useSelectedLayoutSegments();
  const customerPage = segments.length > 0 && !["admin", "pos", "login", "images", "api"].includes(segments[0]);
  const [settings, setSettings] = useState({});
  useEffect(() => {
    if (!customerPage) return;
    let active = true;
    loadStorefrontCatalogue().then((data) => { if (active) setSettings({ storeLocation: data.storeLocation, mapsUrl: data.mapsUrl, dealsActive: data.dealsActive }); }).catch(() => {});
    return () => { active = false; };
  }, [customerPage]);
  return customerPage ? <CustomerFooter {...settings} /> : null;
}
