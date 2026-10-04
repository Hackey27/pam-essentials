"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cardImageSource } from "@/lib/productImages.mjs";
import PosQuantityStepper from "@/components/PosQuantityStepper";
import { activeRule } from "@/lib/discount.mjs";
import { appliedOfferBadge, appliedOfferLabel } from "@/lib/quantityOffer.mjs";
import { isPromotion, promotionPrice } from "@/lib/catalogueBrowse.mjs";

const money = new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" });

export default function PosTill({ shift, role, query, setQuery, barcode, setBarcode, barcodeInput, scanBarcode, onScannedCode, scanMatches, setScanMatches, category, setCategory, categories, stockFilter, setStockFilter, visible, add, cart, setCart, cartNotice, setCartNotice, change, setQuantity, pricing, discountRules = [], orderReference, setOrderReference, orderChannel, setOrderChannel, customerName, setCustomerName, customerPhone, setCustomerPhone, paymentMethod, setPaymentMethod, amountPaid, setAmountPaid, transactionVerified, setTransactionVerified, changeDue, paymentReady, referenceReady, online, busy, setConfirmSale }) {
  const { subtotal, discount, total } = pricing;
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [scannerMessage, setScannerMessage] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const controlsRef = useRef(null);
  const frameRef = useRef(0);
  function closeCamera() {
    cancelAnimationFrame(frameRef.current);
    controlsRef.current?.stop();
    controlsRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }
  async function openCamera() {
    if (!navigator.mediaDevices?.getUserMedia) { setScannerMessage("Camera scanning is unavailable here. Use the code field with a connected scanner or type the code."); barcodeInput.current?.focus(); return; }
    try {
      if (!window.BarcodeDetector) { detectorRef.current = null; setScannerMessage(""); setCameraOpen(true); return; }
      const supported = typeof window.BarcodeDetector.getSupportedFormats === "function" ? await window.BarcodeDetector.getSupportedFormats() : ["qr_code", "code_128", "ean_13"];
      const formats = ["qr_code", "code_128", "code_39", "code_93", "ean_13", "ean_8", "upc_a", "upc_e", "data_matrix", "pdf417"].filter((format) => supported.includes(format));
      if (!formats.length) throw new Error("This camera does not support product barcode or QR scanning.");
      detectorRef.current = new window.BarcodeDetector({ formats });
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" } } });
      setScannerMessage("");
      setCameraOpen(true);
    } catch (error) { setScannerMessage(error?.name === "NotAllowedError" ? "Camera permission was denied. Allow camera access or use the code field." : error?.message || "Could not start the camera. Use the code field instead."); }
  }
  useEffect(() => {
    if (!cameraOpen || !videoRef.current) return;
    const video = videoRef.current;
    let active = true;
    if (!detectorRef.current) {
      import("@zxing/browser").then(({ BrowserMultiFormatReader }) => {
        if (!active) return null;
        return new BrowserMultiFormatReader().decodeFromConstraints({ audio: false, video: { facingMode: "environment" } }, video, (result, _error, controls) => {
          if (result && active) { active = false; onScannedCode(result.getText()); controls.stop(); closeCamera(); }
        });
      }).then((controls) => { if (!active) controls?.stop(); else controlsRef.current = controls; }).catch((error) => { if (active) { closeCamera(); setScannerMessage(error?.name === "NotAllowedError" ? "Camera permission was denied. Allow camera access or use the code field." : "Camera scanning could not start. Use the code field instead."); } });
      return () => { active = false; controlsRef.current?.stop(); };
    }
    video.srcObject = streamRef.current;
    const inspect = async () => {
      if (!active) return;
      try {
        if (video.readyState >= 2) {
          const codes = await detectorRef.current.detect(video);
          if (codes.length && codes[0].rawValue) { onScannedCode(codes[0].rawValue); closeCamera(); return; }
        }
      } catch { /* A transient video frame can fail; keep scanning. */ }
      if (active) frameRef.current = requestAnimationFrame(inspect);
    };
    video.play().then(() => { frameRef.current = requestAnimationFrame(inspect); }).catch(() => { closeCamera(); setScannerMessage("Camera preview could not start. Use the code field instead."); });
    return () => { active = false; cancelAnimationFrame(frameRef.current); };
  }, [cameraOpen]);
  useEffect(() => () => { controlsRef.current?.stop(); streamRef.current?.getTracks().forEach((track) => track.stop()); cancelAnimationFrame(frameRef.current); }, []);
  const uniqueMatch = useMemo(() => visible.filter((product) => product.stock > 0), [visible]);
  const selectUnique = (event) => {
    if (event.key === "Enter" && uniqueMatch.length === 1) { event.preventDefault(); add(uniqueMatch[0]); setQuery(""); }
  };
  const suggestions = query.trim() ? visible.slice(0, 6) : [];
  const basketRows = cart.map((item) => ({ item, priced: pricing.lines.find((line) => line.id === item.id) }));
  const hasQuantityDiscount = discountRules.some((rule) => activeRule(rule) && rule.scopeType === "GLOBAL" && rule.discountType === "PERCENT" && Number(rule.value) === 5 && Number(rule.minQty) === 3);
  const clearBasket = () => { setCart([]); setCheckoutStep(false); setOrderReference(""); setOrderChannel("walk-in"); setCustomerName(""); setCustomerPhone(""); setAmountPaid(""); setTransactionVerified(false); };
  const printPreview = () => {
    document.body.classList.add("printing-pos-preview");
    window.addEventListener("afterprint", () => document.body.classList.remove("printing-pos-preview"), { once: true });
    window.print();
  };
  return <main className="pos-main">
    <section className="pos-catalogue">
      <div className="pos-title"><div><p className="eyebrow">Point of sale · {shift.shiftId}</p><h1>New sale</h1></div>{["owner", "admin"].includes(role) && <a className="button secondary" href="/admin">Admin Portal</a>}</div>
      <div className="pos-search-row"><div className="pos-search-wrap"><label htmlFor="pos-product-search">Search product name or SKU</label><input id="pos-product-search" className="pos-search" autoFocus placeholder="Start typing to filter products" value={query} onFocus={() => setShowSuggestions(true)} onBlur={() => setTimeout(() => setShowSuggestions(false), 150)} onChange={(event) => { setQuery(event.target.value); setShowSuggestions(true); }} onKeyDown={selectUnique} />{showSuggestions && suggestions.length > 0 && <div className="pos-suggestions" role="listbox" aria-label="Matching products">{suggestions.map((product) => <button type="button" role="option" aria-selected="false" key={product.id} disabled={product.stock <= 0} onMouseDown={(event) => event.preventDefault()} onClick={() => { add(product); setQuery(""); setShowSuggestions(false); }}>{cardImageSource(product).url ? <img src={cardImageSource(product).url} alt="" /> : <span className="product-monogram">{product.name.slice(0, 2).toUpperCase()}</span>}<span><b>{product.name}</b><small>{product.sku || product.id} · {money.format(product.price)}</small></span></button>)}</div>}</div><form className="pos-scan-actions" onSubmit={scanBarcode}><input ref={barcodeInput} className="pos-scanner-input" aria-label="Scanned barcode, QR code or SKU" autoComplete="off" value={barcode} onChange={(event) => setBarcode(event.target.value)} /><button type="button" className="button secondary" onClick={() => { if (window.matchMedia("(pointer: coarse)").matches) openCamera(); else { barcodeInput.current?.focus(); setScannerMessage("Scanner ready. Scan a barcode or type a code, then press Enter."); } }}>Scan Code</button><button type="button" className="button secondary" onClick={openCamera}>Use camera</button></form></div>
      {scannerMessage && <p className="notice" role="status">{scannerMessage}</p>}
      {scanMatches.length > 0 && <div className="pos-scan-matches" role="dialog" aria-label="Choose scanned product"><div className="drawer-title"><h2>Choose a product</h2><button type="button" className="icon-button" onClick={() => setScanMatches([])} aria-label="Close choices">×</button></div>{scanMatches.map((product) => <button type="button" key={product.id} disabled={product.stock <= 0} onClick={() => { add(product); setScanMatches([]); setBarcode(""); }}>{product.name} · {product.sku || product.id} {product.stock <= 0 ? "· Out of stock" : ""}</button>)}</div>}
      {cameraOpen && <div className="modal-backdrop pos-camera-backdrop"><div className="modal pos-camera-modal" role="dialog" aria-modal="true" aria-label="Scan product code"><div className="drawer-title"><h2>Scan Code</h2><button type="button" className="icon-button" onClick={closeCamera} aria-label="Close camera">×</button></div><video ref={videoRef} muted playsInline autoPlay /><p>Point the camera at a barcode or QR code.</p><button type="button" className="button secondary" onClick={closeCamera}>Cancel</button></div></div>}
      <section className="pos-basket-table" aria-label="Current basket">
        <div className="drawer-title"><div><p className="eyebrow">Current basket</p><h2>{cart.reduce((sum, item) => sum + item.quantity, 0)} items · {money.format(total)}</h2></div><button type="button" className="text-button" onClick={clearBasket} disabled={!cart.length}>Clear basket</button></div>
        {hasQuantityDiscount && <div className="pos-basket-rules"><strong>Buy 3 or more of the same product to get 5% off that product.</strong></div>}
        <div className="pos-basket-scroll"><table><thead><tr><th>ITEM</th><th>QTY</th><th>UNIT PRICE</th><th>SUBTOTAL</th></tr></thead><tbody>{basketRows.map(({ item, priced }) => <tr key={item.id}><td><div className="pos-basket-item"><span><b>{item.name}</b><small>{item.sku || item.id}</small></span><button type="button" className="pos-remove-line" aria-label={`Remove ${item.name} from basket`} onClick={() => setCart((current) => current.filter((line) => line.id !== item.id))}>×</button></div></td><td><PosQuantityStepper item={item} onChange={setQuantity} />{appliedOfferLabel(priced) && <small className="pos-line-discount">{appliedOfferLabel(priced)}</small>}</td><td>{money.format(item.price)}</td><td><span className="pos-line-total">{appliedOfferBadge(priced) && <span className="pos-line-discount">{appliedOfferBadge(priced)}</span>}<strong>{money.format(priced?.lineTotal || 0)}</strong></span></td></tr>)}</tbody></table>{!cart.length && <p className="pos-basket-empty">Add a product to start this sale.</p>}</div>
      </section>
      <div className="pos-filter-row"><label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label><label>Catalogue<select value={stockFilter} onChange={(event) => setStockFilter(event.target.value)}><option value="all">All products</option><option value="high">High demand</option><option value="low">Low stock</option><option value="out">Out of stock</option></select></label><span>{visible.length} matching products</span></div>
      <div className="pos-grid">{visible.map((product) => {
        const out = product.stock <= 0;
        const low = !out && product.stock < Number(product.lowStockLevel ?? 8);
        return <button key={product.id} className="pos-product" onClick={() => add(product)} disabled={out}>{isPromotion(product, discountRules) && <span className="promo-ribbon">Promo</span>}<span className="product-monogram">{product.name.slice(0, 2).toUpperCase()}</span><b>{product.name}</b><small>{product.sku || product.id}{[product.colour, product.size].filter(Boolean).length ? ` · ${[product.colour, product.size].filter(Boolean).join(" / ")}` : ""}</small><div><strong>{promotionPrice(product, discountRules) != null ? <><del>{money.format(product.price)}</del> {money.format(promotionPrice(product, discountRules))}</> : money.format(product.price)}</strong><span className={out ? "out" : low ? "low" : "healthy"}>{out ? "Out of stock" : low ? `Low stock · ${product.stock} left` : `${product.stock} in stock`}</span></div></button>;
      })}</div>
    </section>
    <aside className={`till-cart ${cartOpen ? "open" : ""} ${checkoutStep ? "checkout-step" : ""}`}><div className="drawer-title"><div><p className="eyebrow">Receipt preview</p><h2>{cart.reduce((sum, item) => sum + item.quantity, 0)} items · {money.format(total)}</h2></div><button type="button" className="pos-cart-toggle" aria-expanded={cartOpen} onClick={() => { setCartOpen((open) => !open); setCheckoutStep(false); }}>{cartOpen ? "Close basket" : "View basket"}</button><button type="button" className="text-button pos-mobile-clear" onClick={clearBasket}>Clear</button></div>
      <div className="pos-live-receipt"><div className="pos-live-receipt-paper"><img src="/brand/pam-lockup-navy.svg" alt="PAM Essentials & More" /><p>Receipt preview · Final receipt number after sale</p><div className="pos-live-receipt-lines"><div className="pos-live-receipt-head"><b>ITEM</b><b>QTY</b><b>UNIT</b><b>SUBTOTAL</b></div>{basketRows.map(({ item, priced }) => <div key={item.id}><span>{item.name}</span><span>{item.quantity}</span><span>{money.format(item.price)}</span><b>{money.format(priced?.lineTotal || 0)}</b></div>)}</div><div className="pos-live-receipt-total"><span>Total</span><b>{money.format(total)}</b></div></div><button type="button" className="button secondary full" onClick={printPreview} disabled={!cart.length}>Print preview</button></div>
      <div className="till-lines">{hasQuantityDiscount && <div className="pos-basket-rules"><strong>Buy 3 or more of the same product to get 5% off that product.</strong></div>}{cart.length ? basketRows.map(({ item, priced }) => <div className="till-line" key={item.id}><button type="button" className="pos-remove-line" aria-label={`Remove ${item.name} from basket`} onClick={() => setCart((current) => current.filter((line) => line.id !== item.id))}>×</button><div className="till-line-info"><b>{item.name}</b><small>{item.sku || item.id} · {[item.colour, item.size].filter(Boolean).join(" / ")} · {money.format(item.price)} each</small></div><div className="till-line-bottom"><div><PosQuantityStepper item={item} onChange={setQuantity} />{appliedOfferLabel(priced) && <small className="pos-line-discount">{appliedOfferLabel(priced)}</small>}</div><span className="pos-line-total">{appliedOfferBadge(priced) && <span className="pos-line-discount">{appliedOfferBadge(priced)}</span>}<strong>{money.format(priced?.lineTotal || 0)}</strong></span></div></div>) : <div className="empty-state"><span className="status-icon">+</span><h3>Your cart is empty</h3><p>Select products to begin a sale.</p></div>}</div>
      <div className="till-basket-actions"><button type="button" className="button primary full" disabled={!cart.length} onClick={() => setCheckoutStep(true)}>Continue to checkout · {money.format(total)}</button></div>
      <div className="till-checkout"><button type="button" className="pos-basket-back" onClick={() => setCheckoutStep(false)}>← Review basket</button>{cartNotice && <div className="notice error-notice pos-cart-notice" role="alert"><span>{cartNotice}</span><button onClick={() => setCartNotice("")}>I reviewed the cart</button></div>}<label>Sales channel<select value={orderChannel} onChange={(event) => { setOrderChannel(event.target.value); setOrderReference(""); setCustomerName(""); setCustomerPhone(""); }}><option value="walk-in">Walk-in Sale</option><option value="website">Website Order</option><option value="whatsapp">WhatsApp Order</option><option value="phone">Phone Order</option></select></label>{orderChannel === "whatsapp" && <div className="pos-whatsapp-fields"><label>Customer order or reference<input placeholder="WhatsApp order reference" value={orderReference} onChange={(event) => setOrderReference(event.target.value)} /></label><div className="pos-customer-fields"><label>Customer name<input placeholder="Customer name" value={customerName} onChange={(event) => setCustomerName(event.target.value)} /></label><label>Phone<input type="tel" placeholder="Customer phone" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} /></label></div></div>}{orderChannel === "website" && <p className="linked-order-reference">{orderReference ? `Website order ${orderReference}` : "Open a website order from the Orders tab to link its reference."}</p>}
        <div className="till-summary"><div><span>Subtotal</span><strong>{money.format(subtotal)}</strong></div><div><span>Discount</span><strong>−{money.format(discount)}</strong></div><div className="grand-total"><span>Total</span><strong>{money.format(total)}</strong></div><label className="pos-payment-select">Payment type<select value={paymentMethod} onChange={(event) => { setPaymentMethod(event.target.value); setTransactionVerified(false); }}><option value="cash">Cash</option><option value="mobile-money">Mobile Money</option><option value="card">Card</option><option value="bank-transfer">Bank transfer</option></select></label><label className="amount-paid">Amount paid<input type="number" min="0" step="0.01" placeholder="Enter amount" value={amountPaid} onChange={(event) => setAmountPaid(event.target.value)} /></label>{paymentMethod !== "cash" && <label className="pos-verify"><input type="checkbox" checked={transactionVerified} onChange={(event) => setTransactionVerified(event.target.checked)} /> Transaction verified with provider</label>}{changeDue > 0 && <div className="change-due"><span>Change due</span><strong>{money.format(changeDue)}</strong></div>}<button className="button accent full" onClick={() => setConfirmSale(true)} disabled={!cart.length || !paymentReady || !referenceReady || Boolean(cartNotice) || busy}>Complete Sale</button>{!online && <p className="pos-checkout-warning">Offline sale is final at this till. Its receipt will show a pending server-sync notice; keep this device until it syncs.</p>}</div>
      </div>
    </aside>
  </main>;
}

