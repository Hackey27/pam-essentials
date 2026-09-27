import test from "node:test";
import assert from "node:assert/strict";
import { effectiveCollections } from "../lib/categoryHierarchy.js";

test("category collections flow to descendants without leaking to a sibling", () => {
  const hierarchy = {
    categories: [{ categoryId: "bottles", collections: ["Back to School"] }],
    subcategories: [
      { subcategoryId: "water", categoryId: "bottles", collections: ["PAM Deals"] },
      { subcategoryId: "brushes", categoryId: "bottles", collections: ["Promotion"] },
    ],
    subSubcategories: [{ subSubcategoryId: "cartoon", categoryId: "bottles", subcategoryId: "water", collections: ["Promotion"] }],
  };
  const bottle = { categoryId: "bottles", subcategoryId: "water", subSubcategoryId: "cartoon", collections: ["Best Sellers"] };
  assert.deepEqual(effectiveCollections(bottle, hierarchy), ["Best Sellers", "Back to School", "PAM Deals", "Promotion"]);
  assert.deepEqual(effectiveCollections({ ...bottle, subcategoryId: "brushes", subSubcategoryId: "" }, hierarchy), ["Best Sellers", "Back to School", "Promotion"]);
});

