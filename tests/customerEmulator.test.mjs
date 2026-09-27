import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { initializeApp as initializeClientApp, deleteApp as deleteClientApp } from "firebase/app";
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { adminAuth, adminDb } from "../lib/admin.js";
import { GET as getOrders, POST as createOrder } from "../app/api/orders/route.js";
import { POST as claimOrder } from "../app/api/customer/orders/claim/route.js";
import { GET as getWishlist, POST as changeWishlist } from "../app/api/customer/wishlist/route.js";

const projectId = "demo-pam-essentials";
const ready = process.env.GOOGLE_CLOUD_PROJECT === projectId &&
  process.env.FIREBASE_AUTH_EMULATOR_HOST === "127.0.0.1:9099" &&
  process.env.FIRESTORE_EMULATOR_HOST === "127.0.0.1:8081";
const request = (path, token, body) => new Request(`http://localhost:8080${path}`, {
  method: body ? "POST" : "GET",
  headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { "content-type": "application/json" } : {}) },
  ...(body ? { body: JSON.stringify(body) } : {}),
});
const json = async (response) => ({ status: response.status, body: await response.json() });

test("real customer handlers use local Auth and Firestore together", { skip: !ready && "Set the demo project and both local Firebase emulator hosts" }, async () => {
  const store = adminDb();
  const clientApp = initializeClientApp({ projectId, apiKey: "fake-api-key", authDomain: `${projectId}.firebaseapp.com` }, `pam-customer-${randomUUID()}`);
  const auth = getAuth(clientApp);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const identities = [];
  try {
    const prefix = randomUUID().slice(0, 8);
    await store.collection("categories").doc("bottles").set({ name: "Bottles & Accessories", active: true, sortOrder: 1 });
    await store.collection("subcategories").doc("water").set({ name: "Water Bottles", categoryId: "bottles", active: true, sortOrder: 1 });
    await store.collection("discount_rules").doc("quantity5").set({ name: "Quantity discount", active: true, scopeType: "GLOBAL", discountType: "PERCENT", value: 5, minQty: 3 });
    for (const [id, colour, size, price, stock] of [["PAM-WB001-PNK-500", "Pink", "500ml", 35, 4], ["PAM-WB001-GRN-750", "Green", "750ml", 45, 3], ["PAM-WB001-BLU-500", "Blue", "500ml", 40, 0]]) {
      await store.collection("products").doc(id).set({ id, name: "Cartoon Water Bottle", categoryId: "bottles", category: "Bottles & Accessories", subcategoryId: "water", productGroupId: "WB001", colour, size, price, stock, active: true, archived: false });
    }
    for (let index = 0; index < 2; index += 1) {
      const account = await createUserWithEmailAndPassword(auth, `pam-${prefix}-${index}@example.test`, `Test-${randomUUID()}-Aa1`);
      identities.push({ uid: account.user.uid, token: await account.user.getIdToken() });
      await signOut(auth);
    }
    const placed = await json(await createOrder(request("/api/orders", null, { customer: "Ada", phone: "0207015198", deliveryMethod: "pickup", items: [{ id: "PAM-WB001-PNK-500", quantity: 2 }, { id: "PAM-WB001-GRN-750", quantity: 1 }] })));
    assert.equal(placed.status, 200);
    assert.deepEqual([placed.body.subtotal, placed.body.discount, placed.body.total], [115, 5.75, 109.25]);
    const saved = (await store.collection("orders").doc(placed.body.orderId).get()).data();
    assert.equal(saved.customerUid, null);
    assert.deepEqual(saved.items.map(({ sku, variantId, quantity }) => ({ sku, variantId, quantity })), [
      { sku: "PAM-WB001-PNK-500", variantId: "PAM-WB001-PNK-500", quantity: 2 },
      { sku: "PAM-WB001-GRN-750", variantId: "PAM-WB001-GRN-750", quantity: 1 },
    ]);
    assert.equal((await json(await getOrders(request("/api/orders", identities[0].token)))).body.orders.length, 0);
    assert.equal((await json(await claimOrder(request("/api/customer/orders/claim", identities[0].token, { reference: placed.body.orderId, phone: "0207015198" })))).status, 200);
    assert.equal((await json(await getOrders(request("/api/orders", identities[0].token)))).body.orders[0].orderId, placed.body.orderId);
    assert.equal((await json(await getOrders(request(`/api/orders?reference=${placed.body.orderId}`, identities[1].token)))).status, 404);
    assert.equal((await json(await changeWishlist(request("/api/customer/wishlist", identities[0].token, { productId: "PAM-WB001-PNK-500" })))).status, 200);
    assert.deepEqual((await json(await getWishlist(request("/api/customer/wishlist", identities[0].token)))).body.wishlist, ["PAM-WB001-PNK-500"]);
    assert.deepEqual((await json(await getWishlist(request("/api/customer/wishlist", identities[1].token)))).body.wishlist, []);
    assert.equal((await json(await createOrder(request("/api/orders", null, { customer: "Ada", phone: "0207015198", items: [{ id: "PAM-WB001-BLU-500", quantity: 1 }] })))).status, 409);
  } finally {
    await Promise.allSettled(identities.map(({ uid }) => adminAuth().deleteUser(uid)));
    await deleteClientApp(clientApp);
  }
});

