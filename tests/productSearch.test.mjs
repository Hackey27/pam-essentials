import test from "node:test";
import assert from "node:assert/strict";
import { matchesSearch } from "../lib/catalogueBrowse.mjs";
import { productSearchKeywords } from "../lib/productSearch.mjs";
import { publicProduct } from "../lib/productData.js";

test("a name word returns all matching products across categories", () => {
  const products = [{ name: "3D Pencil Case", category: "School" }, { name: "Cartoon pencil case", category: "Gifts" }, { name: "Water bottle", category: "Home" }];
  assert.deepEqual(products.filter((product) => matchesSearch(product, "PENCIL")).map((product) => product.name), ["3D Pencil Case", "Cartoon pencil case"]);
  assert.equal(matchesSearch(products[0], "3D-pencil"), true);
  assert.equal(matchesSearch(products[2], "pencil"), false);
});

test("legacy keyword strings and tag arrays reach public catalogue and suggestions", () => {
  const stored = { name: "Travel cup", keywords: "hydration, drinkware; reusable", tags: ["school supplies", "hydration"] };
  const original = structuredClone(stored);
  const product = publicProduct(stored);
  assert.deepEqual(product.keywords, ["hydration", "drinkware", "reusable", "school supplies"]);
  for (const term of ["hydration", "drinkware", "school supplies"]) assert.equal(matchesSearch(product, term), true);
  assert.equal(matchesSearch(product, "drinkware reusable"), true);
  assert.deepEqual(stored, original);
  assert.deepEqual(productSearchKeywords({ keywords: ["pen", "ink"], tags: "stationery" }), ["pen", "ink", "stationery"]);
});

test("existing SKU, variant and curated searches remain available", () => {
  assert.equal(matchesSearch({ sku: "PAM-WB001", variantOptions: { colour: "Rock gray" } }, "pam-wb001"), true);
  assert.equal(matchesSearch({ name: "Heat bottle", variantOptions: { colour: "Rock gray" } }, "rock gray"), true);
  assert.equal(matchesSearch({ name: "HB pencil", category: "Writing Materials & Accessories" }, "school supplies"), true);
  assert.equal(matchesSearch({ name: "Water bottle" }, "water bottles"), true);
  assert.equal(matchesSearch({ name: "Lunch box" }, "lunch boxes"), true);
});

import { searchCatalogue } from "../lib/friendlySearch.mjs";

test("missed, extra, substituted and swapped letters find every matching bottle", () => {
 const products=[{id:"a",name:"Water bottle"},{id:"b",name:"Pink bottle"},{id:"c",name:"Pencil case"}];
 for(const query of ["botle","bottel","bottlle","bottlr"]) {
  const result=searchCatalogue(products,query);
  assert.deepEqual(new Set(result.products.map(p=>p.id)),new Set(["a","b"]),query);
  assert.equal(result.fuzzyCount,2);
 }
 assert.equal(searchCatalogue(products,"bottel",[],true).products.length,0);
});

test("exact matches rank first without suppressing other plausible spellings", () => {
 const products=[{id:"marker",name:"Marker"},{id:"market",name:"Market bag"},{id:"exact",name:"Marke notebook"},{id:"tags",name:"Notebook",tags:["marke"]}];
 const result=searchCatalogue(products,"marke");
 assert.equal(result.products[0].id,"exact");
 assert.ok(result.products.some(p=>p.id==="marker"));
 assert.ok(result.products.some(p=>p.id==="market"));
 assert.ok(result.products.findIndex(p=>p.id==="tags")>0);
 assert.deepEqual(new Set(searchCatalogue(products,"markre").products.map(p=>p.id)),new Set(["marker","exact","tags"]));
});

test("spacing, plurals, keywords and all words within one product are respected", () => {
 const products=[{id:"case",name:"Pencil Case"},{id:"brush",name:"Bottle Brush",keywords:["cleaner"]},{id:"pink",name:"Pink bottle"},{id:"blue",name:"Blue pencil"}];
 for(const q of ["pencilcase","pencil cases","pencilcases"])assert.equal(searchCatalogue(products,q).products[0].id,"case",q);
 assert.equal(searchCatalogue(products,"bottle brushes").products[0].id,"brush");
 assert.equal(searchCatalogue(products,"cleanre").products[0].id,"brush");
 assert.equal(searchCatalogue(products,"pink pencill").products.length,0);
 assert.deepEqual(searchCatalogue(products,"  PINK   BOTLE ").products.map(p=>p.id),["pink"]);
});

test("synonyms extend matches, disabled groups and identifier typos do not", () => {
 const products=[{id:"PAM-WB-500",sku:"PAM-WB-500",name:"Water bottle"},{id:"b",name:"Pencil case"}];
 assert.equal(searchCatalogue(products,"flask",[{terms:["flask","water bottle"]}]).products[0].id,"PAM-WB-500");
 assert.equal(searchCatalogue(products,"flask",[{terms:["flask","water bottle"],active:false}]).products.length,0);
 assert.equal(searchCatalogue(products,"PAM-WB-500").products[0].id,"PAM-WB-500");
 assert.equal(searchCatalogue(products,"PAM-WB-501").products.length,0);
 assert.equal(searchCatalogue(products,"zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz").products.length,0);
 const snapshot=structuredClone(products);searchCatalogue(products,"botle");assert.deepEqual(products,snapshot);
});
