import test from "node:test";
import assert from "node:assert/strict";
import { memoryFirestore } from "./fixtures/memoryFirestore.mjs";
import { GET as getOrders, POST as createOrder } from "../app/api/orders/route.js";
import { POST as claimOrder } from "../app/api/customer/orders/claim/route.js";
import { GET as getWishlist, POST as changeWishlist } from "../app/api/customer/wishlist/route.js";
import { whatsappOrderMessage } from "../lib/whatsappOrder.mjs";

const url = "http://localhost:8080";
const request = (path, token, body) => new Request(`${url}${path}`, {
  method: body ? "POST" : "GET",
  headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { "content-type": "application/json" } : {}) },
  ...(body ? { body: JSON.stringify(body) } : {}),
});
const json = async (response) => ({ status: response.status, body: await response.json() });

function setup() {
  globalThis.__pamTestUsers = new Map([
    ["customer-a", { uid: "customer-a", email: "a@example.test" }],
    ["customer-b", { uid: "customer-b", email: "b@example.test" }],
    ["staff", { uid: "staff", email: "staff@example.test", role: "cashier" }],
  ]);
  globalThis.__pamTestStore = memoryFirestore({
    users: { staff: { role: "cashier", active: true } },
    categories: { bottles: { name: "Bottles & Accessories", active: true, sortOrder: 1 } },
    subcategories: { water: { name: "Water Bottles", categoryId: "bottles", active: true, sortOrder: 1 } },
    sub_subcategories: {},
    discount_rules: { quantity5: { name: "Quantity discount", active: true, scopeType: "GLOBAL", discountType: "PERCENT", value: 5, minQty: 3 } },
    products: {
      "PAM-WB001-PNK-500": { id: "PAM-WB001-PNK-500", name: "Cartoon Water Bottle", categoryId: "bottles", category: "Bottles & Accessories", subcategoryId: "water", productGroupId: "WB001", colour: "Pink", size: "500ml", price: 35, stock: 4, active: true, archived: false },
      "PAM-WB001-BLU-500": { id: "PAM-WB001-BLU-500", name: "Cartoon Water Bottle", categoryId: "bottles", category: "Bottles & Accessories", subcategoryId: "water", productGroupId: "WB001", colour: "Blue", size: "500ml", price: 40, stock: 0, active: true, archived: false },
      "PAM-WB001-GRN-750": { id: "PAM-WB001-GRN-750", name: "Cartoon Water Bottle", categoryId: "bottles", category: "Bottles & Accessories", subcategoryId: "water", productGroupId: "WB001", colour: "Green", size: "750ml", price: 45, stock: 3, active: true, archived: false },
      UNPRICED: { id: "UNPRICED", name: "Unpriced item", categoryId: "bottles", category: "Bottles & Accessories", price: 0, stock: 0, active: true, archived: false },
    },
    orders: {}, customer_accounts: {},
  });
  return globalThis.__pamTestStore;
}

test("guest order, claim, account isolation and exact variant totals", async () => {
  const store = setup();
  const created = await json(await createOrder(request("/api/orders", null, { customer: "Ada", phone: "+233 20 701 5198", deliveryMethod: "delivery-self", deliveryAddress: "Near the school", notes: "Please send pink", items: [{ id: "PAM-WB001-PNK-500", quantity: 3 }] })));
  assert.equal(created.status, 200);
  assert.match(created.body.orderId, /^ORD-[A-Z0-9]+-[A-Z0-9]+$/);
  assert.deepEqual([created.body.subtotal, created.body.discount, created.body.total], [105, 5.25, 99.75]);
  assert.deepEqual(created.body.items[0], { name: "Cartoon Water Bottle", sku: "PAM-WB001-PNK-500", colour: "Pink", size: "500ml", variantOptions: {}, quantity: 3, unitPrice: 35, lineTotal: 99.75 });
  assert.equal(store.inspect("orders", created.body.orderId).customerUid, null);
  assert.equal(store.inspect("orders", created.body.orderId).notes, "Please send pink");
  assert.match(whatsappOrderMessage(created.body, "Ada", "+233 20 701 5198"), /Notes: Please send pink/);
  assert.equal(store.inspect("orders", created.body.orderId).items[0].variantId, "PAM-WB001-PNK-500");
  assert.equal((await json(await getOrders(request("/api/orders", "customer-a")))).body.orders.length, 0);
  assert.equal((await json(await getOrders(request("/api/orders", "customer-b")))).body.orders.length, 0);
  assert.equal((await json(await claimOrder(request("/api/customer/orders/claim", "customer-a", { reference: created.body.orderId, phone: "+233207015198" })))).status, 200);
  assert.equal((await json(await getOrders(request("/api/orders", "customer-a")))).body.orders[0].orderId, created.body.orderId);
  assert.equal((await json(await getOrders(request(`/api/orders?reference=${created.body.orderId}`, "customer-b")))).status, 404);
  assert.equal((await json(await claimOrder(request("/api/customer/orders/claim", "customer-b", { reference: created.body.orderId, phone: "+233207015198" })))).status, 404);
});

test("custom variant values survive checkout and WhatsApp formatting", async () => {
  const store = setup();
  await store.collection("products").doc("PAM-WB001-PNK-500").update({ variantOptions: { colour: "Pink", size: "500ml", finish: "Matte" }, sku: "PAM-WB001-PNK-500" });
  const response = await json(await createOrder(request("/api/orders", null, { customer: "Ada", phone: "+233207015198", deliveryMethod: "pickup", items: [{ id: "PAM-WB001-PNK-500", quantity: 1 }] })));
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.items[0].variantOptions, { colour: "Pink", size: "500ml", finish: "Matte" });
  assert.deepEqual(store.inspect("orders", response.body.orderId).items[0].variantOptions, response.body.items[0].variantOptions);
  assert.match(whatsappOrderMessage(response.body, "Ada", "+233207015198"), /Finish: Matte/);
});

test("wishlist is private and staff accounts cannot use customer routes", async () => {
  setup();
  assert.equal((await json(await getOrders(request("/api/orders")))).status, 401);
  assert.equal((await json(await getWishlist(request("/api/customer/wishlist")))).status, 401);
  assert.equal((await json(await getOrders(request("/api/orders", "staff")))).status, 403);
  assert.equal((await json(await changeWishlist(request("/api/customer/wishlist", "customer-a", { productId: "PAM-WB001-PNK-500" })))).status, 200);
  assert.deepEqual((await json(await getWishlist(request("/api/customer/wishlist", "customer-a")))).body.wishlist, ["PAM-WB001-PNK-500"]);
  assert.deepEqual((await json(await getWishlist(request("/api/customer/wishlist", "customer-b")))).body.wishlist, []);
});

test("mixed variants retain distinct prices and WhatsApp agrees with the saved order", async () => {
  const store = setup();
  const created = await json(await createOrder(request("/api/orders", "customer-a", { customer: "Ada", phone: "0207015198", deliveryMethod: "pickup", items: [{ id: "PAM-WB001-PNK-500", quantity: 2 }, { id: "PAM-WB001-GRN-750", quantity: 1 }] })));
  assert.equal(created.status, 200);
  assert.deepEqual([created.body.subtotal, created.body.discount, created.body.total], [115, 0, 115]);
  assert.deepEqual(created.body.items.map(({ sku, colour, size, unitPrice, lineTotal }) => ({ sku, colour, size, unitPrice, lineTotal })), [
    { sku: "PAM-WB001-PNK-500", colour: "Pink", size: "500ml", unitPrice: 35, lineTotal: 70 },
    { sku: "PAM-WB001-GRN-750", colour: "Green", size: "750ml", unitPrice: 45, lineTotal: 45 },
  ]);
  assert.equal(store.inspect("orders", created.body.orderId).customerUid, "customer-a");
  const message = whatsappOrderMessage(created.body, "Ada", "0207015198");
  assert.match(message, /SKU: PAM-WB001-PNK-500[\s\S]*SKU: PAM-WB001-GRN-750/);
  assert.match(message, /Total: GH₵115\.00/);
});

test("older guest references remain claimable with the checkout phone", async () => {
  const store = setup();
  await store.collection("orders").doc("ORD-LEGACY123").create({ phone: "020 701 5198", customerUid: null, status: "pending", paymentStatus: "pending", total: 20, items: [] });
  assert.equal((await json(await claimOrder(request("/api/customer/orders/claim", "customer-a", { reference: "ORD-LEGACY123", phone: "0207015198" })))).status, 200);
  assert.equal((await json(await claimOrder(request("/api/customer/orders/claim", "customer-b", { reference: "ORD-LEGACY123", phone: "0207015198" })))).status, 404);
});

test("checkout rejects unpriced, out-of-stock and inactive-category products", async () => {
  const store = setup();
  const place = async (id) => json(await createOrder(request("/api/orders", null, { customer: "Ada", phone: "0207015198", items: [{ id, quantity: 1 }] })));
  assert.equal((await place("UNPRICED")).status, 409);
  assert.equal((await place("PAM-WB001-BLU-500")).status, 409);
  store.inspect("categories", "bottles").active = false;
  assert.equal((await place("PAM-WB001-PNK-500")).status, 409);
});

test("customer checkout applies an active PAM Deal to exact variants", async () => {
  const store = setup();
  await store.collection("settings").doc("PAM_DEALS_ACTIVE").create({ value: true });
  await store.collection("deal_bundles").doc("DEAL-BOTTLES").create({ dealId: "DEAL-BOTTLES", name: "Bottle pair", productIds: ["PAM-WB001-PNK-500", "PAM-WB001-GRN-750"], finalPrice: 65, active: true });
  const created = await json(await createOrder(request("/api/orders", null, { customer: "Ada", phone: "0207015198", items: [{ id: "PAM-WB001-PNK-500", quantity: 1 }, { id: "PAM-WB001-GRN-750", quantity: 1 }] })));
  assert.equal(created.status, 200);
  assert.deepEqual([created.body.subtotal, created.body.discount, created.body.total], [80, 15, 65]);
  const saved = store.inspect("orders", created.body.orderId);
  assert.deepEqual(saved.items.map((item) => item.sku), ["PAM-WB001-PNK-500", "PAM-WB001-GRN-750"]);
  assert.equal(saved.items.reduce((sum, item) => sum + item.lineTotal, 0), 65);
  assert.ok(saved.items.some((item) => item.dealBundleSnapshot?.dealIds.includes("DEAL-BOTTLES")));
});

