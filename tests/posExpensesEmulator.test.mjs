import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from "firebase/auth";
import { adminAuth, adminDb } from "../lib/admin.js";
import { GET, POST } from "../app/api/pos/expenses/route.js";
import { GET as dashboard } from "../app/api/pos/dashboard/route.js";

const projectId = "demo-pam-essentials";
const ready = process.env.GOOGLE_CLOUD_PROJECT === projectId && process.env.FIREBASE_AUTH_EMULATOR_HOST === "127.0.0.1:9099" && process.env.FIRESTORE_EMULATOR_HOST === "127.0.0.1:8081";

test("cashier can record a shift expense without seeing profit", { skip: !ready && "Set the demo project and local Firebase emulators" }, async () => {
  const store = adminDb();
  const app = initializeApp({ projectId, apiKey: "fake-api-key", authDomain: `${projectId}.firebaseapp.com` }, `pam-expense-${randomUUID()}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  let uid;
  try {
    const prefix = randomUUID().slice(0, 8);
    const account = await createUserWithEmailAndPassword(auth, `expense-${prefix}@example.test`, `Test-${randomUUID()}-Aa1`);
    uid = account.user.uid;
    const token = await account.user.getIdToken();
    await store.collection("users").doc(uid).set({ role: "cashier", active: true });
    const shiftId = `SHIFT-${prefix}`;
    await store.collection("shifts").doc(shiftId).set({ shiftId, staffId: uid, status: "open" });
    const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
    const payload = { shiftId, expenseDate: new Date().toISOString().slice(0, 10), category: "Transport", description: "Courier pickup", amount: 12.5, paymentMethod: "cash" };
    const call = async (body) => POST(new Request("http://localhost:8080/api/pos/expenses", { method: "POST", headers, body: JSON.stringify(body) }));
    assert.equal((await call({ ...payload, amount: -1 })).status, 400);
    assert.equal((await call({ ...payload, shiftId: "SHIFT-OTHER" })).status, 403);
    const saved = await call(payload);
    assert.equal(saved.status, 200);
    const { expenseId } = await saved.json();
    const expense = (await store.collection("expenses").doc(expenseId).get()).data();
    assert.equal(expense.staffId, uid);
    assert.equal(expense.shiftId, shiftId);
    assert.equal(expense.amount, 12.5);
    const list = await GET(new Request(`http://localhost:8080/api/pos/expenses?shiftId=${shiftId}`, { headers }));
    assert.equal(list.status, 200);
    assert.equal((await list.json()).expenses.some((item) => item.expenseId === expenseId), true);
    const report = await dashboard(new Request("http://localhost:8080/api/pos/dashboard?period=today", { headers }));
    assert.equal(report.status, 200);
    const body = await report.json();
    assert.ok(body.summary.expenses >= 12.5);
    assert.equal("grossProfit" in body.summary, false);
    assert.equal("netProfit" in body.summary, false);
    assert.equal(JSON.stringify(body).includes('"profit"'), false);
  } finally {
    if (uid) await adminAuth().deleteUser(uid);
    await deleteApp(app);
  }
});

