"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import ProductOptions, { ProductImage, productVariants } from "@/components/ProductOptions";
import { addToCart, readCart, saveCart } from "@/lib/storeCart";
import { detailImageSource, galleryImagePaths, getProductImageUrl } from "@/lib/productImages.mjs";

export default function ProductPage() {
  const { id } = useParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [added, setAdded] = useState(null);
  const [shared, setShared] = useState(false);
  const [quickReturnId, setQuickReturnId] = useState("");
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [previewSource, setPreviewSource] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const gesture = useRef({ x: 0, y: 0, lastWheel: 0, dragged: false });
  const activeOverlay = lightboxIndex >= 0 ? "gallery" : added ? "added" : "";
  const overlayRef = useRef("");
  const previousOverlay = useRef("");
  const closingOverlay = useRef(false);
  overlayRef.current = activeOverlay;
  useEffect(() => {
    if (window.innerWidth > 767) return;
    const onBack = () => {
      if (closingOverlay.current) { closingOverlay.current = false; return; }
      if (overlayRef.current === "gallery") setLightboxIndex(-1);
      else if (overlayRef.current === "added") setAdded(null);
    };
    window.addEventListener("popstate", onBack);
    return () => window.removeEventListener("popstate", onBack);
  }, []);
  useEffect(() => {
    if (window.innerWidth > 767) return;
    const previous = previousOverlay.current;
    if (activeOverlay && !previous) window.history.pushState({ ...window.history.state, pamProductOverlay: activeOverlay }, "", window.location.href);
    else if (activeOverlay && previous && window.history.state?.pamProductOverlay) window.history.replaceState({ ...window.history.state, pamProductOverlay: activeOverlay }, "", window.location.href);
    else if (!activeOverlay && previous && window.history.state?.pamProductOverlay) { closingOverlay.current = true; window.history.back(); }
    previousOverlay.current = activeOverlay;
  }, [activeOverlay]);
  useEffect(() => { setQuickReturnId(new URLSearchParams(window.location.search).get("quick") || ""); }, []);
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
  const productPath = `/products/${encodeURIComponent(id)}${quickReturnId ? `?quick=${encodeURIComponent(quickReturnId)}` : ""}`;
  const cartUrl = `/?cart=1&returnTo=${encodeURIComponent(productPath)}`;
  function rememberCartPosition() { sessionStorage.setItem("pam-cart-return-scroll", JSON.stringify({ path: window.location.pathname + window.location.search, y: window.scrollY })); }
  useEffect(() => {
    if (loading || !product) return;
    try {
      const saved = JSON.parse(sessionStorage.getItem("pam-cart-return-scroll") || "null");
      if (saved?.path === window.location.pathname + window.location.search) {
        requestAnimationFrame(() => window.scrollTo(0, Number(saved.y) || 0));
        sessionStorage.removeItem("pam-cart-return-scroll");
      }
    } catch { sessionStorage.removeItem("pam-cart-return-scroll"); }
  }, [loading, product?.id]);
  const variants = useMemo(() => productVariants(product, products), [product, products]);
  const selected = selectedVariant && variants.find((item) => item.id === selectedVariant.id) || product;
  const gallery = useMemo(() => {
    if (!product) return [];
    const images = [];
    const add = (source, label) => { if (source?.url && !images.some((image) => image.source.path === source.path && image.source.url === source.url)) images.push({ source, label }); };
    add(detailImageSource(product, selected), "Main image");
    const assignedGallery = galleryImagePaths(product, selected);
    for (const path of assignedGallery) add({ path, url: getProductImageUrl(path, 1000) }, "Gallery image");
    if (!assignedGallery.length && !product.galleryImagePaths?.length) for (const variant of variants) if (variant.imageUrl) add({ path: "", url: variant.imageUrl }, [variant.colour, variant.size].filter(Boolean).join(" · ") || variant.name);
    return images;
  }, [product, selected, variants]);
  useEffect(() => {
    if (lightboxIndex < 0) return;
    const handleKey = (event) => {
      if (event.key === "Escape") setLightboxIndex(-1);
      if (event.key === "ArrowRight") setLightboxIndex((index) => (index + 1) % gallery.length);
      if (event.key === "ArrowLeft") setLightboxIndex((index) => (index - 1 + gallery.length) % gallery.length);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lightboxIndex, gallery.length]);
  const related = useMemo(() => products.filter((item) => item.id !== product?.id && (!product?.productGroupId || item.productGroupId !== product.productGroupId) && item.categoryId === product?.categoryId).sort((a, b) => Number(b.subcategoryId === product?.subcategoryId) - Number(a.subcategoryId === product?.subcategoryId)).slice(0, 4), [product, products]);
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
    <header className="product-page-header"><a className="brand" href="/"><span className="brand-mark">P</span><span>PAM Essentials</span></a><a href={cartUrl} onClick={rememberCartPosition}>View cart</a></header>
    <main className="product-page-main">
      <a className="detail-back" href={quickReturnId ? `/?quick=${encodeURIComponent(quickReturnId)}` : "/#catalogue"} onClick={(event) => { try { const saved = JSON.parse(sessionStorage.getItem("pam-listing-return") || "null"); if (saved && Date.now() - saved.at < 15 * 60 * 1000 && window.history.length > 1) { event.preventDefault(); window.history.back(); } } catch {} }}>← Back {quickReturnId ? "to Quick View" : "to products"}</a>
      {loading && <div className="empty-state">Loading product…</div>}
      {(error || !loading && !product) && <div className="empty-state"><h1>Product unavailable</h1><p>{error || "This product is no longer in the storefront."}</p><a href="/">Shop products</a></div>}
      {product && <>
        <nav className="breadcrumb"><a href="/">Home</a> / {product.category} / {product.name}</nav>
        <div className="product-detail-hero">
          <ProductOptions key={product.id} initialProduct={product} products={variants} onAdd={add} onSelectionChange={(variant) => { setSelectedVariant(variant); setPreviewSource(null); }} previewSource={previewSource} onOpenGallery={() => setLightboxIndex(Math.max(0, gallery.findIndex((image) => image.source.url === (previewSource || detailImageSource(product, selected)).url)))} footer={<div className="product-utilities"><button type="button" onClick={share} aria-label="Share product"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V3m0 0L7 8m5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>Share</button>{shared && <span>Link copied</span>}<a href={`/account?wishlist=${encodeURIComponent(product.id)}`} aria-label="Add to wishlist"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 8.5c0 4.2-8.8 10.1-8.8 10.1S3.2 12.7 3.2 8.5a4.4 4.4 0 0 1 8.8-.5 4.4 4.4 0 0 1 8.8.5Z"/></svg>Add to wishlist</a><button type="button" disabled title="Product comparison is coming soon" aria-label="Compare products"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h15m0 0-3-3m3 3-3 3M20 17H5m0 0 3-3m-3 3 3 3"/></svg>Compare</button></div>} />
          {gallery.length > 0 && <section className="product-gallery"><h2>Explore the details</h2><div className="product-gallery-grid">{gallery.map((item, index) => <button type="button" className={(previewSource || detailImageSource(product, selected)).url === item.source.url ? "selected" : ""} key={`${item.source.url}-${index}`} onClick={() => { setPreviewSource(item.source); setLightboxIndex(index); }} aria-label={`View ${item.label} full screen`}><ProductImage product={selected} source={item.source} width={240} /><span>{item.label}</span></button>)}</div></section>}
          <div className="detail-section">
            <section className="detail-info-card"><h2>Description</h2><p>{product.description || product.name}</p></section>
            <section className="detail-info-card"><h2>Product details</h2><dl><dt>SKU</dt><dd>{product.id}</dd>{product.productGroupId && <><dt>Product ID</dt><dd>{product.productGroupId}</dd><dt>Variant ID</dt><dd>{product.id}</dd></>}{product.size && <><dt>Size</dt><dd>{product.size}</dd></>}{product.colour && <><dt>Colour</dt><dd>{product.colour}</dd></>}</dl></section>
            <section className="detail-info-card delivery-card"><h2><span className="delivery-truck-icon" aria-hidden="true"><svg viewBox="0 0 32 32" width="25" height="25" fill="none"><path d="M3 8h16v14H3zM19 13h5l5 5v4H19z" fill="#FFD166"/><path d="M23 15v4h5" stroke="#00235B" strokeWidth="1.5"/><circle cx="9" cy="23" r="3" fill="#fff"/><circle cx="24" cy="23" r="3" fill="#fff"/><circle cx="9" cy="23" r="1" fill="#00235B"/><circle cx="24" cy="23" r="1" fill="#00235B"/></svg></span> Delivery &amp; pickup</h2><p>Choose delivery or pickup when you order. Need help deciding? Our team is a message away.</p></section>
          </div>
        </div>
        <div className="product-detail-lower">
          {related.length > 0 && <section className="related-products"><h2>You may also like</h2><div className="related-grid">{related.map((item) => <a href={`/products/${encodeURIComponent(item.id)}`} key={item.id}><ProductImage product={item} /><b>{item.name}</b></a>)}</div></section>}
        </div>
      </>}
    </main>
    {added && <div className="modal-backdrop" role="presentation"><div className="modal" role="dialog" aria-modal="true" aria-label="Added to cart"><h2>Added to cart</h2><p>{added.quantity} × {added.name}</p><p>SKU: {added.id}{added.colour && ` · ${added.colour}`}{added.size && ` · ${added.size}`}</p><div className="added-actions"><button className="button secondary" onClick={() => setAdded(null)}>Continue shopping</button><a className="button primary" href={cartUrl} onClick={rememberCartPosition}>View cart</a></div></div></div>}
    {lightboxIndex >= 0 && gallery.length > 0 && <div className="image-lightbox" role="dialog" aria-modal="true" aria-label="Product image gallery" onClick={(event) => { if (gesture.current.dragged) { gesture.current.dragged = false; return; } if (event.target === event.currentTarget) setLightboxIndex(-1); }} onPointerDown={(event) => { gesture.current.x = event.clientX; gesture.current.y = event.clientY; gesture.current.dragged = false; }} onPointerUp={(event) => { const dx = event.clientX - gesture.current.x; const dy = event.clientY - gesture.current.y; if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) { gesture.current.dragged = true; setLightboxIndex((index) => (index + (dx < 0 ? 1 : -1) + gallery.length) % gallery.length); } }} onWheel={(event) => { if (Math.abs(event.deltaX) > 35 && Math.abs(event.deltaX) > Math.abs(event.deltaY) && Date.now() - gesture.current.lastWheel > 450) { gesture.current.lastWheel = Date.now(); setLightboxIndex((index) => (index + (event.deltaX > 0 ? 1 : -1) + gallery.length) % gallery.length); } }}><button type="button" className="image-lightbox-close" onClick={() => setLightboxIndex(-1)} aria-label="Close gallery">×</button><button type="button" className="image-lightbox-nav" onClick={(event) => { event.stopPropagation(); setLightboxIndex((index) => (index - 1 + gallery.length) % gallery.length); }} aria-label="Previous image">‹</button><div className="image-lightbox-frame" onClick={(event) => event.stopPropagation()}><div className="image-lightbox-slide" key={lightboxIndex}><ProductImage product={selected} source={gallery[lightboxIndex]?.source} width={2200} eager /></div><span>{lightboxIndex + 1} / {gallery.length}</span></div><button type="button" className="image-lightbox-nav" onClick={(event) => { event.stopPropagation(); setLightboxIndex((index) => (index + 1) % gallery.length); }} aria-label="Next image">›</button></div>}
  </div>;
}

