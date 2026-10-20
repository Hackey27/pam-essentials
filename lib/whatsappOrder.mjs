import {packDescription,displayUnitPrice,wholesaleUnitName} from "./wholesaleUnits.mjs";
import { courierFeeLabel } from "./shopPreferences.mjs";
import { productOptions } from "./variantDisplay.mjs";

const money = new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" });

export function whatsappOrderMessage(order, customer, phone) {
  const lines = order.items.map((item, index) => [
    `${index + 1}. ${item.name}`,
    ...Object.entries(productOptions(item)).map(([key, value]) => `${key.charAt(0).toUpperCase() + key.slice(1)}: ${value}`),
    `SKU: ${item.sku}`,
    `Qty: ${packDescription(item)||item.quantity}`,
    `Price: ${money.format(displayUnitPrice(item))}${item.wholesaleSnapshot?.unitsPerPack>1?" per "+wholesaleUnitName(item):""}`,
    `Line total: ${money.format(item.lineTotal)}`,
  ].filter(Boolean).join("\n")).join("\n\n");
  return `Hello PAM Essentials & More 👋\n\nI'd like to place this ${order.purchaseType === "wholesale" ? "wholesale " : ""}order (${order.orderId}):\n${lines}\n\nSubtotal: ${money.format(order.subtotal)}\nDiscount: ${money.format(order.discount)}\nTotal: ${money.format(order.total)}${order.fulfilmentDetails ? `\n${courierFeeLabel(order.fulfilmentDetails)}\nEstimated: ${order.fulfilmentDetails.windowText} (during opening hours; subject to confirmation)` : ""}\n\nName: ${customer}\nPhone: ${phone}\nDelivery/Pickup: ${order.deliveryMethod}\nShop collection address: ${order.originAddress}${order.deliveryAddress ? `\nDelivery destination: ${order.deliveryAddress}` : ""}${order.notes ? `\nNotes: ${order.notes}` : ""}`;
}

