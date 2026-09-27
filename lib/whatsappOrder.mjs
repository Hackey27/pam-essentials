const money = new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" });

export function whatsappOrderMessage(order, customer, phone) {
  const lines = order.items.map((item, index) => [
    `${index + 1}. ${item.name}`,
    item.colour ? `Colour: ${item.colour}` : "",
    item.size ? `Size: ${item.size}` : "",
    `SKU: ${item.sku}`,
    `Qty: ${item.quantity}`,
    `Price: ${money.format(item.unitPrice)}`,
    `Line total: ${money.format(item.lineTotal)}`,
  ].filter(Boolean).join("\n")).join("\n\n");
  return `Hello PAM Essentials & More 👋\n\nI'd like to place this order (${order.orderId}):\n${lines}\n\nSubtotal: ${money.format(order.subtotal)}\nDiscount: ${money.format(order.discount)}\nTotal: ${money.format(order.total)}\n\nName: ${customer}\nPhone: ${phone}\nDelivery/Pickup: ${order.deliveryMethod}\nShop collection address: ${order.originAddress}${order.deliveryAddress ? `\nDelivery destination: ${order.deliveryAddress}` : ""}`;
}

