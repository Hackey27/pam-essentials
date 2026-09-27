import assert from "node:assert/strict";

const origin = process.env.RELEASE_URL || "https://pam-essentials-266824544348.europe-west1.run.app";
const projectId = "pam-essentials-2d7fb";
// Firebase Web API keys are public project identifiers, not credentials.
const webApiKey = "AIzaSyBdbQ7jdq5C7umAbpxYq2QbjeVEJgXb_zc";
const sensitiveFields = ["cost", "costPrice", "wholesalePackPrice", "profit"];

async function request(path) {
  const response = await fetch(new URL(path, origin), { redirect: "manual" });
  return response;
}

const health = await request("/api/health");
assert.equal(health.status, 200, "health route must respond");
assert.equal((await health.json()).status, "ok", "health route must report ok");

const catalogue = await request("/api/catalog/products");
assert.equal(catalogue.status, 200, "catalogue must respond");
const data = await catalogue.json();
assert.ok(Array.isArray(data.products) && data.products.length > 0, "catalogue must contain products");
for (const product of data.products) {
  for (const field of sensitiveFields) assert.ok(!Object.hasOwn(product, field), `catalogue exposed ${field}`);
}

for (const path of ["/api/pos/products", "/api/admin/catalog", "/api/orders", "/api/customer/wishlist"]) {
  const response = await request(path);
  assert.equal(response.status, 401, `${path} must reject an anonymous request`);
}

const productId = data.products[0].id;
const firestoreUrl = new URL(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/products/${encodeURIComponent(productId)}`);
firestoreUrl.searchParams.set("key", webApiKey);
const directRead = await fetch(firestoreUrl);
assert.equal(directRead.status, 403, "direct anonymous Firestore product read must be denied");
const denial = await directRead.json();
assert.equal(denial.error?.status, "PERMISSION_DENIED", "Firestore denial must come from security rules");

console.log(`Release check passed: health, ${data.products.length} catalogue products, four protected routes, and Firestore direct-read denial.`);

