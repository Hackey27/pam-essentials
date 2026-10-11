"use client";
import { useEffect, useRef, useState } from "react";

export default function AdminWishlistAnalytics({ authorizedFetch, products }) {
  const fetchRef = useRef(authorizedFetch); fetchRef.current = authorizedFetch;
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [query, setQuery] = useState("");
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError("");
    fetchRef.current("/api/admin/customers?view=wishlist", { signal: controller.signal }).then(async (response) => { const payload = await response.json(); if (!response.ok) throw new Error(payload.error); return payload; }).then((payload) => { if (!controller.signal.aborted) setData(payload); }).catch((reason) => { if (!controller.signal.aborted) setError(reason.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);
  const rows = (data?.products || []).map((item) => ({ ...item, product: products.find((product) => product.id === item.productId) })).filter((item) => !query || [item.product?.name, item.product?.sku, item.productId].some((value) => String(value || "").toLowerCase().includes(query.trim().toLowerCase())));
  return <section className="panel wishlist-analytics"><div className="panel-title"><div><h2>Customer wishlists</h2><p>Current saved items across all customer accounts. These counts are independent of the sales date filter.</p></div><button type="button" className="button secondary" disabled={loading} onClick={() => setRevision((value) => value + 1)}>Refresh wishlists</button></div>
    {error && <p role="alert" className="notice error-notice">{error}</p>}{loading ? <p role="status">Loading wishlist activity…</p> : !error && <><div className="metric-grid compact"><article className="metric-card"><p>Customers with wishlists</p><strong>{data?.customers || 0}</strong><span>Distinct customer accounts</span></article><article className="metric-card"><p>Saved items</p><strong>{data?.savedItems || 0}</strong><span>One save per product per customer</span></article><article className="metric-card"><p>Products saved</p><strong>{data?.products.length || 0}</strong><span>Ranked by customer interest below</span></article></div><div className="table-tools"><input aria-label="Search wishlist products" placeholder="Search wishlist product or SKU" value={query} onChange={(event) => setQuery(event.target.value)} /></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Product / exact variant</th><th>SKU</th><th>Category</th><th>Customers who saved it</th><th>Stock</th></tr></thead><tbody>{rows.map(({ productId, count, product }) => <tr key={productId}><td><b>{product?.name || "Unavailable product"}</b><span>{Object.entries(product?.variantOptions || {}).map(([key, value]) => `${key}: ${value}`).join(" · ") || [product?.colour, product?.size].filter(Boolean).join(" / ")}</span></td><td>{product?.sku || productId}</td><td>{product?.category || "—"}</td><td className="num">{count}</td><td>{product ? `${product.stock || 0}${product.archived ? " · Archived" : product.active === false ? " · Inactive" : ""}` : "Unavailable"}</td></tr>)}{!rows.length && <tr><td className="empty-cell" colSpan="5">{data?.savedItems ? "No wishlist products match your search." : "No products saved to customer wishlists yet."}</td></tr>}</tbody></table></div></>}
    {data?.updatedAt && <p className="muted">Last refreshed: {new Date(data.updatedAt).toLocaleString("en-GH")}. Removing a saved item reduces its count.</p>}
  </section>;
}
