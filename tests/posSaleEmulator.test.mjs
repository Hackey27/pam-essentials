import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from "firebase/auth";
import { adminAuth, adminDb } from "../lib/admin.js";
import { POST as createSale } from "../app/api/pos/sales/route.js";
import { POST as changeShift } from "../app/api/pos/shifts/route.js";
import { GET as listReceipts } from "../app/api/pos/receipts/route.js";

const projectId = "demo-pam-essentials";
const ready = process.env.GOOGLE_CLOUD_PROJECT === projectId && process.env.FIREBASE_AUTH_EMULATOR_HOST === "127.0.0.1:9099" && process.env.FIRESTORE_EMULATOR_HOST === "127.0.0.1:8081";

test("POS sale requires verified manual payment and stays idempotent", { skip: !ready && "Set the demo project and local Firebase emulators" }, async () => {
  const store = adminDb();
  const app = initializeApp({ projectId, apiKey: "fake-api-key", authDomain: `${projectId}.firebaseapp.com` }, `pam-sale-${randomUUID()}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  let uid;
  try {
    const prefix = randomUUID().slice(0, 8);
    const account = await createUserWithEmailAndPassword(auth, `sale-${prefix}@example.test`, `Test-${randomUUID()}-Aa1`);
    uid = account.user.uid;
    const token = await account.user.getIdToken();
    await store.collection("users").doc(uid).set({ role: "cashier", displayName: "Ama Cashier", active: true });
    await store.collection("categories").doc(`sale-cat-${prefix}`).set({ name: "Bottles", active: true, sortOrder: 1 });
    const id = `PAM-SALE-${prefix}`;
    await store.collection("products").doc(encodeURIComponent(id)).set({ id, name: "Test bottle", categoryId: `sale-cat-${prefix}`, category: "Bottles", productGroupId: "WB001", colour: "Pink", size: "500ml", price: 35, stock: 3, active: true, archived: false });
    const shiftId = `SHIFT-${prefix}`;
    await store.collection("shifts").doc(shiftId).set({ shiftId, staffId: uid, status: "open", aggregationVersion: 1, transactionCount: 0, salesTotal: 0, paymentMix: {} });
    const payload = { transactionId: randomUUID(), shiftId, deviceId: "TEST-TILL", salesChannel: "whatsapp", orderReference: `WA-${prefix}`, customerName: "Test customer", customerPhone: "0207015198", paymentMethod: "mobile-money", amountPaid: 35, items: [{ id, quantity: 1 }] };
    const call = async (body) => { const response = await createSale(new Request("http://localhost:8080/api/pos/sales", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(body) })); return { status: response.status, body: await response.json() }; };
    assert.equal((await call(payload)).status, 409);
    assert.equal((await call({ ...payload, transactionVerified: true, amountPaid: 0 })).status, 409);
    const saved = await call({ ...payload, transactionVerified: true });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.total, 35);
    assert.match(saved.body.receiptId, /^PAM-\d{6}-\d{4,}$/);
    assert.equal(saved.body.items[0].variantId, id);
    assert.equal(saved.body.staffName, "Ama Cashier");
    assert.equal("cost" in saved.body, false);
    const repeated = await call({ ...payload, transactionVerified: true });
    assert.equal(repeated.status, 200);
    assert.equal(repeated.body.duplicate, true);
    const sale = (await store.collection("sales").doc(payload.transactionId).get()).data();
    assert.equal(sale.items[0].variantId, id);
    assert.equal(sale.customerName, "Test customer");
    assert.equal(sale.customerPhone, "0207015198");
    assert.equal(sale.staffName, "Ama Cashier");
    assert.equal((await store.collection("products").doc(encodeURIComponent(id)).get()).data().stock, 2);
    const receiptsResponse = await listReceipts(new Request("http://localhost:8080/api/pos/receipts", { headers: { authorization: `Bearer ${token}` } }));
    assert.equal(receiptsResponse.status, 200);
    const recorded = (await receiptsResponse.json()).receipts.find((item) => item.receiptId === saved.body.receiptId);
    assert.equal(recorded.customerPhone, "0207015198");
    assert.equal(recorded.items[0].sku, id);
    assert.equal("profit" in recorded, false);
    const nextSale = await call({ ...payload, transactionId: randomUUID(), paymentMethod: "cash", transactionVerified: false });
    assert.equal(nextSale.status, 200);
    assert.notEqual(nextSale.body.receiptId, saved.body.receiptId);
    assert.equal(Number(nextSale.body.receiptId.slice(-4)), Number(saved.body.receiptId.slice(-4)) + 1);
    const close = await changeShift(new Request("http://localhost:8080/api/pos/shifts", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ action: "close", shiftId }) }));
    assert.equal(close.status, 200);
    assert.deepEqual((await close.json()).shift.summary, { transactions: 2, salesTotal: 70, paymentMix: { "mobile-money": 35, cash: 35 } });
  } finally {
    if (uid) await adminAuth().deleteUser(uid);
    await deleteApp(app);
  }
});
