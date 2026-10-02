export function receiptSnapshot(sale = {}) {
  return {
    id: sale.id || sale.clientTransactionId || "",
    receiptId: sale.receiptId || "",
    offlineFinal: sale.offlineFinal === true,
    syncPending: sale.syncPending === true,
    createdAt: sale.createdAt || null,
    staffEmail: sale.staffEmail || "",
    staffName: sale.staffName || sale.staffDisplayName || "",
    customerName: sale.customerName || "",
    customerPhone: sale.customerPhone || "",
    orderReference: sale.orderReference || "",
    salesChannel: sale.salesChannel || "walk-in",
    paymentMethod: sale.paymentMethod || "cash",
    subtotal: Number(sale.subtotal || 0),
    discount: Number(sale.discount || 0),
    total: Number(sale.total || 0),
    amountPaid: Number(sale.amountPaid || 0),
    change: Number(sale.change || 0),
    fulfilmentSnapshot: sale.fulfilmentSnapshot || {},
    items: (sale.items || []).map((item) => ({ productId: item.productId || item.id || "", sku: item.sku || item.productId || item.id || "", variantId: item.variantId || "", name: item.name || "Product", colour: item.colour || "", size: item.size || "", quantity: Number(item.quantity || 0), unitPrice: Number(item.unitPrice ?? item.price ?? 0), lineTotal: Number(item.lineTotal ?? Number(item.unitPrice ?? item.price ?? 0) * Number(item.quantity || 0)) })),
  };
}

const amount = (value) => `GH₵${Number(value || 0).toFixed(2)}`;
const label = (value) => String(value || "").replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
export const receiptSourceLabel = (value) => ({ "walk-in": "Walk-in", website: "Online", whatsapp: "WhatsApp", phone: "Phone" })[value] || label(value);

export function formatReceiptText(source) {
  const sale = receiptSnapshot(source);
  const date = sale.createdAt ? new Date(sale.createdAt) : new Date();
  const rows = [
    "PAM ESSENTIALS & MORE",
    "Awoshie, Accra, Ghana",
    "Tel: +233 596 661 439",
    "========================================",
    "             SALES RECEIPT",
    "========================================",
    `Receipt No: ${sale.receiptId}`,
    ...(sale.syncPending ? ["OFFLINE FINAL AT TILL - SYNC PENDING"] : []),
    `Date: ${date.toLocaleDateString("en-GB", { timeZone: "Africa/Accra" })}`,
    `Time: ${date.toLocaleTimeString("en-GH", { timeZone: "Africa/Accra", hour: "numeric", minute: "2-digit" })}`,
    `Cashier: ${sale.staffName || sale.staffEmail || "Staff"}`,
    `Source: ${receiptSourceLabel(sale.salesChannel)}`,
  ];
  if (sale.customerName) rows.push(`Customer: ${sale.customerName}`);
  if (sale.customerPhone) rows.push(`Phone: ${sale.customerPhone}`);
  if (sale.orderReference) rows.push(`Order Ref: ${sale.orderReference}`);
  if (sale.fulfilmentSnapshot?.deliveryMethod && sale.salesChannel !== "walk-in") rows.push(`Delivery/Pickup: ${label(sale.fulfilmentSnapshot.deliveryMethod)}`);
  if (sale.fulfilmentSnapshot?.deliveryMethod === "delivery-self" && sale.fulfilmentSnapshot.originAddress) rows.push(`Shop address: ${sale.fulfilmentSnapshot.originAddress}`);
  rows.push("----------------------------------------", "ITEM                QTY   PRICE    TOTAL");
  const itemWidth = 18;
  const wrap = (text, width = itemWidth) => {
    const words = String(text || "").match(/\S+/g) || [];
    const lines = [];
    let line = "";
    for (const word of words) {
      if (line && line.length + 1 + word.length > width) { lines.push(line); line = ""; }
      if (word.length > width) {
        if (line) { lines.push(line); line = ""; }
        for (let start = 0; start < word.length; start += width) lines.push(word.slice(start, start + width));
      } else line = line ? `${line} ${word}` : word;
    }
    if (line) lines.push(line);
    return lines.length ? lines : [""];
  };
  const itemRow = (name, quantity = "", price = "", total = "") => {
    const cells = [wrap(name, 18), wrap(quantity, 3), wrap(price, 7), wrap(total, 8)];
    return Array.from({ length: Math.max(...cells.map((cell) => cell.length)) }, (_, index) => `${(cells[0][index] || "").padEnd(18)} ${(cells[1][index] || "").padStart(3)} ${(cells[2][index] || "").padStart(7)} ${(cells[3][index] || "").padStart(8)}`);
  };
  for (const item of sale.items) {
    const nameLines = wrap(item.name);
    rows.push(...itemRow(nameLines[0], item.quantity, item.unitPrice.toFixed(2), item.lineTotal.toFixed(2)));
    for (const line of nameLines.slice(1)) rows.push(...itemRow(line));
    const detail = [item.colour, item.size].filter(Boolean).join(" / ");
    if (detail) for (const line of wrap(detail)) rows.push(...itemRow(line));
    for (const line of wrap(`SKU: ${item.sku}`)) rows.push(...itemRow(line));
  }
  rows.push("----------------------------------------", `Subtotal: ${amount(sale.subtotal)}`);
  if (sale.discount > 0) rows.push(`Discount: ${amount(sale.discount)}`);
  rows.push("----------------------------------------", `TOTAL: ${amount(sale.total)}`, "========================================", `Payment: ${label(sale.paymentMethod)}`, `Amount Paid: ${amount(sale.amountPaid)}`, `Balance / Change: ${amount(sale.change)}`, "----------------------------------------", "  THANK YOU FOR SHOPPING WITH US!", "Everyday essentials,", "thoughtfully selected.", "", "Goods sold are NOT returnable.");
  return rows.join("\n");
}
