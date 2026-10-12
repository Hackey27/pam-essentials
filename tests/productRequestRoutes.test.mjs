import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { memoryFirestore } from "./fixtures/memoryFirestore.mjs";
import { POST as submit } from "../app/api/product-requests/route.js";
import { GET as list, POST as update } from "../app/api/admin/product-requests/route.js";
const id = "47bbd9b4-380d-4123-8bb2-2be59d168a91";
const details = { requestId: id, productName: "Storage rack", description: "Black adjustable rack", name: "Ada", phone: "0207015198", quantity: 2, measurements: "180 cm high", budget: "250", allowAlternatives: true, acknowledged: true, status: "quoted", quoteTotal: 1 };
function formRequest(values = details, photos = [], headers = {}) { const form = new FormData(); form.set("details", JSON.stringify(values)); photos.forEach((photo) => form.append("photos", photo)); return new Request("http://test/api/product-requests", { method: "POST", headers, body: form }); }
const adminRequest = (path, token, body) => new Request(`http://test${path}`, { method: body ? "POST" : "GET", headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { "content-type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
function setup() {
  globalThis.__pamTestAuth = undefined; globalThis.__pamTestUsers = new Map([["owner", { uid: "owner", role: "owner" }], ["cashier", { uid: "cashier", role: "cashier" }]]);
  const store = memoryFirestore({ users: { owner: { role: "owner" }, cashier: { role: "cashier" } }, products: { original: { sku: "SAME", price: 20, stock: 7, galleryImagePaths: ["same-photo"] } }, product_requests: {}, product_request_images: {}, orders: {} });
  const original = store.collection.bind(store);
  store.collection = (name) => { const c = original(name); const q = (n = 101, after = null) => ({ limit: (limit) => q(limit, after), startAfter: (snap) => q(n, snap.id), async get() { const docs = (await c.get()).docs; const start = after ? docs.findIndex((doc) => doc.id === after) + 1 : 0; return { docs: docs.slice(start, start + n) }; } }); return { ...c, orderBy: () => q() }; };
  globalThis.__pamTestStore = store; return store;
}
test("guest submission atomically saves private photos/requirements, prevents duplicates and leaves catalogue/order data unchanged", async () => {
  const store = setup(), before = structuredClone(store.inspect("products", "original"));
  const png = await sharp({ create: { width: 80, height: 50, channels: 3, background: "#00235b" } }).png().toBuffer(); const photo = new File([png], "rack.png", { type: "image/png" });
  const response = await submit(formRequest(details, [photo], { origin: "https://pam.test", host: "pam.test" })); assert.equal(response.status, 200, await response.clone().text());
  const data = await response.json(); assert.match(data.reference, /^PAM-REQ-/); assert.match(data.message, /received/);
  const record = store.inspect("product_requests", id); assert.equal(record.status, "new"); assert.equal(record.quoteTotal, null); assert.equal(record.imageIds.length, 1); assert.equal(record.measurements, "180 cm high");
  assert.equal((await (await submit(formRequest(details, [photo]))).json()).duplicate, true);
  assert.equal((await submit(formRequest({ ...details, description: "Changed" }, [photo]))).status, 409);
  assert.deepEqual(store.inspect("products", "original"), before); assert.equal((await store.collection("orders").get()).docs.length, 0);
  assert.equal((await store.collection("product_request_images").get()).docs.length, 1);
});
test("private images and Admin list/quote changes require owner/admin; customer input cannot replace status or price", async () => {
  const store = setup(); const photo = await sharp({ create: { width: 80, height: 50, channels: 3, background: "#fff" } }).png().toBuffer(); await submit(formRequest(details, [new File([photo], "rack.png", { type: "image/png" })]));
  for (const token of [null, "cashier"]) { assert.equal((await list(adminRequest(`/api/admin/product-requests?request=${id}&image=0`, token))).status, token ? 403 : 401); }
  const image = await list(adminRequest(`/api/admin/product-requests?request=${id}&image=0`, "owner")); assert.equal(image.headers.get("content-type"), "image/webp"); assert.match(image.headers.get("cache-control"), /private, no-store/); assert.ok((await image.arrayBuffer()).byteLength);
  const page = await (await list(adminRequest("/api/admin/product-requests", "owner"))).json(); assert.equal(page.requests[0].requestHash, undefined); assert.equal(page.requests[0].base64, undefined); assert.equal(page.requests[0].imageCount, 1);
  const change = { id, status: "quoted", quoteTotal: "250.50", quotation: "Black rack, delivery included. Expected date to confirm.", internalNotes: "Private supplier cost", description: "tampered" };
  assert.equal((await update(adminRequest("/api/admin/product-requests", "cashier", change))).status, 403);
  assert.equal((await update(adminRequest("/api/admin/product-requests", "owner", change))).status, 200);
  assert.equal(store.inspect("product_requests", id).quoteTotal, 250.5); assert.equal(store.inspect("product_requests", id).description, details.description);
  assert.equal((await store.collection("admin_audit").get()).docs[0].data().action, "UPDATE_PRODUCT_REQUEST");
});
test("invalid photos create no partial records; rate limits and database failures never acknowledge success", async () => {
  let store = setup(); assert.equal((await submit(formRequest(details, [new File(["fake"], "fake.png", { type: "image/png" })]))).status, 400); assert.equal((await store.collection("product_requests").get()).docs.length, 0);
  for (let n = 0; n < 5; n++) assert.equal((await submit(formRequest({ ...details, requestId: `47bbd9b4-380d-4123-8bb2-2be59d168a9${n}` }))).status, 200);
  assert.equal((await submit(formRequest({ ...details, requestId: "47bbd9b4-380d-4123-8bb2-2be59d168a99" }))).status, 429);
  assert.equal((await submit(formRequest(details, [], { origin: "https://other.test" }))).status, 403);
  store = setup(); store.getAll = async () => { throw new Error("secret credentials"); }; const failure = await submit(formRequest()); assert.equal(failure.status, 503); assert.doesNotMatch(JSON.stringify(await failure.json()), /secret credentials/);
});
