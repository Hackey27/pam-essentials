"use client";
import { readinessLabels } from "@/lib/adminWorkspace.mjs";
export default function AdminReadiness({ readiness, onView }) {
  const rows = Object.values(readiness);
  return <section className="panel admin-readiness"><div className="panel-title"><div><h2>Catalogue readiness</h2><p>Advisory checks. Missing content does not automatically change visibility or stock.</p></div><button type="button" className="button secondary" onClick={() => onView("all")}>Open products</button></div><div className="readiness-grid">{["photo", "description", "classification", "variants", "pricing", "quote"].map((key) => {
    const count = rows.filter((r) => key === "quote" ? r.quote : r.issues.includes(key)).length;
    return <button type="button" key={key} className={`readiness-tile ${key === "quote" ? "intentional" : ""}`} onClick={() => onView(key)}><strong>{count}</strong><span>{readinessLabels[key]}</span><small>{key === "quote" ? "Configured to request a price" : "View products →"}</small></button>;
  })}</div><p className="workspace-caption">Subcategories are optional. Checks flag missing or invalid assignments, unavailable hierarchy and incomplete or duplicate variant combinations. Photos use the storefront’s existing image fallback.</p></section>;
}
