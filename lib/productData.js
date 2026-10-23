import { stockUnit,retailEnabled } from "./stockUnits.mjs";
import { availableStock } from "./reservations.mjs";
import { wholesaleSettings } from "./wholesale.mjs";
import { productSearchKeywords } from "./productSearch.mjs";
import { hasSellingPrice } from "./productPricing.mjs";

export function publicProduct(product) {
  return {
    id: product.id,
    name: product.name,
    description: product.description || "",
    productType: typeof product.productType === "string" ? product.productType.trim().slice(0, 80) : "",
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
    capacity: typeof product.capacity === "string" || typeof product.capacity === "number" ? String(product.capacity).slice(0,120) : "",
    storage: product.storage || "",
    version: product.version || "",
    duration: product.duration || "",
    platform: product.platform || "",
    keywords: productSearchKeywords(product),
    collections: product.collections || [],
    newArrival: product.newArrival === true,
    bestSeller: Number(product.purchaseCount || 0) >= 3,
    clickCount: Number(product.clickCount || 0),
    purchaseCount: Number(product.purchaseCount || 0),
    rating: Number(product.rating || 0),
    price: Number(product.price || 0),
    wholesale: wholesaleSettings(product).enabled ? wholesaleSettings(product) : { enabled: false },
    contactForPrice: product.contactForPrice === true,
    taxExempt: product.taxExempt === true,
    stock: availableStock(product),
    retailUnit: stockUnit(product),
    retailEnabled: retailEnabled(product),
    lowStockLevel: Number(product.lowStockLevel ?? 8),
    imageUrl: product.imageUrl || "",
    images: Array.isArray(product.images) ? product.images.filter((url) => typeof url === "string" && /^https?:\/\//i.test(url)) : [],
    cardPreviewImagePath: product.cardPreviewImagePath || "",
    galleryImagePaths: product.galleryImagePaths || [],
    masterImagePath: product.masterImagePath || "",
    variantImages: product.variantImages || {},
    createdAt: product.createdAt || null,
    pinned: Boolean(product.pinned),
    randomShapes: product.randomShapes === true,
    randomSizes: product.randomSizes === true,
    randomColours: product.randomColours === true || /\brandom\b[^.]{0,60}\bcolou?rs\b/i.test(product.name || ""),
  };
}

export function isSellable(product) {
  return retailEnabled(product) && product.active !== false && product.archived !== true && hasSellingPrice(product);
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

