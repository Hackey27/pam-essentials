import test from "node:test";
import assert from "node:assert/strict";
import { memoryFirestore } from "./fixtures/memoryFirestore.mjs";
import { POST } from "../app/api/admin/products/route.js";

const base = { id: "A", name: "Bottle Black", categoryId: "C", subcategoryId: "S", subSubcategoryId: "L", sku: "SKU-A", price: 35, stock: 4, active: true };
const second = { ...base, id: "B", name: "Bottle White", sku: "SKU-B", price: 45, stock: 0 };
const post = (body) => new Request("http://localhost:8080/api/admin/products", { method: "POST", headers: { authorization: "Bearer owner", "content-type": "application/json" }, body: JSON.stringify(body) });

test("Admin links saved products and retains each sibling's commercial identity", async () => {
  globalThis.__pamTestUsers = new Map([["owner", { uid: "owner", email: "owner@example.com", role: "owner" }]]);
  const store = memoryFirestore({ users: { owner: { role: "owner", active: true } }, products: { A: base, B: second }, categories: { C: { name: "Bottles" } }, subcategories: { S: { categoryId: "C", name: "Bottles" } }, sub_subcategories: { L: { categoryId: "C", subcategoryId: "S", name: "Water bottles" } }, admin_audit: {} });
  globalThis.__pamTestStore = store;
  const response = await POST(post({ ...base, create: false, variantEnabled: true,
    variantTitles: [{ title: "Colour", values: ["Black", "White"] }],
    variantCombinations: [{ productId: "A", options: { colour: "Black" } }, { productId: "B", options: { colour: "White" } }],
  }));
  assert.equal(response.status, 200, await response.text());
  const a = store.inspect("products", "A"), b = store.inspect("products", "B");
  assert.equal(a.productGroupId, "ADMIN-A");
  assert.equal(b.productGroupId, "ADMIN-A");
  assert.deepEqual(b.variantOptions, { colour: "White" });
  assert.equal(b.sku, "SKU-B");
  assert.equal(b.price, 45);
  assert.equal(b.stock, 0);
  assert.equal(b.variantManaged, true);
});
