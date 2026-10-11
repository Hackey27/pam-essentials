import test from "node:test";
import assert from "node:assert/strict";
import { hasSellingPrice, requiresPricingInquiry } from "../lib/productPricing.mjs";
import { validateInquiry } from "../lib/inquiries.mjs";
import { planCatalogueImport, exportCatalogueCsv } from "../lib/catalogueImport.mjs";
import { addToCart } from "../lib/storeCart.js";
import { selectVariant } from "../lib/variantDisplay.mjs";

test("quote eligibility never makes an unpriced item purchasable; priced products keep existing cart behaviour", () => {
  const quote = { id: "rack", contactForPrice: true, price: null, stock: 5 };
  assert.equal(requiresPricingInquiry(quote), true); assert.equal(hasSellingPrice(quote), false);
  assert.equal(requiresPricingInquiry({ ...quote, contactForPrice: false }), false);
  assert.equal(requiresPricingInquiry({ ...quote, price: 75 }), false);
  assert.deepEqual(addToCart([], quote), []);
  assert.equal(addToCart([], { ...quote, price: 75 }, 8)[0].quantity, 5);
  const other = { ...quote, id: "high", variantOptions: { height: "180 cm" }, stock: 0 };
  assert.equal(selectVariant([other], quote, "height", "180 cm").id, "high");
});
test("blank CSV price is cleared only for explicitly enabled quote products; SKU identity and commercial metadata survive", () => {
  const item = { id: "immutable", sku: "RACK-1", name: "Storage rack", price: 150, stock: 4, categoryId: "home", active: true, archived: false, sellable: true, cardPreviewImagePath: "existing-photo", variantOptions: { size: "Large" } };
  const hierarchy = { categories: [{ categoryId: "home", name: "Home" }], subcategories: [], subSubcategories: [] };
  const records = [{ docId: item.id, data: item }];
  assert.deepEqual(planCatalogueImport("SKU,PRICE\nRACK-1,", records, hierarchy).entries[0].patch, {});
  const plan = planCatalogueImport("SKU,PRICE,CONTACT_FOR_PRICE\nRACK-1,,TRUE", records, hierarchy);
  assert.equal(plan.errors.length, 0); assert.equal(plan.entries[0].id, "immutable");
  assert.deepEqual(plan.entries[0].patch, { contactForPrice: true, price: null, sellable: false });
  assert.equal(item.price, 150); assert.equal(item.cardPreviewImagePath, "existing-photo");
  const enabled = [{ docId: item.id, data: { ...item, contactForPrice: true } }];
  assert.deepEqual(planCatalogueImport("SKU,PRICE\nRACK-1,", enabled, hierarchy).entries[0].patch, { price: null, sellable: false });
  assert.deepEqual(planCatalogueImport("SKU,NAME\nRACK-1,Rename", enabled, hierarchy).entries[0].patch, { name: "Rename" });
  const newItem = planCatalogueImport("SKU,NAME,CATEGORY,CONTACT_FOR_PRICE\nNEW,Rack,Home,TRUE", [], hierarchy);
  assert.equal(newItem.errors.length, 0); assert.equal(newItem.entries[0].patch.price, null);
  assert.equal(planCatalogueImport("SKU,CONTACT_FOR_PRICE\nRACK-1,maybe", records, hierarchy).errors.length, 1);
  assert.equal(planCatalogueImport(exportCatalogueCsv([{ ...item, contactForPrice: true, price: null, sellable: false }]), [{ docId: item.id, data: { ...item, contactForPrice: true, price: null, sellable: false } }], hierarchy).errors.length, 0);
});
test("inquiry validation requires reachable contact and message; rejects oversized/spam values and ignores injected status", () => {
  const body = { requestId: "47bbd9b4-380d-4123-8bb2-2be59d168a91", productId: "rack", name: "Ada", phone: "0207015198", message: "Please quote an 180 cm rack.", status: "resolved", price: 1 };
  const value = validateInquiry(body); assert.equal(value.status, undefined); assert.equal(value.price, undefined); assert.equal(value.quantity, 1);
  assert.throws(() => validateInquiry({ ...body, phone: "", email: "" }), /phone number or email/);
  assert.throws(() => validateInquiry({ ...body, email: "invalid" }), /valid email/);
  assert.throws(() => validateInquiry({ ...body, quantity: 1.5 }), /Quantity/);
  assert.throws(() => validateInquiry({ ...body, message: "" }), /Message/);
  assert.throws(() => validateInquiry({ ...body, message: "a".repeat(2001) }), /Message/);
  assert.throws(() => validateInquiry({ ...body, website: "spam" }), /could not/);
});
