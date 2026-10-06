"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import WhatsAppIcon from "@/components/WhatsAppIcon";
import { PRIMARY_WHATSAPP } from "@/lib/shop";
import { quantityOfferMessage } from "@/lib/quantityOffer.mjs";
import { promotionPrice } from "@/lib/catalogueBrowse.mjs";
import { priceCart } from "@/lib/cartPricing.mjs";
import { cardImageSource, detailImageSource, getProductImageUrl, productGallery } from "@/lib/productImages.mjs";
import { randomSelectionNote } from "@/lib/randomSelection.mjs";
import { productOptions, selectVariant, variantDetail, variantTitles } from "@/lib/variantDisplay.mjs";

const money = new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" });

export function productVariants(product, products) {
  return product?.productGroupId ? products.filter((item) => item.productGroupId === product.productGroupId) : [product].filter(Boolean);
}

export function variantPrice(variants) {
  const prices = variants.map((item) => Number(item.price)).filter((value) => value > 0);
  if (!prices.length) return "";
  const low = Math.min(...prices), high = Math.max(...prices);
  return low === high ? money.format(low) : `${money.format(low)} – ${money.format(high)}`;
}

export function ProductImage({ product, className = "", source, width = 350, eager = false }) {
  const resolved = source || cardImageSource(product);
  const url = resolved.path ? getProductImageUrl(resolved.path, width) : resolved.url;
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  if (url && !failed) return <img className={className || "product-photo"} src={url} alt={product.name} loading={eager ? "eager" : "lazy"} onError={() => setFailed(true)} />;
  const initials = product.name.split(" ").slice(0, 2).map((word) => word[0]).join("");
  return <div className={`product-art ${className}`} role="img" aria-label={`${product.name} image placeholder`}><span>{initials}</span><small>{[product.colour, product.size].filter(Boolean).join(" · ") || product.category}</small></div>;
}

function ProductPreview({ product, source, onOpenGallery }) {
  const [highResolution, setHighResolution] = useState("");
  const [hovering, setHovering] = useState(false);
  const [origin, setOrigin] = useState("50% 50%");
  useEffect(() => { setHighResolution(""); setHovering(false); }, [source.path, source.url]);
  function enter(event) {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches || !source.url) return;
    setHovering(true);
    if (source.path && !highResolution) {
      const url = getProductImageUrl(source.path, 2200);
      const preload = new window.Image();
      preload.onload = () => setHighResolution(url);
      preload.src = url;
    }
  }
  return <button type="button" className={`product-preview product-detail-image${hovering ? " is-zooming" : ""}`} onPointerEnter={enter} onPointerMove={(event) => { if (hovering) { const rect = event.currentTarget.getBoundingClientRect(); setOrigin(`${Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100))}% ${Math.max(0, Math.min(100, (event.clientY - rect.top) / rect.height * 100))}%`); } }} onPointerLeave={() => setHovering(false)} onClick={source.url && onOpenGallery ? onOpenGallery : undefined} aria-label={source.url ? `View ${product.name} image full screen` : `${product.name} image placeholder`} style={{ "--zoom-origin": origin }}>
    <ProductImage product={product} source={highResolution && hovering ? { path: "", url: highResolution } : source} className="product-preview-image" width={1000} eager />
  </button>;
}

export default function ProductOptions({ initialProduct, products, discountRules = [], onAdd, compact = false, onClose, onSelectionChange, previewSource, onPreviewChange, onOpenGallery, onNavigateDetail, footer }) {
  const [selectedId, setSelectedId] = useState(initialProduct.id);
  const [quantity, setQuantity] = useState(1);
  const selected = products.find((item) => item.id === selectedId) || initialProduct;
  const defaultSource = detailImageSource(initialProduct, selected);
  const [imageIndex, setImageIndex] = useState(0);
  const swipe = useRef({ x: 0, y: 0, moved: false });
  useEffect(() => { onSelectionChange?.(selected); }, [selected.id]);
  const variants = useMemo(() => productVariants(initialProduct, products), [initialProduct, products]);
  const images = useMemo(() => productGallery(initialProduct, selected, variants), [initialProduct, selected, variants]);
  const shownIndex = Math.min(imageIndex, Math.max(0, images.length - 1));
  const displayedSource = previewSource || images[shownIndex]?.source || defaultSource;
  useEffect(() => { setImageIndex(0); }, [selected.id]);
  function showImage(index) {
    const next = (index + images.length) % images.length;
    setImageIndex(next);
    onPreviewChange?.(images[next].source);
  }
  const currentImageIndex = images.findIndex((image) => image.source.url === displayedSource.url);
  const currentIndex = currentImageIndex >= 0 ? currentImageIndex : shownIndex;
  const hasVariants = variants.length > 1;
  const titles = useMemo(() => variantTitles(variants), [variants]);
  const chooseOption = (key, value) => {
    const next = selectVariant(variants, selected, key, value, key === "colour" && Boolean(productOptions(selected).size));
    if (next) { setSelectedId(next.id); setQuantity(1); setImageIndex(0); onPreviewChange?.(null); }
  };
  const optionPricing = priceCart([{ ...selected, quantity }], discountRules);
  const whatsappText = `Hello PAM Essentials & More 👋\n\nI'd like to order:\n1. ${selected.name}\n${titles.map(({ title, key }) => productOptions(selected)[key] && `${title}: ${productOptions(selected)[key]}`).filter(Boolean).join("\n")}\nSKU: ${selected.sku || selected.id}\nQty: ${quantity}\nPrice: ${money.format(selected.price)}\nSubtotal: ${money.format(optionPricing.subtotal)}\n${optionPricing.discount > 0 ? `Discount: ${money.format(optionPricing.discount)}\n` : ""}Total: ${money.format(optionPricing.total)}\n\nName:\nPhone:\nDelivery/Pickup:\n${selected.randomColours || selected.randomShapes ? "Preferred colour or shape/notes:" : "Notes:"}`;
  return <div className={`product-options ${compact ? "compact" : ""}`}>
    <section className="product-carousel" aria-label="Product images" tabIndex={images.length > 1 ? 0 : undefined} onKeyDown={(event) => { if (images.length > 1 && ["ArrowLeft", "ArrowRight"].includes(event.key)) { event.preventDefault(); showImage(currentIndex + (event.key === "ArrowRight" ? 1 : -1)); } }} onPointerDown={(event) => { swipe.current = { x: event.clientX, y: event.clientY, moved: false }; }} onPointerUp={(event) => { const dx = event.clientX - swipe.current.x, dy = event.clientY - swipe.current.y; if (images.length > 1 && Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) { swipe.current.moved = true; showImage(currentIndex + (dx < 0 ? 1 : -1)); } }} onClickCapture={(event) => { if (swipe.current.moved) { event.preventDefault(); event.stopPropagation(); swipe.current.moved = false; } }}>
      <ProductPreview product={selected} source={displayedSource} onOpenGallery={onOpenGallery} />
      {images.length > 1 && <><div className="product-carousel-controls"><button type="button" className="icon-button" onClick={() => showImage(currentIndex - 1)} aria-label="Previous product image">‹</button><span role="status" aria-live="polite">{currentIndex + 1} / {images.length}</span><button type="button" className="icon-button" onClick={() => showImage(currentIndex + 1)} aria-label="Next product image">›</button></div><div className="product-carousel-thumbnails">{images.map((image, index) => <button type="button" key={image.source.path || image.source.url} className={index === currentIndex ? "selected" : ""} aria-label={`Show product image ${index + 1}`} aria-pressed={index === currentIndex} onClick={() => showImage(index)}><ProductImage product={selected} source={image.source} width={160} /></button>)}</div></>}
    </section>
    <div className="product-option-body">
      <div className="product-option-top">{compact && <button type="button" className="icon-button" onClick={onClose} aria-label="Close Quick View">×</button>}</div>
      <h2>{selected.name}</h2><p className="detail-price">{promotionPrice(selected, discountRules) != null ? <><del>{money.format(selected.price)}</del> <strong>{money.format(promotionPrice(selected, discountRules))}</strong></> : money.format(selected.price)}</p>
      <p className={selected.stock <= 0 ? "stock-label out" : selected.stock < Number(selected.lowStockLevel ?? 8) ? "stock-label low" : "stock-label"}>{selected.stock > 0 ? `✓ In stock${selected.stock < Number(selected.lowStockLevel ?? 8) ? " · Low stock" : ""}` : "Out of Stock"}</p>
      <p className="sku">SKU: {selected.sku || selected.id}</p>
      {randomSelectionNote(selected) && <p className="colour-note">{randomSelectionNote(selected)}</p>}
      {hasVariants && <div className="variant-controls">
        <div className="selection-summary"><b>Your selection</b><span>{variantDetail(selected, titles) || selected.name}</span>{selected.id !== initialProduct.id && <button type="button" onClick={() => { setSelectedId(initialProduct.id); setQuantity(1); }}>Back to original selection</button>}</div>
        {titles.map(({ title, key }) => { const values = [...new Set(variants.map((item) => productOptions(item)[key]).filter(Boolean))]; const otherTitles = key === "colour" && titles.some((item) => item.key === "size") ? "size" : ""; const strict = key === "colour" && Boolean(productOptions(selected).size); const plural = /s$/i.test(title) ? title.toLowerCase() : `${title.toLowerCase()}s`; return <fieldset key={key}><legend>{`Other ${plural}${otherTitles ? ` for this ${otherTitles}` : " available for this product"}`}</legend><div className="variant-choice-list">{values.map((value) => { const next = selectVariant(variants, selected, key, value, strict); const active = productOptions(selected)[key] === value; return <button type="button" key={value} className={active ? "variant-choice selected" : "variant-choice"} disabled={!next && !active} title={next || active ? "" : "Out of Stock"} onClick={() => chooseOption(key, value)}>{value}{!next && !active && <small>Out of Stock</small>}</button>; })}</div>{key === "size" && titles.some((item) => item.key === "colour") && <small>Choose a size to see available colours for this size.</small>}</fieldset>; })}
      </div>}
      <label className="quantity-control">Quantity <span className="stepper"><button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} aria-label="Decrease quantity">−</button><input type="number" min="1" max={selected.stock} value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.min(selected.stock, Number(event.target.value) || 1)))} aria-label={`Quantity of ${selected.name}`} /><button type="button" onClick={() => setQuantity(Math.min(selected.stock, quantity + 1))} aria-label="Increase quantity" disabled={quantity >= selected.stock}>+</button></span></label>
      {quantityOfferMessage(selected, quantity, discountRules) && <p className="quantity-offer-note">{quantityOfferMessage(selected, quantity, discountRules)}</p>}
      <button type="button" className="button primary full" disabled={selected.stock <= 0} onClick={() => onAdd(selected, quantity)}>{selected.stock > 0 ? "Add to cart" : "Out of Stock"}</button>
      {selected.stock <= 0 ? <a className="button secondary full" target="_blank" rel="noreferrer" href={`https://wa.me/${PRIMARY_WHATSAPP}?text=${encodeURIComponent(`Please notify me when ${selected.name} (${selected.id}) is available.`)}`}>Notify me when available</a> : <a className="button whatsapp full" target="_blank" rel="noreferrer" href={`https://wa.me/${PRIMARY_WHATSAPP}?text=${encodeURIComponent(whatsappText)}`}><WhatsAppIcon size={18} /> Order via WhatsApp</a>}
      {compact && <a href={`/products/${encodeURIComponent(selected.id)}?quick=${encodeURIComponent(initialProduct.id)}`} className="detail-link" onClick={(event) => onNavigateDetail?.(event, selected)}>View full product details →</a>}
      {footer}
    </div>
  </div>;
}

