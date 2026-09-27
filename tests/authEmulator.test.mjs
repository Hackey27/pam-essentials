import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { initializeApp as initializeClientApp, deleteApp as deleteClientApp } from "firebase/app";
import { getAuth as getClientAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { initializeApp as initializeAdminApp, deleteApp as deleteAdminApp } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { memoryFirestore } from "./fixtures/memoryFirestore.mjs";
import { GET as getOrders } from "../app/api/orders/route.js";
import { POST as claimOrder } from "../app/api/customer/orders/claim/route.js";

const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;

test("Firebase Auth emulator signup, sign-in, token verification and order isolation", { skip: !host && "Start the local Auth emulator and set FIREBASE_AUTH_EMULATOR_HOST" }, async () => {
  const projectId = "demo-pam-essentials";
  const clientApp = initializeClientApp({ projectId, apiKey: "fake-api-key", authDomain: `${projectId}.firebaseapp.com` }, `pam-test-${randomUUID()}`);
  const adminApp = initializeAdminApp({ projectId }, `pam-admin-test-${randomUUID()}`);
  const clientAuth = getClientAuth(clientApp);
  connectAuthEmulator(clientAuth, `http://${host}`, { disableWarnings: true });
  const adminAuth = getAdminAuth(adminApp);
  const password = `Test-${randomUUID()}-Aa1`;
  const accounts = [];
  try {
    for (let index = 0; index < 2; index += 1) {
      const email = `pam-disposable-${randomUUID()}@example.test`;
      const created = await createUserWithEmailAndPassword(clientAuth, email, password);
      await signOut(clientAuth);
      const signedIn = await signInWithEmailAndPassword(clientAuth, email, password);
      assert.equal(signedIn.user.uid, created.user.uid);
      const token = await signedIn.user.getIdToken();
      assert.equal((await adminAuth.verifyIdToken(token)).uid, created.user.uid);
      accounts.push({ uid: created.user.uid, token });
      await signOut(clientAuth);
    }
    globalThis.__pamTestAuth = adminAuth;
    globalThis.__pamTestStore = memoryFirestore({ users: {}, orders: { "ORD-OLD123": { phone: "0207015198", customerUid: null, status: "pending", paymentStatus: "pending", total: 35, items: [] } }, customer_accounts: {} });
    const request = (path, account, body) => new Request(`http://localhost:8080${path}`, { method: body ? "POST" : "GET", headers: { authorization: `Bearer ${account.token}`, ...(body ? { "content-type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    assert.equal((await getOrders(request("/api/orders", accounts[0]))).status, 200);
    assert.equal((await claimOrder(request("/api/customer/orders/claim", accounts[0], { reference: "ORD-OLD123", phone: "0207015198" }))).status, 200);
    const mine = await (await getOrders(request("/api/orders", accounts[0]))).json();
    const others = await (await getOrders(request("/api/orders", accounts[1]))).json();
    assert.equal(mine.orders.length, 1);
    assert.equal(others.orders.length, 0);
    assert.equal((await claimOrder(request("/api/customer/orders/claim", accounts[1], { reference: "ORD-OLD123", phone: "0207015198" }))).status, 404);
  } finally {
    delete globalThis.__pamTestAuth;
    delete globalThis.__pamTestStore;
    await Promise.all(accounts.map(({ uid }) => adminAuth.deleteUser(uid).catch(() => {})));
    await Promise.all([deleteClientApp(clientApp), deleteAdminApp(adminApp)]);
  }
});

