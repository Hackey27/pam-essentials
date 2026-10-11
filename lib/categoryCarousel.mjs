import { cardImageSource, getProductImageUrl, productGallery } from "./productImages.mjs";

export const CATEGORY_HOLD_MS = 6000;
export const PHOTO_HOLD_MS = 2000;
export const CATEGORY_MOVE_MS = 850;
export const PHOTO_MOVE_MS = 650;

export function carouselCategories(categories, products) {
  return categories.filter((category) => category.active !== false && !category.archived)
    .sort((a, b) => Number(a.sortOrder ?? 999999) - Number(b.sortOrder ?? 999999) || a.name.localeCompare(b.name))
    .map((category) => {
      const id = category.categoryId || category.id;
      const items = products.filter((product) => product.categoryId ? product.categoryId === id : product.category === category.name);
      const photos = [];
      const addPhoto = (source, name) => {
        const url = source.path ? getProductImageUrl(source.path, 480) : source.url;
        if (url && !photos.some((photo) => photo.url === url)) photos.push({ url, name });
      };
      for (const product of [...items].sort((a, b) => a.name.localeCompare(b.name))) {
        addPhoto(cardImageSource(product), product.name);
        for (const image of productGallery(product)) addPhoto(image.source, product.name);
      }
      return { id, name: category.name, count: items.length, photos };
    }).filter((category) => category.count > 0);
}

