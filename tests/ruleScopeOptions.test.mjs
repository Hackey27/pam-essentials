import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ruleScopeOptions } from "../lib/ruleScopeOptions.mjs";

test("every catalogue product maps to its own rule option ID", () => {
  const products = JSON.parse(readFileSync(new URL("../data/products.json", import.meta.url), "utf8"));
  const options = ruleScopeOptions("PRODUCT", [], products);
  assert.equal(options.length, products.length);
  assert.equal(new Set(options.map((option) => option.id)).size, products.length);
  for (let index = 0; index < products.length; index += 1) {
    assert.equal(options[index].id, products[index].id);
    assert.ok(options[index].label.endsWith(` · ${products[index].id}`));
  }
  const pencilCase = products.find((product) => product.name.toLowerCase() === "3d pencil case");
  assert.ok(pencilCase);
  assert.equal(options.find((option) => option.id === pencilCase.id)?.id, pencilCase.id);
  assert.notEqual(pencilCase.id, pencilCase.categoryId);
});
