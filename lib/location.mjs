export function isGoogleMapsUrl(value) {
  if (!value) return true;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    if (["maps.app.goo.gl", "goo.gl"].includes(url.hostname)) return true;
    return ["google.com", "www.google.com", "maps.google.com"].includes(url.hostname) && (url.pathname.startsWith("/maps") || url.hostname === "maps.google.com");
  } catch { return false; }
}
