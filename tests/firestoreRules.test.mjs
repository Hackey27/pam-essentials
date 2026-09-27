import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { initializeApp as initializeClientApp, deleteApp as deleteClientApp } from "firebase/app";
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore as getClientFirestore, connectFirestoreEmulator, doc, getDoc, setDoc } from "firebase/firestore";
import { initializeApp as initializeAdminApp, deleteApp as deleteAdminApp } from "firebase-admin/app";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { getAuth as getAdminAuth } from "firebase-admin/auth";

const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
const projectId = "demo-pam-essentials";

test("Firestore rules keep private costs and sales out of direct customer and cashier reads", { skip: !(authHost && firestoreHost) && "Start Auth and Firestore emulators" }, async () => {
  const [firestoreAddress, firestorePort] = firestoreHost.split(":");
  const adminApp = initializeAdminApp({ projectId }, `pam-rules-admin-${randomUUID()}`);
  const adminDb = getAdminFirestore(adminApp);
  const apps = [];
  const identities = [];
  const client = async (role) => {
    const app = initializeClientApp({ projectId, apiKey: "fake-api-key", authDomain: `${projectId}.firebaseapp.com` }, `pam-rules-${randomUUID()}`);
    apps.push(app);
    const auth = getAuth(app);
    connectAuthEmulator(auth, `http://${authHost}`, { disableWarnings: true });
    const db = getClientFirestore(app);
    connectFirestoreEmulator(db, firestoreAddress, Number(firestorePort));
    if (role) {
      const account = await createUserWithEmailAndPassword(auth, `pam-rules-${randomUUID()}@example.test`, `Test-${randomUUID()}-Aa1`);
      identities.push(account.user.uid);
      if (role !== "customer") await adminDb.collection("users").doc(account.user.uid).set({ role, active: true });
      return { db, uid: account.user.uid };
    }
    return { db, uid: null };
  };
  const denied = async (operation) => assert.rejects(operation, (error) => error.code === "permission-denied");
  try {
    await adminDb.collection("products").doc("priced").set({ name: "Test bottle", active: true, archived: false, sellable: true, price: 35, costPrice: 12, wholesalePackPrice: 18 });
    await adminDb.collection("products").doc("hidden").set({ name: "Hidden bottle", active: false, archived: false, sellable: true, price: 35, costPrice: 12 });
    await adminDb.collection("categories").doc("active").set({ name: "Bottles", active: true });
    await adminDb.collection("categories").doc("inactive").set({ name: "Hidden", active: false });
    await adminDb.collection("sales").doc("sale").set({ total: 35, cost: 12, profit: 23 });
    await adminDb.collection("orders").doc("order").set({ phone: "0207015198", customerUid: "none" });
    await adminDb.collection("settings").doc("STORE_NAME").set({ value: "PAM" });
    const anonymous = await client(null);
    const customer = await client("customer");
    const cashier = await client("cashier");
    const supervisor = await client("supervisor");
    const owner = await client("owner");
    await denied(() => getDoc(doc(anonymous.db, "products", "priced")));
    await denied(() => getDoc(doc(customer.db, "products", "priced")));
    await denied(() => getDoc(doc(cashier.db, "products", "priced")));
    await denied(() => getDoc(doc(cashier.db, "sales", "sale")));
    await denied(() => getDoc(doc(supervisor.db, "sales", "sale")));
    assert.equal((await getDoc(doc(owner.db, "products", "priced"))).data().costPrice, 12);
    assert.equal((await getDoc(doc(owner.db, "sales", "sale"))).data().profit, 23);
    assert.equal((await getDoc(doc(anonymous.db, "categories", "active"))).data().name, "Bottles");
    await denied(() => getDoc(doc(anonymous.db, "categories", "inactive")));
    await denied(() => getDoc(doc(customer.db, "orders", "order")));
    await denied(() => getDoc(doc(customer.db, "users", cashier.uid)));
    assert.equal((await getDoc(doc(customer.db, "users", customer.uid))).exists(), false);
    await denied(() => getDoc(doc(customer.db, "customer_accounts", customer.uid)));
    await denied(() => setDoc(doc(customer.db, "customer_accounts", customer.uid), { wishlist: ["priced"] }));
    await denied(() => setDoc(doc(owner.db, "products", "priced"), { costPrice: 1 }, { merge: true }));
  } finally {
    await Promise.allSettled(identities.map((uid) => getAdminAuth(adminApp).deleteUser(uid)));
    await Promise.allSettled(apps.map((app) => deleteClientApp(app)));
    await deleteAdminApp(adminApp);
  }
});

