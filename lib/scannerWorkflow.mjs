import { allBarcodeCodes, normalizeBarcode } from "./barcodes.mjs";
import { matchingProducts } from "./scanCode.mjs";

export function barcodeOwner(products, code) {
  const key = normalizeBarcode(code);
  return key ? products.find((product) => [...allBarcodeCodes(product), product.sku, product.id, product.qrCode, product.productCode].some((value) => normalizeBarcode(value) === key)) : undefined;
}

export function adminScanConflict(product, products, code, pending = []) {
  const key = normalizeBarcode(code);
  if ([...allBarcodeCodes(product), ...pending].some((value) => normalizeBarcode(value) === key)) return "Already scanned for this product.";
  const owner = barcodeOwner(products, code);
  if (!owner) return "";
  return !product.create && owner.id === product.id ? "Already scanned for this product." : `This barcode is already assigned to ${owner.name || owner.sku || owner.id}.`;
}

export function planPosScan(products, cart, code) {
  const matches = matchingProducts(products, code);
  if (!matches.length) return { type: "notice", message: "No product found for this code. Use Search to add a product manually." };
  if (matches.length > 1) return { type: "choices", products: matches };
  return planScannedProduct(matches[0], cart);
}

export function planScannedProduct(product, cart) {
  if (product.active === false || product.archived || !(Number(product.price) > 0)) return { type: "notice", message: `${product.name} is not available for sale.` };
  if (!(Number(product.stock) > 0)) return { type: "notice", message: `${product.name} is out of stock.` };
  const item = cart.find((line) => line.id === product.id);
  if (item && item.quantity >= Math.min(Number(product.stock), Number(item.stock))) return { type: "notice", message: `${product.name}: quantity in basket is ${item.quantity}. No more stock is available.` };
  return item ? { type: "increase", product, quantity: item.quantity } : { type: "add", product };
}

export function createScanGate(now = () => Date.now(), releaseAfterMs = 700) {
  let previous = "";
  let missingSince = null;
  return (raw) => {
    const code = normalizeBarcode(raw);
    const time = now();
    if (!code) {
      missingSince ??= time;
      if (time - missingSince >= releaseAfterMs) previous = "";
      return false;
    }
    if (missingSince != null && time - missingSince >= releaseAfterMs) previous = "";
    missingSince = null;
    if (code === previous) return false;
    previous = code;
    return true;
  };
}
