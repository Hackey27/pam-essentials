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
    variantId: product.productGroupId ? product.id : "",
    colour: product.colour || "",
    size: product.size || "",
    variantOptions: product.variantOptions || {},
    variantTitles: product.variantTitles || [],
    sku: product.sku || product.id,
    material: product.material || "",
    storage: product.storage || "",
    version: product.version || "",
    duration: product.duration || "",
    platform: product.platform || "",
    keywords: product.keywords || [],
    collections: product.collections || [],
    newArrival: product.newArrival === true,
    bestSeller: Number(product.purchaseCount || 0) >= 3,
    clickCount: Number(product.clickCount || 0),
    purchaseCount: Number(product.purchaseCount || 0),
    rating: Number(product.rating || 0),
    price: Number(product.price || 0),
    stock: Number(product.stock || 0),
    lowStockLevel: Number(product.lowStockLevel ?? 8),
    imageUrl: product.imageUrl || "",
    cardPreviewImagePath: product.cardPreviewImagePath || "",
    galleryImagePaths: product.galleryImagePaths || [],
    masterImagePath: product.masterImagePath || "",
    variantImages: product.variantImages || {},
    createdAt: product.createdAt || null,
    pinned: Boolean(product.pinned),
    randomColours: product.randomColours === true || /\brandom\b[^.]{0,60}\bcolou?rs\b/i.test(product.name || ""),
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

