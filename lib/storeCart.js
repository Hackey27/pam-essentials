const CART_KEY = "pam-store-cart";

export function readCart() {
  try {
    const value = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    return Array.isArray(value) ? value.filter((item) => item?.id && Number(item.quantity) > 0) : [];
  } catch { return []; }
}

export function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  window.dispatchEvent(new Event("pam-cart-changed"));
}

export function addToCart(cart, product, quantity = 1) {
  if (!product || Number(product.stock) <= 0) return cart;
  const amount = Math.max(1, Math.floor(Number(quantity) || 1));
  const found = cart.find((item) => item.id === product.id);
  return found
    ? cart.map((item) => item.id === product.id ? { ...product, quantity: Math.min(Number(product.stock), Number(item.quantity) + amount) } : item)
    : [...cart, { ...product, quantity: Math.min(Number(product.stock), amount) }];
}

