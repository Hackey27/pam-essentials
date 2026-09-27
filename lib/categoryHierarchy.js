import { serializeDoc } from "@/lib/productData";

export function sortHierarchy(items) {
  return items.sort((a, b) =>
    Number(a.sortOrder ?? 999999) - Number(b.sortOrder ?? 999999) ||
    a.name.localeCompare(b.name)
  );
}

export async function loadHierarchy(store) {
  const [categorySnap, subcategorySnap, subSubcategorySnap] = await Promise.all([
    store.collection("categories").get(),
    store.collection("subcategories").get(),
    store.collection("sub_subcategories").get(),
  ]);
  const categories = sortHierarchy(categorySnap.docs.map(serializeDoc).map((item) => ({ ...item, categoryId: item.categoryId || item.id })));
  const subcategories = sortHierarchy(subcategorySnap.docs.map(serializeDoc).map((item) => ({ ...item, subcategoryId: item.subcategoryId || item.id })));
  const subSubcategories = sortHierarchy(subSubcategorySnap.docs.map(serializeDoc).map((item) => ({ ...item, subSubcategoryId: item.subSubcategoryId || item.id })));
  const categoryOrder = new Map(categories.map((item, index) => [item.categoryId || item.id, index]));
  subcategories.sort((a, b) =>
    (categoryOrder.get(a.categoryId) ?? 999999) - (categoryOrder.get(b.categoryId) ?? 999999) ||
    Number(a.sortOrder ?? 999999) - Number(b.sortOrder ?? 999999) || a.name.localeCompare(b.name)
  );
  const subcategoryOrder = new Map(subcategories.map((item, index) => [item.subcategoryId || item.id, index]));
  subSubcategories.sort((a, b) =>
    (subcategoryOrder.get(a.subcategoryId) ?? 999999) - (subcategoryOrder.get(b.subcategoryId) ?? 999999) ||
    Number(a.sortOrder ?? 999999) - Number(b.sortOrder ?? 999999) || a.name.localeCompare(b.name)
  );
  return { categories, subcategories, subSubcategories };
}

export function activeHierarchy(hierarchy) {
  const categories = hierarchy.categories.filter((item) => item.active !== false && !item.archived);
  const categoryIds = new Set(categories.map((item) => item.categoryId || item.id));
  const subcategories = hierarchy.subcategories.filter((item) => categoryIds.has(item.categoryId) && item.active !== false && !item.archived);
  const subcategoryIds = new Set(subcategories.map((item) => item.subcategoryId || item.id));
  const subSubcategories = hierarchy.subSubcategories.filter((item) => subcategoryIds.has(item.subcategoryId) && item.active !== false && !item.archived);
  return { categories, subcategories, subSubcategories };
}

export function productInActiveHierarchy(product, hierarchy) {
  const category = hierarchy.categories.find((item) => (item.categoryId || item.id) === product.categoryId);
  if (!category) return false;
  if (product.subcategoryId && hierarchy.subcategories.some((item) => (item.subcategoryId || item.id) === product.subcategoryId)) {
    if (!hierarchy.subcategories.some((item) => (item.subcategoryId || item.id) === product.subcategoryId && item.active !== false && !item.archived && item.categoryId === product.categoryId)) return false;
  }
  if (product.subSubcategoryId && hierarchy.subSubcategories.some((item) => (item.subSubcategoryId || item.id) === product.subSubcategoryId)) {
    if (!hierarchy.subSubcategories.some((item) => (item.subSubcategoryId || item.id) === product.subSubcategoryId && item.active !== false && !item.archived && item.subcategoryId === product.subcategoryId)) return false;
  }
  return true;
}

export function categoryLabels(product, hierarchy) {
  const category = hierarchy.categories.find((item) => (item.categoryId || item.id) === product.categoryId);
  const subcategory = hierarchy.subcategories.find((item) => (item.subcategoryId || item.id) === product.subcategoryId);
  const subSubcategory = hierarchy.subSubcategories.find((item) => (item.subSubcategoryId || item.id) === product.subSubcategoryId);
  return {
    category: category?.name || product.category,
    subcategory: subcategory?.name || product.subcategory || "",
    subSubcategory: subSubcategory?.name || product.subSubcategory || "",
  };
}

