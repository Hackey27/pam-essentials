"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import ProductOptions, { ProductImage, productVariants } from "@/components/ProductOptions";
import { addToCart, readCart, saveCart } from "@/lib/storeCart";

export default function ProductPage() {
  const { id } = useParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [added, setAdded] = useState(null);
  const [shared, setShared] = useState(false);
  useEffect(() => {
    fetch("/api/catalog/products").then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The product is unavailable.");
      setProducts(data.products || []);
      if (data.publicLaunch === true) {
        const productId = String(id);
        const seenKey = `pam-click-${productId}`;
        if (!sessionStorage.getItem(seenKey)) {
          const visitorId = sessionStorage.getItem("pam-visitor-id") || crypto.randomUUID();
          sessionStorage.setItem("pam-visitor-id", visitorId);
          sessionStorage.setItem(seenKey, "1");
          fetch("/api/catalog/engagement", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ productId, visitorId }), keepalive: true }).catch(() => {});
        }
      }
    }).catch((reason) => setError(reason.message)).finally(() => setLoading(false));
  }, []);
  const product = products.find((item) => item.id === id);
  const variants = useMemo(() => productVariants(product, products), [product, products]);
  const related = useMemo(() => products.filter((item) => item.id !== product?.id && (!product?.productGroupId || item.productGroupId !== product.productGroupId) && (item.subcategoryId && item.subcategoryId === product?.subcategoryId || item.categoryId === product?.categoryId)).slice(0, 4), [product, products]);
  function add(selected, quantity) {
    saveCart(addToCart(readCart(), selected, quantity));
    setAdded({ ...selected, quantity });
  }
  async function share() {
    const url = window.location.href;
    if (navigator.share) { try { await navigator.share({ title: product.name, url }); return; } catch { return; } }
    await navigator.clipboard.writeText(url);
    setShared(true);
  }
  return <div className="product-page store-shell">
    <header className="product-page-header"><a className="brand" href="/"><span className="brand-mark">P</span><span>PAM Essentials</span></a><a href="/?cart=1">View cart</a></header>
    <main className="product-page-main">
      {loading && <div className="empty-state">Loading product…</div>}
      {(error || !loading && !product) && <div className="empty-state"><h1>Product unavailable</h1><p>{error || "This product is no longer in the storefront."}</p><a href="/">Shop products</a></div>}
      {product && <>
        <nav className="breadcrumb"><a href="/">Home</a> / {product.category} / {product.name}</nav>
        <ProductOptions key={product.id} initialProduct={product} products={variants} onAdd={add} />
        <div className="product-utilities"><button type="button" onClick={share}>Share</button>{shared && <span>Link copied</span>}<button type="button" onClick={() => window.location.href = "/login"}>Add to wishlist · sign in</button><button type="button" onClick={() => window.location.href = "/login"}>Compare · sign in</button></div>
        <section className="detail-section"><h2>Description</h2><p>{product.description || product.name}</p><h2>Product details</h2><dl><dt>SKU</dt><dd>{product.id}</dd>{product.productGroupId && <><dt>Product ID</dt><dd>{product.productGroupId}</dd><dt>Variant ID</dt><dd>{product.id}</dd></>}{product.size && <><dt>Size</dt><dd>{product.size}</dd></>}{product.colour && <><dt>Colour</dt><dd>{product.colour}</dd></>}</dl><h2>Delivery &amp; pickup</h2><p>🚚 Delivery available &nbsp; 🏪 Pickup available</p></section>
        {related.length > 0 && <section className="related-products"><h2>You may also like…</h2><div className="related-grid">{related.map((item) => <a href={`/products/${encodeURIComponent(item.id)}`} key={item.id}><ProductImage product={item} /><b>{item.name}</b></a>)}</div></section>}
      </>}
    </main>
    {added && <div className="modal-backdrop" role="presentation"><div className="modal" role="dialog" aria-modal="true" aria-label="Added to cart"><h2>Added to cart</h2><p>{added.quantity} × {added.name}</p><p>SKU: {added.id}{added.colour && ` · ${added.colour}`}{added.size && ` · ${added.size}`}</p><div className="added-actions"><button className="button secondary" onClick={() => setAdded(null)}>Continue shopping</button><a className="button primary" href="/?cart=1">View cart</a></div></div></div>}
  </div>;
}

