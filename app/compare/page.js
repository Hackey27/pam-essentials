"use client";

import { useEffect, useState } from "react";
import { ProductImage } from "@/components/ProductOptions";
import BrandLogo from "@/components/BrandLogo";
import { readCompare, toggleCompare } from "@/lib/compare.mjs";

const money = new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" });

export default function ComparePage() {
  const [ids, setIds] = useState([]);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    setIds(readCompare(localStorage));
    fetch("/api/catalog/products").then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); setProducts(data.products || []); }).catch((reason) => setError(reason.message || "Products could not be loaded."));
  }, []);
  const chosen = ids.map((id) => products.find((product) => product.id === id)).filter(Boolean);
  function remove(id) { setIds(toggleCompare(localStorage, id)); }
  return <div className="compare-page"><header className="product-page-header"><a className="brand" href="/"><BrandLogo /></a><a href="/#catalogue">Back to products</a></header><main className="compare-main"><div className="compare-title"><div><p className="eyebrow">PAM Essentials &amp; More</p><h1>Compare Products</h1><p>{chosen.length} of 4 products selected</p></div><button type="button" className="button secondary" onClick={() => window.print()} disabled={!chosen.length}>Print this page</button></div>{error && <p className="notice error-notice">{error}</p>}{!chosen.length ? <div className="empty-state"><h2>No products selected yet</h2><p>Use the compare icon on product cards to add up to four products.</p></div> : <div className="compare-grid">{chosen.map((product) => <article className="compare-card" key={product.id}><button type="button" className="compare-remove" onClick={() => remove(product.id)} aria-label={`Remove ${product.name}`}>×</button><ProductImage product={product} /><h2>{product.name}</h2><strong>{money.format(product.price)}</strong><dl><dt>Category</dt><dd>{product.category}</dd><dt>SKU</dt><dd>{product.id}</dd><dt>Availability</dt><dd>{product.stock > 0 ? "In stock" : "Out of stock"}</dd>{product.size && <><dt>Size</dt><dd>{product.size}</dd></>}{product.colour && <><dt>Colour</dt><dd>{product.colour}</dd></>}<dt>Details</dt><dd>{product.description || "—"}</dd></dl><a href={`/products/${encodeURIComponent(product.id)}`}>View product</a></article>)}</div>}<a className="button primary compare-more" href="/#catalogue">Compare more products</a></main></div>;
}
