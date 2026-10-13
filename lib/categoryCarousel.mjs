import { cardImageSource, getProductImageUrl, productGallery } from "./productImages.mjs";

export const CATEGORY_HOLD_MS = 6000;
export const PHOTO_HOLD_MS = 2000;
export const CATEGORY_MOVE_MS = 850;
export const PHOTO_MOVE_MS = 650;
export const CATEGORY_MANUAL_MOVE_MS = 300;

// Only horizontal gestures browse categories; vertical wheels keep scrolling the page.
export function categoryWheelDelta(event, viewportWidth = 800) {
  if (event.ctrlKey) return 0;
  const x = Number(event.deltaX) || 0, y = Number(event.deltaY) || 0;
  if (!event.shiftKey && Math.abs(x) <= Math.abs(y)) return 0;
  const delta = event.shiftKey && Math.abs(y) > Math.abs(x) ? y : x;
  return delta * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewportWidth : 1);
}

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


export function isCarouselCaptureLoss(event) { return event.target === event.currentTarget; }
