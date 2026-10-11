import test from "node:test";
import assert from "node:assert/strict";
import { exportCatalogueCsv, parseCatalogueCsv, planCatalogueImport } from "../lib/catalogueImport.mjs";
const hierarchy = { categories: [{ categoryId: "c", name: "School", sortOrder: 7 }], subcategories: [{ subcategoryId: "s", categoryId: "c", name: "Pens" }], subSubcategories: [] };
const original = { id: "immutable-id", sku: "SKU1", name: "Old name", price: 12, stock: 9, categoryId: "c", category: "School", subcategoryId: "s", subcategory: "Pens", subSubcategoryId: "", subSubcategory: "", cardPreviewImagePath: "products/original/card-preview/photo.png", variantOptions: { colour: "Pink" }, productGroupId: "G", barcode: "123", costPrice: 4, active: true, archived: false, sellable: true };
const records = [{ docId: "immutable-id", data: original }];
test("CSV handles UTF-8 BOM, commas, escaped quotes and multiline descriptions", () => {
  const csv = exportCatalogueCsv([{ sku: "SKU1", name: 'Blue, \"bright\" bottle', description: "First line\nSecond line", price: 35, categoryId: "c" }]);
  const row = parseCatalogueCsv(csv)[0];
  assert.equal(row.name, 'Blue, \"bright\" bottle'); assert.equal(row.description, "First line\nSecond line"); assert.equal(row.price, "35");
});
test("rename/price patch matches SKU while keeping immutable ID, stock, variants and images", () => {
  const before = structuredClone(original);
  const plan = planCatalogueImport("SKU,NAME,PRICE\nSKU1,New name,15.50", records, hierarchy);
  assert.equal(plan.errors.length, 0); assert.equal(plan.entries[0].id, "immutable-id");
  assert.deepEqual(plan.entries[0].patch, { name: "New name", price: 15.5 });
  assert.deepEqual(original, before);
  assert.deepEqual(planCatalogueImport("SKU,NAME,PRICE\nSKU1,,", records, hierarchy).entries[0].patch, {});
});
test("new records require essentials and classification follows existing parent hierarchy", () => {
  const plan = planCatalogueImport("SKU,NAME,PRICE,CATEGORY,SUBCATEGORY\nNEW,Pen,10,School,Pens", records, hierarchy);
  assert.equal(plan.errors.length, 0); assert.equal(plan.summary.created, 1); assert.equal(plan.entries[0].patch.subcategoryId, "s");
  assert.equal(planCatalogueImport("SKU,NAME,PRICE,CATEGORY\nNEW,Pen,10,Unknown", records, hierarchy).errors.length, 1);
  assert.equal(planCatalogueImport("SKU,NAME\nNEW,Pen", records, hierarchy).errors.length, 1);
});
test("bad headers, duplicate SKU, invalid price and malformed quotes reject imports", () => {
  assert.throws(() => parseCatalogueCsv("SKU,STOCK\nSKU1,20"), /Unsupported column/);
  assert.throws(() => parseCatalogueCsv('SKU,NAME\nSKU1,"open'), /not closed/);
  assert.throws(() => parseCatalogueCsv("SKU,PRODUCT SKU\nA,A"), /repeat/);
  assert.equal(planCatalogueImport("SKU,PRICE\nSKU1,-1", records, hierarchy).errors.length, 1);
  assert.equal(planCatalogueImport("SKU,NAME\nSKU1,A\nSKU1,B", records, hierarchy).errors.length, 1);
});

test("linked variants cannot be moved to another hierarchy by a file", () => {
  const next = { ...hierarchy, categories: [...hierarchy.categories, { categoryId: "other", name: "Home" }] };
  const plan = planCatalogueImport("SKU,CATEGORY\nSKU1,Home", records, next);
  assert.match(plan.errors[0].message, /linked variants/);
  assert.equal(original.productGroupId, "G");
});

test("Excel-safe export round-trip preserves minus-prefix SKUs and apostrophe text", () => {
  const product = { id: "immutable", sku: "-SKU", name: "'Quoted name", description: "-Description", keywords: ["-keyword"], categoryId: "c", category: "School", price: 5, active: true, archived: false, sellable: true };
  const csv = exportCatalogueCsv([product]);
  const row = parseCatalogueCsv(csv)[0];
  assert.equal(row.sku, product.sku); assert.equal(row.name, product.name); assert.equal(row.description, product.description);
  const plan = planCatalogueImport(csv, [{ docId: "immutable", data: product }], hierarchy);
  assert.equal(plan.errors.length, 0); assert.equal(plan.entries[0].id, "immutable"); assert.deepEqual(plan.entries[0].patch, {});
});
