"use client";

import { useEffect, useMemo, useState } from "react";
import WhatsAppIcon from "@/components/WhatsAppIcon";
import { PRIMARY_WHATSAPP } from "@/lib/shop";
import { quantityOfferMessage } from "@/lib/quantityOffer.mjs";
import { promotionPrice } from "@/lib/catalogueBrowse.mjs";
import { priceCart } from "@/lib/cartPricing.mjs";
import { cardImageSource, detailImageSource, getProductImageUrl } from "@/lib/productImages.mjs";

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

export default function ProductOptions({ initialProduct, products, discountRules = [], onAdd, compact = false, onClose, onSelectionChange, previewSource, onOpenGallery, onNavigateDetail, footer }) {
  const [selectedId, setSelectedId] = useState(initialProduct.id);
  const [quantity, setQuantity] = useState(1);
  const selected = products.find((item) => item.id === selectedId) || initialProduct;
  const defaultSource = detailImageSource(initialProduct, selected);
  const displayedSource = previewSource || defaultSource;
  useEffect(() => { onSelectionChange?.(selected); }, [selected.id]);
  const variants = useMemo(() => productVariants(initialProduct, products), [initialProduct, products]);
  const hasVariants = variants.length > 1;
  const sizes = [...new Set(variants.map((item) => item.size).filter(Boolean))];
  const colours = [...new Set(variants.filter((item) => item.size === selected.size).map((item) => item.colour).filter(Boolean))];
  const chooseSize = (size) => {
    const matching = variants.filter((item) => item.size === size && item.stock > 0);
    const next = matching.find((item) => item.colour === selected.colour) || matching[0];
    if (next) { setSelectedId(next.id); setQuantity(1); }
  };
  const chooseColour = (colour) => {
    const next = variants.find((item) => item.size === selected.size && item.colour === colour && item.stock > 0);
    if (next) { setSelectedId(next.id); setQuantity(1); }
  };
  const optionPricing = priceCart([{ ...selected, quantity }], discountRules);
  const whatsappText = `Hello PAM Essentials & More 👋\n\nI'd like to order:\n1. ${selected.name}\n${[selected.colour && `Colour: ${selected.colour}`, selected.size && `Size: ${selected.size}`].filter(Boolean).join("\n")}\nSKU: ${selected.id}\nQty: ${quantity}\nPrice: ${money.format(selected.price)}\nSubtotal: ${money.format(optionPricing.subtotal)}\n${optionPricing.discount > 0 ? `Discount: ${money.format(optionPricing.discount)}\n` : ""}Total: ${money.format(optionPricing.total)}\n\nName:\nPhone:\nDelivery/Pickup:\n${selected.randomColours ? "Preferred colour/notes:" : "Notes:"}`;
  return <div className={`product-options ${compact ? "compact" : ""}`}>
    <ProductPreview product={selected} source={displayedSource} onOpenGallery={onOpenGallery} />
    <div className="product-option-body">
      <div className="product-option-top">{compact && <button type="button" className="icon-button" onClick={onClose} aria-label="Close Quick View">×</button>}</div>
      <h2>{selected.name}</h2><p className="detail-price">{promotionPrice(selected, discountRules) != null ? <><del>{money.format(selected.price)}</del> <strong>{money.format(promotionPrice(selected, discountRules))}</strong></> : money.format(selected.price)}</p>
      <p className={selected.stock <= 0 ? "stock-label out" : selected.stock < Number(selected.lowStockLevel ?? 8) ? "stock-label low" : "stock-label"}>{selected.stock > 0 ? `✓ In stock${selected.stock < Number(selected.lowStockLevel ?? 8) ? " · Low stock" : ""}` : "Out of Stock"}</p>
      <p className="sku">SKU: {selected.id}</p>
      {selected.randomColours && <p className="colour-note">Random colours unless you indicate a choice in checkout notes.</p>}
      {hasVariants && <div className="variant-controls">
        <div className="selection-summary"><b>Your selection</b><span>{[selected.size, selected.colour].filter(Boolean).join(" · ") || selected.name}</span>{selected.id !== initialProduct.id && <button type="button" onClick={() => { setSelectedId(initialProduct.id); setQuantity(1); }}>Back to original selection</button>}</div>
        {colours.length > 0 && <fieldset><legend>Other colours for this size</legend><div className="variant-choice-list">{colours.map((colour) => { const item = variants.find((entry) => entry.size === selected.size && entry.colour === colour); return <button type="button" key={colour} className={item?.id === selected.id ? "variant-choice selected" : "variant-choice"} disabled={!item || item.stock <= 0} title={item?.stock > 0 ? "" : "Out of Stock"} onClick={() => chooseColour(colour)}>{colour}{item?.stock <= 0 && <small>Out of Stock</small>}</button>; })}</div></fieldset>}
        {sizes.length > 0 && <fieldset><legend>Other sizes for this product</legend><div className="variant-choice-list">{sizes.map((size) => { const inStock = variants.some((item) => item.size === size && item.stock > 0); return <button type="button" key={size} className={size === selected.size ? "variant-choice selected" : "variant-choice"} disabled={!inStock} title={inStock ? "Available colours for this size" : "Out of Stock"} onClick={() => chooseSize(size)}>{size}{!inStock && <small>Out of Stock</small>}</button>; })}</div><small>Choose a size to see available colours for this size.</small></fieldset>}
      </div>}
      <label className="quantity-control">Quantity <span className="stepper"><button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} aria-label="Decrease quantity">−</button><input type="number" min="1" max={selected.stock} value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.min(selected.stock, Number(event.target.value) || 1)))} aria-label={`Quantity of ${selected.name}`} /><button type="button" onClick={() => setQuantity(Math.min(selected.stock, quantity + 1))} aria-label="Increase quantity" disabled={quantity >= selected.stock}>+</button></span></label>
      {quantityOfferMessage(selected, quantity, discountRules) && <p className="quantity-offer-note">{quantityOfferMessage(selected, quantity, discountRules)}</p>}
      <button type="button" className="button primary full" disabled={selected.stock <= 0} onClick={() => onAdd(selected, quantity)}>{selected.stock > 0 ? "Add to cart" : "Out of Stock"}</button>
      {selected.stock <= 0 ? <a className="button secondary full" target="_blank" rel="noreferrer" href={`https://wa.me/${PRIMARY_WHATSAPP}?text=${encodeURIComponent(`Please notify me when ${selected.name} (${selected.id}) is available.`)}`}>Notify me when available</a> : <a className="button whatsapp full" target="_blank" rel="noreferrer" href={`https://wa.me/${PRIMARY_WHATSAPP}?text=${encodeURIComponent(whatsappText)}`}><WhatsAppIcon size={18} /> Order via WhatsApp</a>}
      {compact && <a href={`/products/${encodeURIComponent(selected.id)}?quick=${encodeURIComponent(initialProduct.id)}`} className="detail-link" onClick={onNavigateDetail}>View full product details →</a>}
      {footer}
    </div>
  </div>;
}

