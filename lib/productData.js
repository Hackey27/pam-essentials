export function publicProduct(product) {
  return {
    id: product.id,
    name: product.name,
    description: product.description || "",
    category: product.category,
    categoryId: product.categoryId,
    subcategory: product.subcategory || "",
    subcategoryId: product.subcategoryId || "",
    subSubcategory: product.subSubcategory || "",
    subSubcategoryId: product.subSubcategoryId || "",
    productGroupId: product.productGroupId || "",
    colour: product.colour || "",
    size: product.size || "",
    keywords: product.keywords || [],
    collections: product.collections || [],
    newArrival: product.newArrival === true,
    bestSeller: Number(product.purchaseCount || 0) >= 3,
    price: Number(product.price || 0),
    stock: Number(product.stock || 0),
    lowStockLevel: Number(product.lowStockLevel ?? 8),
    imageUrl: product.imageUrl || "",
    createdAt: product.createdAt || null,
    pinned: Boolean(product.pinned),
  };
}

export function isSellable(product) {
  return product.active !== false && product.archived !== true && Number(product.price) > 0;
}

export function serializeDoc(doc) {
  const data = doc.data();
  return {
    ...data,
    id: data.id || doc.id,
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt || null,
    updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.updatedAt || null,
  };
}

