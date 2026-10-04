"use client";

import { useEffect, useState } from "react";
import { formatReceiptText, receiptSnapshot, receiptSourceLabel } from "@/lib/receiptData.mjs";

const money = new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" });
const label = receiptSourceLabel;

export default function ReceiptPanel({ sale: source, onClose, onNewSale, autoPrint = false, preview = false }) {
  const sale = receiptSnapshot(source);
  const [message, setMessage] = useState("");
  const date = sale.createdAt ? new Date(sale.createdAt) : new Date();
  const text = formatReceiptText(sale);
  useEffect(() => {
    if (!autoPrint) return;
    const afterPrint = () => onClose();
    window.addEventListener("afterprint", afterPrint);
    const timer = setTimeout(() => window.print(), 100);
    return () => { clearTimeout(timer); window.removeEventListener("afterprint", afterPrint); };
  }, [autoPrint]);
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = `${sale.receiptId || "PAM-receipt"}.txt`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: sale.receiptId, text });
      else { await navigator.clipboard.writeText(text); setMessage("Receipt copied. Paste it into your preferred app."); }
    } catch (error) { if (error.name !== "AbortError") setMessage("Sharing is unavailable on this device. Download the receipt instead."); }
  };
  return <div className="modal-backdrop receipt-backdrop"><div className="modal receipt-modal" role="dialog" aria-modal="true" aria-label={preview ? "Draft receipt preview" : `Sales receipt ${sale.receiptId}`}>
    <article className="receipt-paper"><header><img className="receipt-brand" src="/brand/pam-lockup-navy.svg" alt="PAM Essentials & More" /><p>Your Trusted Neighbourhood Mall</p><p>Accra, Ghana</p><p>Tel: 020 XXX XXXX</p></header><div className="receipt-rule heavy"/><h3>{preview ? "DRAFT RECEIPT · NOT A SALE" : "SALES RECEIPT"}</h3>{sale.syncPending && <p className="receipt-offline-status">OFFLINE FINAL AT TILL · SERVER SYNC PENDING</p>}<div className="receipt-meta"><span>Receipt No</span><b>{preview ? "Assigned after sale" : sale.receiptId}</b><span>Date</span><b>{date.toLocaleDateString("en-GB", { timeZone: "Africa/Accra" })}</b><span>Time</span><b>{date.toLocaleTimeString("en-GH", { timeZone: "Africa/Accra", hour: "numeric", minute: "2-digit" }).replace(/\b(am|pm)\b/i, (part) => part.toUpperCase())}</b><span>Cashier</span><b>{sale.staffName || sale.staffEmail || "Staff"}</b><span>Customer Type</span><b>{label(sale.salesChannel)}</b>{sale.customerName && <><span>Customer</span><b>{sale.customerName}</b></>}{sale.customerPhone && <><span>Phone</span><b>{sale.customerPhone}</b></>}{sale.orderReference && <><span>Order Ref</span><b>{sale.orderReference}</b></>}{sale.salesChannel !== "walk-in" && sale.fulfilmentSnapshot.deliveryMethod && <><span>Delivery/Pickup</span><b>{label(sale.fulfilmentSnapshot.deliveryMethod)}</b></>}{sale.fulfilmentSnapshot.deliveryMethod === "delivery-self" && sale.fulfilmentSnapshot.originAddress && <><span>Shop address</span><b>{sale.fulfilmentSnapshot.originAddress}</b></>}</div><div className="receipt-rule"/><div className="receipt-item-head"><b>ITEM</b><b>QTY</b><b>PRICE</b><b>TOTAL</b></div><div className="receipt-rule"/>{sale.items.map((item, index) => { const variant = [item.colour, item.size].filter(Boolean).join(" / "); return <div className={`receipt-item${variant ? " has-variant" : ""}`} key={`${item.sku}-${index}`}><b>{item.name}</b><span>{item.quantity}</span><span>{item.unitPrice.toFixed(2)}</span><span>{item.lineTotal.toFixed(2)}</span>{variant && <small>{variant}</small>}</div>; })}<div className="receipt-rule"/><div className="receipt-amounts"><span>Subtotal</span><b>{money.format(sale.subtotal)}</b>{sale.discount > 0 && <><span>Discount</span><b>{money.format(sale.discount)}</b></>}</div><div className="receipt-rule"/><div className="receipt-amounts receipt-total"><span>TOTAL</span><b>{money.format(sale.total)}</b></div><div className="receipt-rule heavy"/><div className="receipt-amounts"><span>Payment</span><b>{label(sale.paymentMethod)}</b>{!preview && <><span>Amount Paid</span><b>{money.format(sale.amountPaid)}</b><span>Balance</span><b>{money.format(sale.change)}</b></>}</div><div className="receipt-rule"/><footer><b>THANK YOU FOR SHOPPING<br/>WITH US!</b><p>Everyday essentials,<br/>thoughtfully selected.</p><div className="receipt-rule"/><strong>Goods sold are NOT returnable.</strong><div className="receipt-rule heavy"/></footer></article>
    <div className="receipt-actions"><button className="button secondary" onClick={() => window.print()}>{preview ? "Print draft" : "Print / Reprint"}</button>{!preview && <><button className="button secondary" onClick={download}>Download</button><button className="button secondary" onClick={share}>Share</button></>}<button className="button primary" onClick={onClose}>Close</button>{onNewSale && <button className="button primary" onClick={onNewSale}>Start New Sale</button>}</div>{message && <p className="receipt-message" role="status">{message}</p>}
  </div></div>;
}
