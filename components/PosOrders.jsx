"use client";

import { useState } from "react";
import OrderScanner from "@/components/OrderScanner";
import { fulfilmentComplete, fulfilmentCounts, matchingOrderLine } from "@/lib/fulfilment.mjs";
import { cardImageSource } from "@/lib/productImages.mjs";

const money = new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" });
const dateTime = (value) => value ? new Date(value).toLocaleString("en-GH", { dateStyle: "medium", timeStyle: "short" }) : "—";
const statuses = ["pending", "confirmed", "paid", "processing", "ready", "cancelled"];

export default function PosOrders({ role, orders, products, visibleOrders, orderQuery, setOrderQuery, orderStatus, setOrderStatus, busy, error, openOrderAtTill, updateOrder, confirmOrderItem, newOrderNotice, clearNewOrderNotice }) {
  const [selected, setSelected] = useState(null);
  const [scanNotice, setScanNotice] = useState("");
  const [fulfilOpen, setFulfilOpen] = useState(false);
  const [initialCamera, setInitialCamera] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState(-1);
  const openCount = orders.filter((order) => !["completed", "cancelled"].includes(order.status)).length;
  const counts = fulfilmentCounts(selected);

  async function setCount(index, quantity) {
    if (!selected) return;
    try {
      const result = await confirmOrderItem(selected.orderId, index, quantity);
      setSelected((current) => current?.orderId === selected.orderId ? { ...current, fulfilmentCounts: result.fulfilmentCounts } : current);
      setScanNotice(`${selected.items[index].name}: ${quantity} of ${selected.items[index].quantity} confirmed.`);
    } catch { setScanNotice("Could not save item confirmation. Try again."); }
  }
  function confirmCode(code) {
    const index = matchingOrderLine(selected, code, products);
    if (index < 0) { setScanNotice("That code does not match an item in this order."); return; }
    const required = Number(selected.items[index].quantity || 0);
    if (counts[index] >= required) { setScanNotice(`${selected.items[index].name} is already fully confirmed.`); return; }
    if (required > 1) setPendingConfirm(index);
    else setCount(index, 1);
  }
  const chooseOrder = (order, fulfil = false, camera = false) => { setSelected(order); setScanNotice(""); setFulfilOpen(fulfil); setInitialCamera(camera); setPendingConfirm(-1); };
  return <main className="pos-orders">
    <div className="pos-title"><div><p className="eyebrow">All channels</p><h1>Orders</h1><p>{openCount} open orders awaiting payment or fulfilment.</p></div>{["owner", "admin", "supervisor"].includes(role) && <a className="button secondary" href="/admin">Admin Portal</a>}</div>
    {newOrderNotice && <div className="notice success-notice pos-order-notice" role="status"><span>{newOrderNotice}</span><button type="button" onClick={clearNewOrderNotice} aria-label="Dismiss new order notice">×</button></div>}
    <div className="table-tools"><input aria-label="Search orders" placeholder="Search client, phone, reference or time" value={orderQuery} onChange={(event) => setOrderQuery(event.target.value)} /><select aria-label="Filter order status" value={orderStatus} onChange={(event) => setOrderStatus(event.target.value)}><option value="all">All orders</option><option value="pending-payment">Pending payment</option><option value="pending">Pending</option><option value="processing">Processing</option><option value="ready">Ready</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select><span>{visibleOrders.length} orders</span></div>
    {error && <p className="notice error-notice" role="alert">{error}</p>}
    {visibleOrders.length ? <div className="summary-grid">{visibleOrders.map((order) => <div className="summary-card pos-order-card" key={order.orderId}><button type="button" className="pos-order-open" onClick={() => chooseOrder(order)} aria-label={`Open order for ${order.customer || "Guest"}`}><strong>{order.customer || "Guest"}</strong><span>{order.phone || "No phone"}</span><div className="summary-statuses"><span className={order.paymentStatus === "paid" ? "badge success" : "badge neutral"}>{order.paymentStatus || "unpaid"}</span><span className={order.status === "completed" ? "badge success" : order.status === "cancelled" ? "badge danger" : "badge warning"}>{order.status || "pending"}</span></div></button>{!["completed", "cancelled"].includes(order.status) && <div className="pos-order-card-actions"><button type="button" className="button primary pos-fulfil-default" onClick={() => chooseOrder(order, true)}>Fulfill</button><button type="button" className="button secondary pos-fulfil-scan" onClick={() => chooseOrder(order, true)}>Scan</button><button type="button" className="button secondary pos-fulfil-camera" onClick={() => chooseOrder(order, true, true)}>Use camera</button></div>}</div>)}</div> : <div className="empty-state">No orders match these filters.</div>}
    {selected && <div className="modal-backdrop" role="presentation" onMouseDown={() => setSelected(null)}><div className="modal pos-order-detail" role="dialog" aria-modal="true" aria-label={`Order ${selected.orderId}`} onMouseDown={(event) => event.stopPropagation()}>
      <div className="drawer-title"><div><p className="eyebrow">Order details</p><h2>{selected.orderId}</h2></div><button className="icon-button" aria-label="Close order details" onClick={() => setSelected(null)}>×</button></div>
      <div className="detail-grid"><div><span>Customer</span><b>{selected.customer || "Guest"}</b></div><div><span>Phone</span><b>{selected.phone || "—"}</b></div><div><span>Created</span><b>{dateTime(selected.createdAt)}</b></div><div><span>Channel</span><b>{selected.channel || "website"}</b></div><div><span>Fulfilment</span><b>{selected.deliveryMethod || "Pickup"}</b></div><div><span>Payment</span><b>{selected.paymentStatus || "pending"}</b></div><div><span>Status</span><b>{selected.status || "pending"}</b></div><div><span>Destination</span><b>{selected.deliveryAddress || selected.landmark || "—"}</b></div>{selected.pickupCode && <div><span>Pickup code</span><b>{selected.pickupCode}</b></div>}</div>
      {selected.notes && <p>Notes: {selected.notes}</p>}
      {(selected.items || []).some((item) => !item.dealBundleSnapshot && Number(item.unitPrice) * Number(item.quantity) > 0 && Math.abs((Number(item.unitPrice) * Number(item.quantity) - Number(item.lineTotal)) / (Number(item.unitPrice) * Number(item.quantity)) - 0.05) < 0.0001) && <p className="pos-line-discount">5% discount applied</p>}
      <div className="pos-order-workspace"><div><div className="pos-order-detail-lines">{(selected.items || []).map((item, index) => { const product = products.find((entry) => entry.id === item.productId); const source = product ? cardImageSource(product).url : ""; return <div className={counts[index] >= Number(item.quantity) ? "fulfilled" : ""} key={`${item.productId}-${index}`}>{source ? <img src={source} alt="" /> : <span className="product-monogram">{item.name.slice(0, 2).toUpperCase()}</span>}<span>{item.quantity} × {item.name}<small>{[item.colour, item.size, item.sku || item.productId].filter(Boolean).join(" · ")}</small></span><b>{money.format(item.lineTotal || Number(item.price || 0) * Number(item.quantity || 0))}</b></div>; })}</div>
      {!fulfilOpen && !["completed", "cancelled"].includes(selected.status) && <button className="button primary" onClick={() => setFulfilOpen(true)}>Fulfill order</button>}
      {fulfilOpen && <section className="pos-fulfilment-checklist" aria-label="Fulfilment checklist"><h3>Scan items to confirm</h3><p>Items are checked only after scanning. For multiple units, confirm the full quantity when prompted.</p><OrderScanner onCode={confirmCode} initialCamera={initialCamera} />{(selected.items || []).map((item, index) => <div className={`pos-fulfilment-line ${counts[index] >= Number(item.quantity) ? "fulfilled" : ""}`} key={`${item.productId}-${index}`}><label><input type="checkbox" readOnly checked={counts[index] >= Number(item.quantity)} /><span><b>{item.name}</b><small>{item.sku || item.productId} · {counts[index]} / {item.quantity} scanned and confirmed</small></span></label></div>)}{scanNotice && <p role="status" className="pos-scan-notice">{scanNotice}</p>}{pendingConfirm >= 0 && <div className="pos-quantity-confirm" role="alertdialog" aria-label="Confirm multiple units"><p>Have you confirmed all {selected.items[pendingConfirm].quantity} units of {selected.items[pendingConfirm].name}?</p><button className="button primary" disabled={busy} onClick={() => { setCount(pendingConfirm, Number(selected.items[pendingConfirm].quantity)); setPendingConfirm(-1); }}>Yes, quantity confirmed</button></div>}{fulfilmentComplete(selected) && selected.status !== "completed" && <button className="button accent full" disabled={busy} onClick={async () => { if (await updateOrder(selected.orderId, "completed")) setSelected(null); }}>Complete order</button>}</section>}</div>
      <aside className="pos-order-receipt"><img src="/brand/pam-lockup-navy.svg" alt="PAM Essentials & More" /><h3>Order preview</h3>{(selected.items || []).map((item, index) => <div key={`${item.productId}-${index}`}><span>{item.quantity} × {item.name}</span><b>{money.format(item.lineTotal || Number(item.price || 0) * Number(item.quantity || 0))}</b></div>)}<div className="order-total"><span>Total</span><strong>{money.format(selected.total || 0)}</strong></div></aside></div>
      <label className="detail-status-control">Update fulfilment status<select aria-label={`Update ${selected.orderId}`} disabled={busy} value={selected.status} onChange={async (event) => { if (await updateOrder(selected.orderId, event.target.value)) setSelected(null); }}>{statuses.map((status) => <option key={status}>{status}</option>)}{selected.status === "completed" && <option value="completed">completed</option>}</select></label>
      <button className="button primary full" disabled={busy || ["completed", "cancelled"].includes(selected.status)} onClick={() => { openOrderAtTill(selected); setSelected(null); }}>Open at till</button>
    </div></div>}
  </main>;
}
