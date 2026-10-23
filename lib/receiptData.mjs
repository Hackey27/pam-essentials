import {displayQuantity,displayUnitPrice,packDescription} from "./wholesaleUnits.mjs";
import { variantDetail } from "./variantDisplay.mjs";

export function receiptSnapshot(sale = {}) {
  return {
    id: sale.id || sale.clientTransactionId || "",
    receiptId: sale.receiptId || "",
    saleType: sale.saleType || "sale",
    reversalOf: sale.reversalOf || "",
    reversalId: sale.reversalId || "",
    originalReceiptId: sale.originalReceiptId || "",
    correctionReason: sale.correctionReason || "",
    restoreStock: sale.restoreStock === true,
    paymentResolution: sale.paymentResolution || "",
    offlineFinal: sale.offlineFinal === true,
    syncPending: sale.syncPending === true,
    createdAt: sale.createdAt || null,
    staffEmail: sale.staffEmail || "",
    staffName: sale.staffName || sale.staffDisplayName || "",
    customerName: sale.customerName || "",
    customerPhone: sale.customerPhone || "",
    orderReference: sale.orderReference || "",
    purchaseType: sale.purchaseType === "wholesale" ? "wholesale" : "retail",
    salesChannel: sale.salesChannel || "walk-in",
    paymentMethod: sale.paymentMethod || "cash",
    paymentStatus: sale.paymentStatus || "paid",
    subtotal: Number(sale.subtotal || 0),
    discount: Number(sale.discount || 0),
    total: Number(sale.total || 0),
    amountPaid: Number(sale.amountPaid || 0),
    change: Number(sale.change || 0),
    cashChangeSource: sale.cashChangeSource || "",
    cashChangePaid: Number(sale.cashChangePaid || 0),
    fulfilmentSnapshot: sale.fulfilmentSnapshot || {},
    taxSnapshot: sale.taxSnapshot || { enabled: false },
    items: (sale.items || []).map((item) => ({ productId: item.productId || item.id || "", sku: item.sku || item.productId || item.id || "", variantId: item.variantId || "", purchaseType: item.purchaseType || sale.purchaseType || "retail", retailUnit: item.retailUnit || null, wholesaleSnapshot: item.wholesaleSnapshot || null, name: item.name || "Product", colour: item.colour || "", size: item.size || "", variantOptions: item.variantOptions || {}, quantity: Number(item.quantity || 0), unitPrice: Number(item.unitPrice ?? item.price ?? 0), lineTotal: Number(item.lineTotal ?? Number(item.unitPrice ?? item.price ?? 0) * Number(item.quantity || 0)) })),
  };
}

const amount = (value) => `GH₵${Number(value || 0).toFixed(2)}`;
const label = (value) => String(value || "").replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
export const receiptSourceLabel = (value) => ({ "walk-in": "Walk-In", website: "Online", whatsapp: "WhatsApp", phone: "Phone" })[value] || label(value);

export function formatReceiptText(source) {
  const sale = receiptSnapshot(source);
  const date = sale.createdAt ? new Date(sale.createdAt) : new Date();
  const width = 40;
  const center = (value) => String(value).padStart(Math.floor((width + String(value).length) / 2));
  const pair = (key, value) => `${key}${String(value).padStart(Math.max(1, width - key.length))}`;
  const rows = [
    center("PAM ESSENTIALS & MORE"),
    center("Your Trusted Neighbourhood Mall"),
    center("Atlas Station - Awoshie, Accra"),
    center("Tel: 0596 661 439"),
    "========================================",
    center(sale.saleType === "reversal" ? "SALE CORRECTION / REVERSAL" : "SALES RECEIPT"),
    "",
    `Receipt No: ${sale.receiptId}`,
    ...(sale.syncPending ? ["OFFLINE FINAL AT TILL - SYNC PENDING"] : []),
    `Date: ${date.toLocaleDateString("en-GB", { timeZone: "Africa/Accra" })}`,
    `Time: ${date.toLocaleTimeString("en-GH", { timeZone: "Africa/Accra", hour: "numeric", minute: "2-digit" }).replace(/\b(am|pm)\b/i, (part) => part.toUpperCase())}`,
    `Cashier: ${sale.staffName || sale.staffEmail || "Staff"}`,
    `Customer Type: ${receiptSourceLabel(sale.salesChannel)}`,
    ...(sale.purchaseType === "wholesale" ? ["Pricing: Wholesale"] : []),
  ];
  if ((sale.taxSnapshot.enabled || sale.taxSnapshot.registered) && sale.taxSnapshot.registrationNumber) rows.push(`Tax registration: ${sale.taxSnapshot.registrationNumber}`);
  if (sale.reversalId) rows.push(`Reversed by: ${sale.reversalId}`);
  if (sale.reversalOf) rows.push(`Original receipt: ${sale.originalReceiptId}`, `Reason: ${sale.correctionReason}`, `Stock restored: ${sale.restoreStock ? "Yes" : "No"}`);
  if (sale.paymentResolution) rows.push(`Payment handling: ${({"not-collected":"Payment never collected","cash-refund":"Cash refund from this drawer","external-refund":"Refund handled outside this drawer"})[sale.paymentResolution] || sale.paymentResolution}`);
  if (sale.customerName) rows.push(`Customer: ${sale.customerName}`);
  if (sale.customerPhone) rows.push(`Phone: ${sale.customerPhone}`);
  if (sale.orderReference) rows.push(`Order Ref: ${sale.orderReference}`);
  if (sale.fulfilmentSnapshot?.deliveryMethod && sale.salesChannel !== "walk-in") rows.push(`Delivery/Pickup: ${label(sale.fulfilmentSnapshot.deliveryMethod)}`);
  if (sale.fulfilmentSnapshot?.deliveryMethod === "delivery-self" && sale.fulfilmentSnapshot.originAddress) rows.push(`Shop address: ${sale.fulfilmentSnapshot.originAddress}`);
  const qtyWidth = Math.max(3, ...sale.items.map((item) => String(displayQuantity(item)).length));
  const priceWidth = Math.max(7, ...sale.items.map((item) => displayUnitPrice(item).toFixed(2).length));
  const totalWidth = Math.max(8, ...sale.items.map((item) => item.lineTotal.toFixed(2).length));
  const itemWidth = width - qtyWidth - priceWidth - totalWidth - 3;
  const wrap = (text, limit = itemWidth) => {
    const words = String(text || "").match(/\S+/g) || [];
    const lines = [];
    let line = "";
    for (const word of words) {
      if (line && line.length + 1 + word.length > limit) { lines.push(line); line = ""; }
      if (word.length > limit) {
        if (line) { lines.push(line); line = ""; }
        for (let start = 0; start < word.length; start += limit) lines.push(word.slice(start, start + limit));
      } else line = line ? `${line} ${word}` : word;
    }
    if (line) lines.push(line);
    return lines.length ? lines : [""];
  };
  const itemRow = (name, quantity = "", price = "", total = "") => `${String(name).padEnd(itemWidth)} ${String(quantity).padStart(qtyWidth)} ${String(price).padStart(priceWidth)} ${String(total).padStart(totalWidth)}`;
  rows.push("----------------------------------------", itemRow("ITEM", "QTY", "PRICE", "TOTAL"), "----------------------------------------");
  for (const item of sale.items) {
    const detail = variantDetail(item);
    const labels = [...wrap(item.name), ...(detail ? wrap(detail) : []),...(packDescription(item)?wrap(packDescription(item)):[])];
    for (const line of labels.slice(0, -1)) rows.push(itemRow(line));
    rows.push(itemRow(labels.at(-1), displayQuantity(item), displayUnitPrice(item).toFixed(2), item.lineTotal.toFixed(2)));
    rows.push("");
  }
  rows.push("----------------------------------------", pair("Subtotal:", amount(sale.subtotal)));
  if (sale.taxSnapshot.enabled) for (const tax of sale.taxSnapshot.lines || []) rows.push(pair(tax.name + " (" + tax.rate + "%) included:", amount(tax.amount)));
  if (sale.discount !== 0) rows.push(pair("Discount:", amount(sale.discount)));
  rows.push("                              ----------", pair("TOTAL:", amount(sale.total)), "                              ==========", "", pair("Payment:", label(sale.paymentMethod)), ...(sale.paymentMethod==="marketplace-settlement"?[pair("Settlement:",sale.paymentStatus==="settled"?"Settled":"Pending platform payout")]:[pair("Amount Paid:", amount(sale.amountPaid))]), pair("Balance:", amount(sale.change)), ...(sale.cashChangeSource && sale.paymentMethod !== "cash" && sale.change > 0 ? [pair("Change returned as:", sale.cashChangeSource === "cash" ? "Cash" : label(sale.paymentMethod))] : []), "----------------------------------------", center("THANK YOU FOR SHOPPING"), center("WITH US!"), "", center("Everyday essentials,"), center("thoughtfully selected."), "----------------------------------------", center("Goods sold are NOT returnable."), "========================================");
  return rows.flatMap((row) => row.length > width ? wrap(row, width) : [row]).join("\n");
}
