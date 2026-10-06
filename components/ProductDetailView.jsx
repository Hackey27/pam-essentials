"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ProductOptions, { ProductImage, productVariants } from "@/components/ProductOptions";
import { addToCart, readCart, saveCart } from "@/lib/storeCart";
import { detailImageSource, productGallery } from "@/lib/productImages.mjs";
import BrandLogo from "@/components/BrandLogo";
import CustomerFooter from "@/components/CustomerFooter";
import PaymentDetails from "@/components/PaymentDetails";
import DeliveryInformationDialog from "@/components/DeliveryInformationDialog";
import { loadStorefrontCatalogue } from "@/lib/storefrontCatalogue";
import { CURRENT_SHOP_ADDRESS } from "@/lib/shopAddress.mjs";
import { readCompare, toggleCompare } from "@/lib/compare.mjs";
import { productOptions, variantDetail, variantTitles } from "@/lib/variantDisplay.mjs";

export default function ProductDetailView({ id, initialCatalogue, embedded = false, onBack, onCartChange, onOverlayChange }) {
  const [products, setProducts] = useState(initialCatalogue?.products || []);
  const [discountRules, setDiscountRules] = useState(initialCatalogue?.discountRules || []);
  const [compareNotice, setCompareNotice] = useState("");
  const [loading, setLoading] = useState(!initialCatalogue);
  const [error, setError] = useState("");
  const [added, setAdded] = useState(null);
  const [catalogue, setCatalogue] = useState(initialCatalogue || {});
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const closeDelivery = useCallback(() => setDeliveryOpen(false), []);
  const backButton = useRef(null);
  useEffect(() => {
    if (!embedded) return;
    const previousFocus = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    backButton.current?.focus();
    return () => { document.body.style.overflow = overflow; requestAnimationFrame(() => previousFocus?.focus()); };
  }, [embedded]);
  const [shared, setShared] = useState(false);
  const [quickReturnId, setQuickReturnId] = useState("");
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [previewSource, setPreviewSource] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const gesture = useRef({ x: 0, y: 0, lastWheel: 0, dragged: false });
  const activeOverlay = deliveryOpen ? "delivery" : lightboxIndex >= 0 ? "gallery" : added ? "added" : "";
  const overlayRef = useRef("");
  const previousOverlay = useRef("");
  const closingOverlay = useRef(false);
  overlayRef.current = activeOverlay;
  const dismissNestedOverlay = useCallback(() => {
    if (overlayRef.current === "delivery") setDeliveryOpen(false);
    else if (overlayRef.current === "gallery") setLightboxIndex(-1);
    else if (overlayRef.current === "added") setAdded(null);
  }, []);
  useEffect(() => { onOverlayChange?.(activeOverlay, dismissNestedOverlay); }, [activeOverlay, dismissNestedOverlay, onOverlayChange]);
  useEffect(() => () => onOverlayChange?.("", null), [onOverlayChange]);
  useEffect(() => {
    if (embedded || window.innerWidth > 767) return;
    const onBack = (event) => {
      if (closingOverlay.current) { closingOverlay.current = false; event.stopImmediatePropagation(); return; }
      if (overlayRef.current) event.stopImmediatePropagation();
      if (overlayRef.current === "delivery") setDeliveryOpen(false);
      else if (overlayRef.current === "gallery") setLightboxIndex(-1);
      else if (overlayRef.current === "added") setAdded(null);
    };
    window.addEventListener("popstate", onBack, true);
    return () => window.removeEventListener("popstate", onBack, true);
  }, []);
  useEffect(() => {
    if (embedded || window.innerWidth > 767) return;
    const previous = previousOverlay.current;
    if (activeOverlay && !previous) window.history.pushState({ ...window.history.state, pamProductOverlay: activeOverlay }, "", window.location.href);
    else if (activeOverlay && previous && window.history.state?.pamProductOverlay) window.history.replaceState({ ...window.history.state, pamProductOverlay: activeOverlay }, "", window.location.href);
    else if (!activeOverlay && previous && window.history.state?.pamProductOverlay) { closingOverlay.current = true; window.history.back(); }
    previousOverlay.current = activeOverlay;
  }, [activeOverlay]);
  useEffect(() => { setQuickReturnId(new URLSearchParams(window.location.search).get("quick") || ""); }, []);
  useEffect(() => {
    if (initialCatalogue) return;
    let live = true;
    loadStorefrontCatalogue().then((data) => {
      if (!live) return;
      setCatalogue(data);
      setProducts(data.products || []);
      setDiscountRules(data.discountRules || []);
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
    }).catch((reason) => { if (live) setError(reason.message); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [id, initialCatalogue]);
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
  const gallery = useMemo(() => product ? productGallery(product, selected, variants) : [], [product, selected, variants]);
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
    onCartChange?.();
  }
  async function share() {
    const url = new URL(`/products/${encodeURIComponent(selected.id)}`, window.location.origin).href;
    if (navigator.share) { try { await navigator.share({ title: selected.name, url }); return; } catch { return; } }
    await navigator.clipboard.writeText(url);
    setShared(true);
  }
  function compareProduct() {
    const current = readCompare(localStorage);
    if (current.length >= 4 && !current.includes(selected.id)) { setCompareNotice("You can compare up to four products. Remove one first."); return; }
    const next = toggleCompare(localStorage, selected.id);
    setCompareNotice(next.includes(selected.id) ? "Product added to comparison." : "Product removed from comparison.");
  }
  return <div className="product-page store-shell">
    <header className="product-page-header"><a className="brand" href="/" aria-label="PAM Essentials home"><BrandLogo /></a><a href={cartUrl} onClick={rememberCartPosition}>View cart</a></header>
    <main className="product-page-main">
      <a ref={backButton} className="detail-back" href={quickReturnId ? `/?quick=${encodeURIComponent(quickReturnId)}` : "/#catalogue"} onClick={(event) => {
        if (onBack) { event.preventDefault(); onBack(); return; }
        try {
          const saved = JSON.parse(sessionStorage.getItem("pam-listing-return") || "null");
          const recent = saved && Date.now() - saved.at < 15 * 60 * 1000;
          if (quickReturnId) {
            event.preventDefault();
            const path = recent && saved.path?.startsWith("/") && !saved.path.startsWith("//") ? saved.path : "/";
            const target = new URL(path, window.location.origin);
            target.searchParams.set("quick", quickReturnId);
            window.location.assign(target.pathname + target.search);
          } else if (recent && window.history.length > 1) {
            event.preventDefault();
            window.history.back();
          }
        } catch {}
      }}>← Back {onBack || quickReturnId ? "to Quick View" : "to products"}</a>
      {loading && <div className="empty-state">Loading product…</div>}
      {(error || !loading && !product) && <div className="empty-state"><h1>Product unavailable</h1><p>{error || "This product is no longer in the storefront."}</p><a href="/">Shop products</a></div>}
      {product && <>
        <nav className="breadcrumb"><a href="/">Home</a> / {selected.category} / {selected.name}</nav>
        <div className="product-detail-hero">
          <ProductOptions key={product.id} initialProduct={product} products={variants} discountRules={discountRules} onAdd={add} onSelectionChange={(variant) => { setSelectedVariant(variant); setPreviewSource(null); }} previewSource={previewSource} onPreviewChange={setPreviewSource} onOpenGallery={() => setLightboxIndex(Math.max(0, gallery.findIndex((image) => image.source.url === (previewSource || detailImageSource(product, selected)).url)))} footer={<div className="product-utilities"><button type="button" onClick={share} aria-label="Share product"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V3m0 0L7 8m5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>Share</button>{shared && <span>Link copied</span>}<a href={`/account?wishlist=${encodeURIComponent(selected.id)}`} aria-label="Add to wishlist"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 8.5c0 4.2-8.8 10.1-8.8 10.1S3.2 12.7 3.2 8.5a4.4 4.4 0 0 1 8.8-.5 4.4 4.4 0 0 1 8.8-.5Z"/></svg>Add to wishlist</a><button type="button" onClick={compareProduct} aria-label="Compare products"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h15m0 0-3-3m3 3-3 3M20 17H5m0 0 3-3m-3 3 3 3"/></svg>Compare</button>{compareNotice && <span role="status">{compareNotice}</span>}</div>} />
          {gallery.length > 0 && <section className="product-gallery"><h2>Explore the details</h2><div className="product-gallery-grid">{gallery.map((item, index) => <button type="button" className={(previewSource || detailImageSource(product, selected)).url === item.source.url ? "selected" : ""} key={`${item.source.url}-${index}`} onClick={() => { setPreviewSource(item.source); setLightboxIndex(index); }} aria-label={`View ${item.label} full screen`}><ProductImage product={selected} source={item.source} width={240} /><span>{item.label}</span></button>)}</div></section>}
          <div className="detail-section">
            <section className="detail-info-card"><h2>Description</h2><p>{selected.description || selected.name}</p></section>
            <section className="detail-info-card"><h2>Product details</h2><dl><dt>SKU</dt><dd>{selected.sku || selected.id}</dd>{selected.productGroupId && <><dt>Product ID</dt><dd>{selected.productGroupId}</dd><dt>Variant ID</dt><dd>{selected.id}</dd></>}{variantTitles(variants).map(({ title, key }) => productOptions(selected)[key] && <Fragment key={key}><dt>{title}</dt><dd>{productOptions(selected)[key]}</dd></Fragment>)}</dl></section>
            <section className="detail-info-card delivery-card"><h2><span className="delivery-truck-icon" aria-hidden="true"><svg viewBox="0 0 32 32" width="25" height="25" fill="none"><path d="M3 8h16v14H3zM19 13h5l5 5v4H19z" fill="#FFD166"/><path d="M23 15v4h5" stroke="#00235B" strokeWidth="1.5"/><circle cx="9" cy="23" r="3" fill="#fff"/><circle cx="24" cy="23" r="3" fill="#fff"/><circle cx="9" cy="23" r="1" fill="#00235B"/><circle cx="24" cy="23" r="1" fill="#00235B"/></svg></span> Delivery &amp; pickup</h2><p>Choose delivery or pickup when you order. Click <a href="/info/delivery" onClick={(event) => { if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); setDeliveryOpen(true); } }}>here to see</a> details. Need help deciding? Our team is a message away.</p></section>
            <PaymentDetails />
          </div>
        </div>
        <div className="product-detail-lower">
          {related.length > 0 && <section className="related-products"><h2>You may also like</h2><div className="related-grid">{related.map((item) => <a href={`/products/${encodeURIComponent(item.id)}`} key={item.id}><ProductImage product={item} /><b>{item.name}</b></a>)}</div></section>}
        </div>
      </>}
    </main>
    {embedded && <CustomerFooter storeLocation={catalogue.storeLocation} mapsUrl={catalogue.mapsUrl} dealsActive={catalogue.dealsActive} idPrefix="product-detail" />}
    {deliveryOpen && <DeliveryInformationDialog storeLocation={catalogue.storeLocation || CURRENT_SHOP_ADDRESS} onClose={closeDelivery} />}
    {added && <div className="modal-backdrop" role="presentation"><div className="modal" role="dialog" aria-modal="true" aria-label="Added to cart"><h2>Added to cart</h2><p>{added.quantity} × {added.name}</p><p>SKU: {added.sku || added.id}{variantDetail(added) && ` · ${variantDetail(added)}`}</p><div className="added-actions"><button className="button secondary" onClick={() => setAdded(null)}>Continue shopping</button><a className="button primary" href={cartUrl} onClick={rememberCartPosition}>View cart</a></div></div></div>}
    {lightboxIndex >= 0 && gallery.length > 0 && <div className="image-lightbox" role="dialog" aria-modal="true" aria-label="Product image gallery" onClick={(event) => { if (gesture.current.dragged) { gesture.current.dragged = false; return; } if (event.target === event.currentTarget) setLightboxIndex(-1); }} onPointerDown={(event) => { gesture.current.x = event.clientX; gesture.current.y = event.clientY; gesture.current.dragged = false; }} onPointerUp={(event) => { const dx = event.clientX - gesture.current.x; const dy = event.clientY - gesture.current.y; if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) { gesture.current.dragged = true; setLightboxIndex((index) => (index + (dx < 0 ? 1 : -1) + gallery.length) % gallery.length); } }} onWheel={(event) => { if (Math.abs(event.deltaX) > 35 && Math.abs(event.deltaX) > Math.abs(event.deltaY) && Date.now() - gesture.current.lastWheel > 450) { gesture.current.lastWheel = Date.now(); setLightboxIndex((index) => (index + (event.deltaX > 0 ? 1 : -1) + gallery.length) % gallery.length); } }}><button type="button" className="image-lightbox-close" onClick={() => setLightboxIndex(-1)} aria-label="Close gallery">×</button><button type="button" className="image-lightbox-nav" onClick={(event) => { event.stopPropagation(); setLightboxIndex((index) => (index - 1 + gallery.length) % gallery.length); }} aria-label="Previous image">‹</button><div className="image-lightbox-frame" onClick={(event) => event.stopPropagation()}><div className="image-lightbox-slide" key={lightboxIndex}><ProductImage product={selected} source={gallery[lightboxIndex]?.source} width={2200} eager /></div><span>{lightboxIndex + 1} / {gallery.length}</span></div><button type="button" className="image-lightbox-nav" onClick={(event) => { event.stopPropagation(); setLightboxIndex((index) => (index + 1) % gallery.length); }} aria-label="Next image">›</button></div>}
  </div>;
}

