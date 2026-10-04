import { receiptSnapshot } from "./receiptData.mjs";

export function offlineReceiptId(transactionId) {
  const hex = String(transactionId || "").replaceAll("-", "");
  if (!/^[0-9a-f]{32}$/i.test(hex)) throw new Error("A valid transaction ID is required for an offline receipt.");
  const bytes = String.fromCharCode(...(hex.match(/../g) || []).map((pair) => parseInt(pair, 16)));
  return `PAM-OFF-${btoa(bytes).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "").slice(0, 20)}`;
}

export function offlineSaleReceipt({ transactionId, cart, pricing, shift, staffEmail, staffName, paymentMethod, amountPaid, salesChannel, orderReference, customerName, customerPhone }) {
  const paid = Number(amountPaid);
  return receiptSnapshot({
    id: transactionId,
    receiptId: offlineReceiptId(transactionId),
    createdAt: new Date().toISOString(),
    offlineFinal: true,
    syncPending: true,
    staffEmail, staffName, paymentMethod, amountPaid: paid,
    salesChannel, orderReference, customerName, customerPhone,
    shiftId: shift?.shiftId,
    subtotal: pricing.subtotal, discount: pricing.discount, total: pricing.total,
    change: Math.round((paid - pricing.total) * 100) / 100,
    items: cart.map((item) => ({
      productId: item.id, sku: item.sku || item.id, name: item.name,
      colour: item.colour || "", size: item.size || "", variantOptions: item.variantOptions || {}, quantity: item.quantity,
      unitPrice: Number(item.price),
      lineTotal: pricing.lines.find((line) => line.id === item.id)?.lineTotal ?? Number(item.price) * item.quantity,
    })),
  });
}
