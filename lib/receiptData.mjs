export function receiptSnapshot(sale = {}) {
  return {
    id: sale.id || sale.clientTransactionId || "",
    receiptId: sale.receiptId || "",
    createdAt: sale.createdAt || null,
    staffEmail: sale.staffEmail || "",
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

export function formatReceiptText(source) {
  const sale = receiptSnapshot(source);
  const date = sale.createdAt ? new Date(sale.createdAt) : new Date();
  const rows = [
    "PAM ESSENTIALS & MORE",
    "Your Trusted Neighbourhood Mall",
    "Awoshie, Accra, Ghana",
    "Tel: +233 20 701 5198",
    "========================================",
    "             SALES RECEIPT",
    "========================================",
    `Receipt No: ${sale.receiptId}`,
    `Date: ${date.toLocaleDateString("en-GB", { timeZone: "Africa/Accra" })}`,
    `Time: ${date.toLocaleTimeString("en-GH", { timeZone: "Africa/Accra", hour: "numeric", minute: "2-digit" })}`,
    `Cashier: ${sale.staffEmail || "Staff"}`,
    `Customer Type: ${label(sale.salesChannel)}`,
  ];
  if (sale.customerName) rows.push(`Customer: ${sale.customerName}`);
  if (sale.customerPhone) rows.push(`Phone: ${sale.customerPhone}`);
  if (sale.orderReference) rows.push(`Order Ref: ${sale.orderReference}`);
  if (sale.fulfilmentSnapshot?.deliveryMethod && sale.salesChannel !== "walk-in") rows.push(`Delivery/Pickup: ${label(sale.fulfilmentSnapshot.deliveryMethod)}`);
  if (sale.fulfilmentSnapshot?.deliveryMethod === "delivery-self" && sale.fulfilmentSnapshot.originAddress) rows.push(`Shop address: ${sale.fulfilmentSnapshot.originAddress}`);
  rows.push("----------------------------------------", "ITEM                  QTY  PRICE    TOTAL");
  for (const item of sale.items) {
    rows.push(item.name);
    const detail = [item.colour, item.size].filter(Boolean).join(" / ");
    if (detail) rows.push(detail);
    rows.push(`${String(item.sku).slice(0, 18).padEnd(18)} ${String(item.quantity).padStart(3)} ${item.unitPrice.toFixed(2).padStart(7)} ${item.lineTotal.toFixed(2).padStart(8)}`);
  }
  rows.push("----------------------------------------", `Subtotal: ${amount(sale.subtotal)}`, `Discount: ${amount(sale.discount)}`, "----------------------------------------", `TOTAL: ${amount(sale.total)}`, "========================================", `Payment: ${label(sale.paymentMethod)}`, `Amount Paid: ${amount(sale.amountPaid)}`, `Balance / Change: ${amount(sale.change)}`, "----------------------------------------", "  THANK YOU FOR SHOPPING WITH US!", "Everyday essentials, thoughtfully selected.", "", "Goods sold are NOT returnable.");
  return rows.join("\n");
}

