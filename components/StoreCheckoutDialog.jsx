"use client";

import {wholesaleAvailableUnits,wholesaleSize,wholesaleUnitName,wholesaleStepUnits,wholesaleMinimumUnits,displayQuantity,displayUnitPrice,packDescription} from "@/lib/wholesaleUnits.mjs";
import { useEffect, useRef, useState } from "react";
import { ProductImage } from "@/components/ProductOptions";
import { variantDetail } from "@/lib/variantDisplay.mjs";
import { randomSelectionNote } from "@/lib/randomSelection.mjs";
import { courierFeeLabel } from "@/lib/shopPreferences.mjs";
import FulfilmentEstimate from "@/components/FulfilmentEstimate";
import PaymentDetails from "@/components/PaymentDetails";
import WhatsAppIcon from "@/components/WhatsAppIcon";
import useAdminModal from "@/components/useAdminModal";

const money = new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" });
const methods = { pickup: "Shop pickup", "delivery-self": "Your own courier", "delivery-shop": "Shop-arranged delivery" };

export default function StoreCheckoutDialog({ products, cart, pricing, order, setOrder, storeLocation, preferences, busy, error, confirmation, signedIn, onClose, onCart, onSubmit, onWhatsApp, onQuantity, undoToast, purchaseMode = "retail", invalid = false }) {
  const panel = useAdminModal(onClose, busy);
  const form = useRef(null);
  const summary = useRef(null);
  const checkoutActions = useRef(null);
  const [stacked, setStacked] = useState(false);
  useEffect(() => {
    const viewport = window.matchMedia("(max-width: 1179.98px)");
    const updateLayout = () => setStacked(viewport.matches);
    updateLayout();
    viewport.addEventListener("change", updateLayout);
    return () => viewport.removeEventListener("change", updateLayout);
  }, []);
  const complete = Boolean(confirmation);
  const lines = complete ? confirmation.items : cart;
  const totals = complete ? confirmation : pricing;
  const method = complete ? confirmation.deliveryMethod : order.deliveryMethod;
  const address = complete ? confirmation.deliveryAddress : order.deliveryAddress;
  const update = (key, value) => setOrder(current => ({ ...current, [key]: value }));
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);
  useEffect(() => { if (complete) panel.current?.querySelector(".checkout-complete-title")?.focus({ preventScroll: true }); }, [complete]);
  function whatsapp() { if (form.current?.reportValidity()) onWhatsApp(); }
  const step = item => purchaseMode === "wholesale" ? wholesaleStepUnits(item) : 1;
  const size=item=>purchaseMode==="wholesale"?wholesaleSize(item):1;
  const available=item=>purchaseMode==="wholesale"?wholesaleAvailableUnits(item):item.stock;
  const actions = <div className="checkout-payment-actions">
    <button type="button" className="button secondary full" disabled title="Online payment will be available when a payment provider is configured">Pay now · coming soon</button>
    <button type="submit" form="store-checkout-form" className="button accent full" disabled={busy || !cart.length || invalid}>{busy ? "Creating order…" : "Pay on pickup/delivery"}</button>
    <button type="button" className="button whatsapp full" disabled={busy || !cart.length || invalid} onClick={whatsapp}><WhatsAppIcon size={17} /> Order on WhatsApp</button>
    <button type="button" className="checkout-continue" disabled={busy} onClick={onClose}>Continue browsing</button>
  </div>;
  const detailsPane = <div key="details" className="checkout-details-pane">
          {complete ? <div className="checkout-complete"><span className="success-mark">✓</span><h3 className="checkout-complete-title" tabIndex={-1}>Order received</h3><p>Your order is saved. Keep this reference for pickup or delivery.</p><strong className="order-reference">{confirmation.orderId}</strong><FulfilmentEstimate method={method} snapshot={confirmation.fulfilmentDetails} /><p>{signedIn ? "Follow your order in your account." : "Create a customer account and link this guest order to track it."}</p><a className="button secondary" href="/account#orders">Track my order</a><button type="button" className="button primary" onClick={onClose}>Continue browsing</button></div> : <>
            <form ref={form} id="store-checkout-form" className="checkout-form" onSubmit={onSubmit}>
              <fieldset disabled={busy}>
                <legend>Delivery &amp; pickup</legend><p className="checkout-section-note">Choose how you would like to receive your order.</p>
                <label>Fulfilment<select value={order.deliveryMethod} onChange={event => update("deliveryMethod", event.target.value)}>{Object.entries(methods).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <div className="checkout-contact-grid"><label>Full name<input autoComplete="name" required maxLength={120} value={order.customer} onChange={event => update("customer", event.target.value)} /></label><label>Mobile number<input autoComplete="tel" type="tel" required pattern="[+0-9 ()-]{7,25}" maxLength={25} value={order.phone} onChange={event => update("phone", event.target.value)} /></label></div>
                {method === "pickup" ? <p className="checkout-location">Collect from <b>{storeLocation}</b></p> : <>
                  {method === "delivery-self" && <p className="checkout-location">Your courier collects from <b>{storeLocation}</b>. Keep your order reference handy for confirmation.</p>}
                  <label>Delivery destination or landmark{method === "delivery-self" && " (optional)"}<input autoComplete="street-address" required={method === "delivery-shop"} maxLength={500} value={order.deliveryAddress} onChange={event => update("deliveryAddress", event.target.value)} /></label>
                </>}
                <FulfilmentEstimate method={method} compact expandable />
                <PaymentDetails compact />
                <label>Order notes (optional)<textarea rows={2} maxLength={1000} placeholder="type specific details or requests here" value={order.notes} onChange={event => update("notes", event.target.value)} /></label>
              </fieldset>
            </form>
            <p className="checkout-guest-note">Guest checkout is welcome. An account is optional.</p>
          </>}
        </div>;
  const orderPane = <aside key="order" ref={summary} className="checkout-order-pane" aria-labelledby="checkout-order-title">
          <h3 id="checkout-order-title">{purchaseMode === "wholesale" ? "Your wholesale order" : "Your order"} <span>{lines.reduce((sum, line) => sum + line.quantity, 0)} {purchaseMode==="wholesale"?"pieces":"items"}</span></h3>
          <div className="checkout-order-items">{!lines.length && <p className="checkout-empty">Your cart is empty. Go back to your cart or continue browsing.</p>}{lines.map((item, index) => {
            const line = complete ? item : pricing.lines.find(entry => entry.id === item.id);
            const imageProduct = complete ? { ...products.find(product => (product.sku || product.id) === item.sku), ...item } : item;
            return <article className="checkout-order-item" key={item.id || item.sku || index}>
              {!complete && <button type="button" className="checkout-item-remove" aria-label={`Remove ${item.name} from cart`} disabled={busy} onClick={() => onQuantity(item.id, 0)}>×</button>}
              <ProductImage product={imageProduct} width={100} className="cart-product-photo" />
              <div className="checkout-item-info"><h4>{item.name}</h4>{variantDetail(item) && <p>{variantDetail(item)}</p>}{randomSelectionNote(item, complete ? confirmation.notes : order.notes) && <p className="checkout-random-note">{randomSelectionNote(item, complete ? confirmation.notes : order.notes)}</p>}<p>{money.format(displayUnitPrice(item))} {size(item)>1?"per "+wholesaleUnitName(item):"each"}</p>{packDescription(item)&&<p className="wholesale-pack-summary">{packDescription(item)}</p>}</div>
              <div className="checkout-item-purchase"><strong className="checkout-item-total">{money.format(line?.lineTotal || 0)}</strong>{complete ? <p>Quantity: {displayQuantity(item)} {size(item)>1?wholesaleUnitName(item,true):""}</p> : <div className="stepper"><button type="button" disabled={busy} aria-label={`Decrease ${item.name} quantity`} onClick={() => onQuantity(item.id, item.quantity - step(item))}>−</button><input type="number" min={purchaseMode === "wholesale" ? item.wholesale?.minQty || 1 : 1} step={step(item)/size(item)} max={Math.floor(available(item)/size(item))} disabled={busy} aria-label={`Quantity of ${item.name}`} value={displayQuantity(item)} onChange={event => onQuantity(item.id, Math.max(1, Number(event.target.value) || 1)*size(item))} /><button type="button" disabled={busy || item.quantity + step(item) > available(item)} aria-label={`Increase ${item.name} quantity`} onClick={() => onQuantity(item.id, item.quantity + step(item))}>+</button></div>}</div>
            </article>;
          })}</div>
          <div className="checkout-order-summary">
            <div className="cart-total"><span>Subtotal</span><strong>{money.format(totals.subtotal)}</strong></div>{totals.discount > 0 && <div className="cart-total discount-total"><span>Discount</span><strong>−{money.format(totals.discount)}</strong></div>}<div className="cart-total grand-total"><span>Total</span><strong>{money.format(totals.total)}</strong></div>
            <dl className="checkout-fulfilment-summary"><dt>Delivery mode</dt><dd>{methods[method]}</dd><dt>{method === "pickup" ? "Pickup location" : "Collection / dispatch"}</dt><dd>{complete ? confirmation.originAddress : storeLocation}</dd>{method !== "pickup" && address && <><dt>Delivery address</dt><dd>{address}</dd></>}</dl>
            {method === "delivery-shop" && <p className="cart-fee-note">{courierFeeLabel(complete ? confirmation.fulfilmentDetails : preferences)}. Paid separately to the courier.</p>}
            {!complete && !stacked && actions}
          </div>
        </aside>;
  return <div className="store-checkout-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section ref={panel} className="store-checkout-dialog" role="dialog" aria-modal="true" aria-labelledby="checkout-dialog-title" aria-busy={busy}>
      <header className="checkout-dialog-header"><div><p className="eyebrow">PAM Essentials &amp; More</p><h2 id="checkout-dialog-title">{complete ? "Thank you for your order" : "Checkout"}</h2></div><button type="button" className="icon-button" aria-label="Close checkout" disabled={busy} onClick={onClose}>×</button></header>
      <nav className="checkout-steps" aria-label="Order steps">
        <button type="button" disabled={busy} onClick={onCart}><span>1</span>Your cart</button><span className="checkout-step-arrow" aria-hidden="true">→</span>
        <button type="button" aria-current={!complete ? "step" : undefined} disabled={complete || busy}><span>2</span>Checkout</button><span className="checkout-step-arrow" aria-hidden="true">→</span>
        <button type="button" aria-current={complete ? "step" : undefined} disabled={!complete || busy} onClick={() => panel.current?.querySelector(".checkout-complete-title")?.focus()} title={!complete ? "Available after your order is successfully saved" : undefined}><span>3</span>Order complete</button>
      </nav>
      {error && <p className="notice error-notice checkout-error" role="alert">{error}</p>}
      {undoToast}
      <div className="checkout-dialog-body">
        {stacked ? <>{orderPane}{detailsPane}</> : <>{detailsPane}{orderPane}</>}
        {!complete && stacked && <section ref={checkoutActions} className="checkout-stacked-actions" aria-labelledby="checkout-options-title"><h3 id="checkout-options-title">Checkout options</h3>{actions}</section>}
      </div>
      {!complete && <div className="checkout-mobile-summary"><span>Total <strong>{money.format(pricing.total)}</strong></span><button type="button" className="button accent" onClick={() => checkoutActions.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>Checkout options ↓</button></div>}
    </section>
  </div>;
}
