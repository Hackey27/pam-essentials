import { variantCombinationKey } from "./productImages.mjs";

export function variantKey(title) {
  const key = String(title || "").trim().toLowerCase().replace(/\s+/g, " ");
  return key === "color" ? "colour" : key;
}

export function deepestCategory(product) {
  return product?.subSubcategoryId || product?.subcategoryId || product?.categoryId || "";
}

export function editorVariantState(product, products = []) {
  const siblings = product?.productGroupId ? products.filter((item) => item.productGroupId === product.productGroupId) : [];
  const members = siblings.length ? siblings : [product];
  const keys = [...new Set(members.flatMap((item) => [
    ...Object.keys(item.variantOptions || {}),
    ...(item.colour ? ["colour"] : []), ...(item.size ? ["size"] : []),
  ]))];
  const variantTitles = Array.isArray(product?.variantTitles) && product.variantTitles.length
    ? product.variantTitles
    : keys.map((title) => ({ title, values: [...new Set(members.map((item) => item.variantOptions?.[variantKey(title)] || item[variantKey(title)]).filter(Boolean))] }));
  return {
    variantEnabled: Boolean(product?.productGroupId || product?.variantEnabled),
    variantTitles,
    variantCombinations: members.filter((item) => item?.id).map((item) => ({
      productId: item.id,
      options: Object.fromEntries(variantTitles.map(({ title }) => [variantKey(title), item.variantOptions?.[variantKey(title)] || item[variantKey(title)] || ""])),
    })),
  };
}

export function planVariantGroup(body, current, products) {
  if (body.variantEnabled !== true) return { enabled: false, groupId: "", members: [], removed: current?.productGroupId ? products.filter((item) => item.productGroupId === current.productGroupId && item.id === current.id) : [] };
  if (body.create) return { error: "Save the new product before assigning variant combinations." };
  const rawTitles = body.variantTitles;
  if (!Array.isArray(rawTitles) || !rawTitles.length || rawTitles.length > 8) return { error: "Add one to eight variant titles." };
  const titles = rawTitles.map((item) => ({ title: String(item?.title || "").trim().slice(0, 60), values: Array.isArray(item?.values) ? [...new Set(item.values.map((value) => String(value || "").trim().slice(0, 80)).filter(Boolean))] : [] }));
  if (titles.some((item) => !item.title || !item.values.length || item.values.length > 40) || new Set(titles.map((item) => variantKey(item.title))).size !== titles.length) return { error: "Give each variant title a unique name and at least one value." };
  const rows = body.variantCombinations;
  if (!Array.isArray(rows) || !rows.length || rows.length > 60) return { error: "Add a combination for this product and any linked products." };
  const byId = new Map(products.map((item) => [item.id, item]));
  const ids = new Set(), tuples = new Set(), members = [];
  const groupId = current?.productGroupId || `ADMIN-${current.id}`;
  for (const row of rows) {
    const productId = String(row?.productId || "").trim();
    const product = byId.get(productId);
    if (!product || ids.has(productId)) return { error: "Each combination must select a different saved product." };
    if (product.productGroupId && product.productGroupId !== groupId) return { error: `${product.name} already belongs to another variant group.` };
    if (deepestCategory(product) !== deepestCategory(current)) return { error: `${product.name} must be in the same final category as this product.` };
    const options = {};
    for (const item of titles) {
      const key = variantKey(item.title);
      const value = String(row.options?.[key] || "").trim();
      if (!item.values.includes(value)) return { error: `Choose a valid ${item.title} for ${product.name}.` };
      options[key] = value;
    }
    const tuple = JSON.stringify(Object.entries(options).sort(([a], [b]) => a.localeCompare(b)));
    if (tuples.has(tuple)) return { error: "Two products cannot share the same variant combination." };
    ids.add(productId); tuples.add(tuple); members.push({ product, options });
  }
  if (!ids.has(current.id)) return { error: "Include the product being edited in its combinations." };
  const removed = products.filter((item) => item.productGroupId === groupId && !ids.has(item.id));
  return { enabled: true, groupId, titles, members, removed };
}

export function remapVariantImages(plan, existingMap = {}) {
  const mapped = { ...existingMap };
  for (const member of plan.members || []) {
    const oldKey = variantCombinationKey(member.product);
    const newKey = variantCombinationKey({ ...member.product, colour: member.options.colour || "", size: member.options.size || "", variantOptions: member.options });
    const image = member.product.variantImages?.[oldKey] || existingMap[oldKey];
    if (oldKey && newKey && image && !mapped[newKey]) mapped[newKey] = image;
  }
  return mapped;
}
