import { deepestCategory } from "./adminVariants.mjs";

const equal = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
export function normalizeBulkRequest(body) {
  if (!Array.isArray(body.ids) || !body.ids.length || body.ids.length > 100 || body.ids.some((id) => typeof id !== "string" || !id || id.length > 160) || new Set(body.ids).size !== body.ids.length) throw new Error("Select between 1 and 100 different products.");
  const patch = body.patch;
  if (!patch || typeof patch !== "object" || Array.isArray(patch) || !Object.keys(patch).length || Object.keys(patch).some((key) => !["price", "categoryId", "subcategoryId", "subSubcategoryId", "collections", "active"].includes(key))) throw new Error("Choose supported bulk changes. Stock and product identity cannot be edited here.");
  const normalized = {};
  if (Object.hasOwn(patch, "price")) {
    if (patch.price !== null && (typeof patch.price !== "number" || !Number.isFinite(patch.price) || patch.price <= 0 || patch.price > 10000000)) throw new Error("Enter a positive GHS price, or explicitly clear the price.");
    normalized.price = patch.price == null ? null : Math.round(patch.price * 100) / 100;
  }
  if (Object.hasOwn(patch, "active")) { if (typeof patch.active !== "boolean") throw new Error("Choose Active or Inactive."); normalized.active = patch.active; }
  const classification = ["categoryId", "subcategoryId", "subSubcategoryId"].some((key) => Object.hasOwn(patch, key));
  if (classification) for (const key of ["categoryId", "subcategoryId", "subSubcategoryId"]) {
    const value = patch[key] ?? "";
    if (typeof value !== "string" || value.length > 350 || key === "categoryId" && !value) throw new Error("Choose a valid category hierarchy.");
    normalized[key] = value;
  }
  if (patch.collections !== undefined) {
    const c = patch.collections;
    if (!c || !["add", "remove", "replace"].includes(c.mode) || !Array.isArray(c.values) || c.values.length > 12 || c.values.some((v) => typeof v !== "string" || !v.trim() || v.length > 80)) throw new Error("Choose a collection action and valid collection names.");
    normalized.collections = { mode: c.mode, values: [...new Map(c.values.map((v) => [v.trim().toLowerCase(), v.trim()])).values()].sort() };
  }
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (reason.length < 3 || reason.length > 500) throw new Error("Add an audit reason between 3 and 500 characters.");
  return { ids: [...body.ids].sort(), patch: normalized, reason };
}
export function planBulkProducts(products, request, hierarchy) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const rows = [], warnings = [];
  if (request.patch.categoryId) {
    const c = hierarchy.categories.find((v) => (v.categoryId || v.id) === request.patch.categoryId);
    const sub = hierarchy.subcategories.find((v) => (v.subcategoryId || v.id) === request.patch.subcategoryId);
    const leaf = hierarchy.subSubcategories.find((v) => (v.subSubcategoryId || v.id) === request.patch.subSubcategoryId);
    if (!c || request.patch.subcategoryId && (!sub || sub.categoryId !== request.patch.categoryId) || request.patch.subSubcategoryId && (!sub || !leaf || leaf.categoryId !== request.patch.categoryId || leaf.subcategoryId !== request.patch.subcategoryId)) throw new Error("Choose an existing category and matching children.");
    if (c.active === false || c.archived || sub && (sub.active === false || sub.archived) || leaf && (leaf.active === false || leaf.archived)) warnings.push("The chosen hierarchy is inactive or archived; products will not be available for purchase.");
  }
  for (const id of request.ids) {
    const product = byId.get(id);
    if (!product) throw new Error(`Product ${id} no longer exists. Refresh and select it again.`);
    const patch = { ...request.patch };
    delete patch.collections;
    if (request.patch.categoryId) {
      const c = hierarchy.categories.find((v) => (v.categoryId || v.id) === patch.categoryId);
      const sub = hierarchy.subcategories.find((v) => (v.subcategoryId || v.id) === patch.subcategoryId);
      const leaf = hierarchy.subSubcategories.find((v) => (v.subSubcategoryId || v.id) === patch.subSubcategoryId);
      Object.assign(patch, { category: c.name, subcategory: sub?.name || "", subSubcategory: leaf?.name || "" });
      if (product.productGroupId && deepestCategory(product) !== deepestCategory(patch)) {
        const missing = products.filter((p) => p.productGroupId === product.productGroupId && !request.ids.includes(p.id));
        if (missing.length) throw new Error(`Include every linked variant of ${product.name} before changing its classification: ${missing.map((p) => p.sku || p.id).join(", ")}.`);
      }
    }
    const c = request.patch.collections;
    if (c) {
      const old = Array.isArray(product.collections) ? product.collections : [];
      const requested = new Set(c.values.map((v) => v.toLowerCase()));
      patch.collections = c.mode === "replace" ? c.values : c.mode === "add" ? [...new Map([...old, ...c.values].map((v) => [v.toLowerCase(), v])).values()] : old.filter((v) => !requested.has(v.toLowerCase()));
      if (patch.collections.length > 12) throw new Error(`${product.name} would exceed 12 collections.`);
      if (c.mode === "replace" || requested.has("new arrivals")) patch.newArrival = patch.collections.some((v) => v.toLowerCase() === "new arrivals");
    }
    if (Object.hasOwn(patch, "price") || Object.hasOwn(patch, "active")) patch.sellable = (patch.active ?? product.active) !== false && product.archived !== true && Number(Object.hasOwn(patch, "price") ? patch.price : product.price) > 0;
    if (Object.hasOwn(patch, "price") && patch.price === null) warnings.push(`${product.name}: ${product.contactForPrice ? "keeps its customer quote option" : "will be hidden until priced"}; purchasing is disabled.`);
    if (patch.active === true && product.archived) warnings.push(`${product.name} remains archived. Activation does not unarchive it.`);
    const changes = Object.entries(patch).filter(([field, value]) => !equal(product[field], value)).map(([field, after]) => ({ field, before: product[field] ?? null, after }));
    rows.push({ id, sku: product.sku || id, name: product.name, changes, patch: Object.fromEntries(changes.map(({ field, after }) => [field, after])) });
  }
  return { rows, warnings: [...new Set(warnings)], changedCount: rows.filter((row) => row.changes.length).length };
}
