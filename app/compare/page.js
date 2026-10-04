"use client";

import { useEffect, useState } from "react";
import { ProductImage } from "@/components/ProductOptions";
import BrandLogo from "@/components/BrandLogo";
import { readCompare, toggleCompare } from "@/lib/compare.mjs";
import { variantDetail } from "@/lib/variantDisplay.mjs";

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

  return <div className="compare-page">
    <header className="product-page-header"><a className="brand" href="/"><BrandLogo /></a><a href="/#catalogue">Back to products</a></header>
    <main className="compare-main">
      <div className="compare-title"><div><p className="eyebrow">PAM Essentials &amp; More</p><h1>Compare Products</h1><p>{chosen.length} of 4 products selected</p></div><button type="button" className="button secondary" onClick={() => window.print()} disabled={!chosen.length}>Print this page</button></div>
      {error && <p className="notice error-notice">{error}</p>}
      {!chosen.length ? <div className="empty-state"><h2>No products selected yet</h2><p>Use the compare icon on product cards to add up to four products.</p></div> : <div className="compare-table-wrap" role="region" aria-label="Product comparison" tabIndex={0}><table className="compare-table"><thead><tr><th scope="col" className="compare-attribute-head">Compare</th>{chosen.map((product) => <th scope="col" key={product.id}><div className="compare-product"><ProductImage product={product} /><div><strong>{product.name}</strong><small>SKU: {product.sku || product.id}</small></div></div></th>)}</tr></thead><tbody>
        <tr><th scope="row">Price</th>{chosen.map((product) => <td className="compare-price" key={product.id}>{money.format(product.price)}</td>)}</tr>
        <tr><th scope="row">Category</th>{chosen.map((product) => <td key={product.id}>{product.category || "—"}</td>)}</tr>
        <tr><th scope="row">Availability</th>{chosen.map((product) => <td key={product.id}><span className={product.stock > 0 ? "compare-stock in" : "compare-stock out"}>{product.stock > 0 ? "In stock" : "Out of stock"}</span></td>)}</tr>
        <tr><th scope="row">Variant</th>{chosen.map((product) => <td key={product.id}>{variantDetail(product) || "—"}</td>)}</tr>
        <tr><th scope="row">Details</th>{chosen.map((product) => <td className="compare-description" key={product.id}>{product.description || "—"}</td>)}</tr>
        <tr><th scope="row">Actions</th>{chosen.map((product) => <td key={product.id}><div className="compare-actions"><a href={`/products/${encodeURIComponent(product.id)}`}>View product</a><button type="button" onClick={() => remove(product.id)} aria-label={`Remove ${product.name} from comparison`}>Remove</button></div></td>)}</tr>
      </tbody></table></div>}
      <a className="button primary compare-more" href="/#catalogue">Compare more products</a>
    </main>
  </div>;
}
