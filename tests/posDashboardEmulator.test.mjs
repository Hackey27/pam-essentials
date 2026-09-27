import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { adminAuth, adminDb } from "../lib/admin.js";
import { GET as dashboard } from "../app/api/pos/dashboard/route.js";

const projectId = "demo-pam-essentials";
const ready = process.env.GOOGLE_CLOUD_PROJECT === projectId &&
  process.env.FIREBASE_AUTH_EMULATOR_HOST === "127.0.0.1:9099" &&
  process.env.FIRESTORE_EMULATOR_HOST === "127.0.0.1:8081";

test("POS dashboard keeps cashier profit private and accepts today as a custom end date", { skip: !ready && "Set the demo project and local Firebase emulators" }, async () => {
  const store = adminDb();
  const app = initializeApp({ projectId, apiKey: "fake-api-key", authDomain: `${projectId}.firebaseapp.com` }, `pam-pos-${randomUUID()}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const identities = [];
  try {
    const prefix = randomUUID().slice(0, 8);
    for (const role of ["cashier", "owner"]) {
      const account = await createUserWithEmailAndPassword(auth, `pos-${prefix}-${role}@example.test`, `Test-${randomUUID()}-Aa1`);
      await store.collection("users").doc(account.user.uid).set({ role, active: true });
      identities.push({ uid: account.user.uid, role, token: await account.user.getIdToken() });
      await signOut(auth);
    }
    const stamp = Timestamp.now();
    await store.collection("products").doc(`PAM-POS-${prefix}`).set({ name: "Test bottle", price: 35, stock: 3, active: true });
    await store.collection("sales").doc(`sale-${prefix}`).set({ createdAt: stamp, total: 35, discount: 0, cost: 20, profit: 15, receiptId: `receipt-${prefix}`, paymentMethod: "cash", salesChannel: "walk-in", staffEmail: identities[0].uid, items: [{ productId: `PAM-POS-${prefix}`, name: "Test bottle", sku: `PAM-POS-${prefix}`, quantity: 1, lineTotal: 35, cost: 20 }] });
    const today = new Date().toISOString().slice(0, 10);
    const url = `http://localhost:8080/api/pos/dashboard?period=custom&start=${today}&end=${today}`;
    const call = async ({ token }) => {
      const response = await dashboard(new Request(url, { headers: { authorization: `Bearer ${token}` } }));
      return { status: response.status, body: await response.json() };
    };
    const cashier = await call(identities[0]);
    const owner = await call(identities[1]);
    assert.equal(cashier.status, 200);
    assert.equal(owner.status, 200);
    assert.equal(cashier.body.summary.sales, 35);
    assert.ok(cashier.body.summary.lowStock >= 1);
    assert.equal("grossProfit" in cashier.body.summary, false);
    assert.equal("netProfit" in cashier.body.summary, false);
    assert.equal(JSON.stringify(cashier.body).includes('"cost"'), false);
    assert.equal(JSON.stringify(cashier.body).includes('"profit"'), false);
    assert.equal(owner.body.summary.grossProfit, 15);
    assert.equal(owner.body.summary.netProfit, 15);
  } finally {
    await Promise.allSettled(identities.map(({ uid }) => adminAuth().deleteUser(uid)));
    await deleteApp(app);
  }
});

