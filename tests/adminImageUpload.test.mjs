import test from "node:test";
import assert from "node:assert/strict";
import { memoryFirestore } from "./fixtures/memoryFirestore.mjs";
import { POST } from "../app/api/admin/images/route.js";
import { productImageFolder } from "../lib/productImages.mjs";

const id = "PAM-TEST-1";
const path = `products/${productImageFolder(id)}/gallery/test.png`;

function request(token, overrides = {}) {
  return new Request("http://localhost:8080/api/admin/images", {
    method: "POST",
    headers: { "content-type": "image/png", "x-product-id": id, "x-image-path": path, ...(token ? { authorization: `Bearer ${token}` } : {}), ...overrides },
    body: Buffer.from("not an image"),
  });
}

test("image upload rejects guests, non-admin staff, foreign paths and invalid bytes", async () => {
  globalThis.__pamTestUsers = new Map([
    ["cashier", { uid: "cashier", role: "cashier" }],
    ["owner", { uid: "owner", role: "owner" }],
  ]);
  globalThis.__pamTestStore = memoryFirestore({ users: { cashier: { role: "cashier", active: true }, owner: { role: "owner", active: true } }, products: { [encodeURIComponent(id)]: { id } } });
  assert.equal((await POST(request())).status, 401);
  assert.equal((await POST(request("cashier"))).status, 403);
  assert.equal((await POST(request("owner", { "x-image-path": "products/other/gallery/test.png" }))).status, 400);
  assert.equal((await POST(request("owner"))).status, 400);
});
