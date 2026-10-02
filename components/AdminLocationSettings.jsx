"use client";

import { useEffect, useState } from "react";
import { OPENING_HOURS, SHOP_ADDRESS } from "@/lib/shop";

export default function AdminLocationSettings({ settings, onSave, saving }) {
  const [address, setAddress] = useState(SHOP_ADDRESS);
  const [mapsUrl, setMapsUrl] = useState("");
  const [hours, setHours] = useState(OPENING_HOURS);
  useEffect(() => {
    setAddress(String(settings.STORE_LOCATION?.value || SHOP_ADDRESS));
    setMapsUrl(String(settings.GOOGLE_MAPS_URL?.value || ""));
    setHours(String(settings.OPENING_HOURS?.value || OPENING_HOURS));
  }, [settings]);

  async function save(event) {
    event.preventDefault();
    const entries = [
      ["STORE_LOCATION", address.trim(), "Detailed shop address"],
      ["GOOGLE_MAPS_URL", mapsUrl.trim(), "Google Maps location link"],
      ["OPENING_HOURS", hours.trim(), "Store opening hours"],
    ];
    for (const [key, value, description] of entries) {
      const result = await onSave({ key, value, description }, `${key.replaceAll("_", " ")} updated.`);
      if (!result) return;
    }
  }

  return <form className="panel admin-form admin-location-settings" onSubmit={save}>
    <h2>Store location &amp; hours</h2>
    <p>Shown on the storefront and contact page. Paste the full address and a Google Maps share link.</p>
    <label>Detailed address<textarea required rows={2} maxLength={2000} value={address} onChange={(event) => setAddress(event.target.value)} /></label>
    <label>Google Maps URL<input type="url" placeholder="https://maps.app.goo.gl/…" value={mapsUrl} onChange={(event) => setMapsUrl(event.target.value)} /></label>
    <label>Opening hours<input required value={hours} onChange={(event) => setHours(event.target.value)} /></label>
    <button className="button primary" disabled={saving}>Save location &amp; hours</button>
  </form>;
}
