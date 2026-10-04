import test from "node:test";
import assert from "node:assert/strict";
import { editorVariantState, planVariantGroup, remapVariantImages } from "../lib/adminVariants.mjs";

const products = [
  { id: "A", categoryId: "C", subcategoryId: "S", subSubcategoryId: "L", name: "Bottle Black", sku: "A", price: 35, stock: 3 },
  { id: "B", categoryId: "C", subcategoryId: "S", subSubcategoryId: "L", name: "Bottle White", sku: "B", price: 45, stock: 0 },
  { id: "C", categoryId: "C", subcategoryId: "OTHER", name: "Other", sku: "C" },
];
const body = { variantEnabled: true, variantTitles: [{ title: "Colour", values: ["Black", "White"] }, { title: "Size", values: ["500ml"] }], variantCombinations: [
  { productId: "A", options: { colour: "Black", size: "500ml" } },
  { productId: "B", options: { colour: "White", size: "500ml" } },
] };

test("plans existing product links without merging independent prices, SKUs or stock", () => {
  const plan = planVariantGroup(body, products[0], products);
  assert.equal(plan.groupId, "ADMIN-A");
  assert.deepEqual(plan.members.map((member) => member.product.id), ["A", "B"]);
  assert.deepEqual(plan.members[1].options, { colour: "White", size: "500ml" });
  assert.equal(products[1].price, 45);
  assert.equal(products[1].stock, 0);
});

test("rejects duplicate combinations, other groups and products outside the final category", () => {
  assert.match(planVariantGroup({ ...body, variantCombinations: body.variantCombinations.map((row) => ({ ...row, options: body.variantCombinations[0].options })) }, products[0], products).error, /same variant/);
  assert.match(planVariantGroup({ ...body, variantCombinations: [body.variantCombinations[0], { productId: "C", options: { colour: "White", size: "500ml" } }] }, products[0], products).error, /same final category/);
  assert.match(planVariantGroup(body, products[0], [products[0], { ...products[1], productGroupId: "OTHER" }]).error, /another variant group/);
});

test("legacy colour and size groups open with populated titles and combinations", () => {
  const legacy = products.slice(0, 2).map((product, index) => ({ ...product, productGroupId: "WB1", colour: index ? "White" : "Black", size: "500ml" }));
  const state = editorVariantState(legacy[0], legacy);
  assert.equal(state.variantEnabled, true);
  assert.deepEqual(state.variantTitles, [{ title: "colour", values: ["Black", "White"] }, { title: "size", values: ["500ml"] }]);
  assert.equal(state.variantCombinations[1].options.colour, "White");
});

test("changing an option retains its previously assigned combination image", () => {
  const old = { ...products[0], colour: "Black", size: "500ml", variantImages: { "colour=Black|size=500ml": { imagePath: "products/a/variants/black/main/photo.jpg" } } };
  const plan = planVariantGroup({ variantEnabled: true, variantTitles: [{ title: "Colour", values: ["Graphite"] }], variantCombinations: [{ productId: "A", options: { colour: "Graphite" } }] }, old, [old]);
  assert.equal(remapVariantImages(plan, old.variantImages)["colour=Graphite"].imagePath, old.variantImages["colour=Black|size=500ml"].imagePath);
});
