"use client";

export default function RequestProductLink({ children = "Request a Product", className = "", footer = false, role }) {
  return <a href={`/request-product${footer ? "?from=footer" : ""}`} role={role} className={className} onClick={(event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    window.dispatchEvent(new Event("pam-remember-listing"));
    try { sessionStorage.setItem("pam-product-request-return", JSON.stringify({ path: window.location.pathname + window.location.search + window.location.hash, y: window.scrollY, footer, at: Date.now() })); } catch {}
  }}>{children}</a>;
}
