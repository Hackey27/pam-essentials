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
      {!chosen.length ? <div className="empty-state"><h2>No products selected yet</h2><p>Use the compare icon on product cards to add up to four products.</p></div> : <div className="compare-table-wrap"><table className="compare-table"><thead><tr><th scope="col">Product</th><th scope="col">Price</th><th scope="col">Category</th><th scope="col">Availability</th><th scope="col">Variant</th><th scope="col">Details</th><th scope="col">Actions</th></tr></thead><tbody>{chosen.map((product) => <tr key={product.id}>
        <td data-label="Product"><div className="compare-product"><ProductImage product={product} /><div><strong>{product.name}</strong><small>SKU: {product.sku || product.id}</small></div></div></td>
        <td data-label="Price" className="compare-price">{money.format(product.price)}</td>
        <td data-label="Category">{product.category || "—"}</td>
        <td data-label="Availability"><span className={product.stock > 0 ? "compare-stock in" : "compare-stock out"}>{product.stock > 0 ? "In stock" : "Out of stock"}</span></td>
        <td data-label="Variant">{variantDetail(product) || "—"}</td>
        <td data-label="Details" className="compare-description">{product.description || "—"}</td>
        <td data-label="Actions"><div className="compare-actions"><a href={`/products/${encodeURIComponent(product.id)}`}>View product</a><button type="button" onClick={() => remove(product.id)} aria-label={`Remove ${product.name} from comparison`}>Remove</button></div></td>
      </tr>)}</tbody></table></div>}
      <a className="button primary compare-more" href="/#catalogue">Compare more products</a>
    </main>
  </div>;
}
