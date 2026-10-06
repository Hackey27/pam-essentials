import test from "node:test";
import assert from "node:assert/strict";
import { cardImageSource, detailImageSource, galleryImagePaths, getProductImageUrl, isProductImagePath, productImageFolder, productGallery, variantCombinationKey } from "../lib/productImages.mjs";

test("image paths stay inside the product image namespace", () => {
  const folder = productImageFolder("SKU 123");
  assert.match(folder, /^sku-123-[a-z0-9]+$/);
  assert.equal(isProductImagePath(`products/${folder}/gallery/photo.jpg`), true);
  for (const path of ["products/sku/../../secret.jpg", "users/uid/avatar.jpg", "products/sku/gallery/photo.svg", "products/sku/gallery/photo.jpg/other"]) assert.equal(isProductImagePath(path), false);
  assert.equal(getProductImageUrl(`products/${folder}/gallery/photo.jpg`, 500), `/images/products/${folder}/gallery/photo.jpg?w=500&fmt=webp&q=80`);
});

test("variant combinations and image precedence are deterministic", () => {
  const red = { id: "red", size: "Medium", colour: "Red", imageUrl: "https://legacy.example/red.jpg" };
  const blue = { id: "blue", size: "Medium", colour: "Blue", imageUrl: "https://legacy.example/blue.jpg" };
  assert.equal(variantCombinationKey(red), "colour=Red|size=Medium");
  const product = { ...red, cardPreviewImagePath: "products/red/card-preview/card.jpg", galleryImagePaths: ["products/red/gallery/general.jpg"], variantImages: { [variantCombinationKey(blue)]: { imagePath: "products/red/variants/blue/main/main.jpg", galleryImagePaths: ["products/red/variants/blue/gallery/side.jpg"] } } };
  assert.equal(cardImageSource(product).path, product.cardPreviewImagePath);
  assert.equal(detailImageSource(product, blue).path, product.variantImages[variantCombinationKey(blue)].imagePath);
  assert.deepEqual(galleryImagePaths(product, blue), product.variantImages[variantCombinationKey(blue)].galleryImagePaths);
  assert.equal(detailImageSource({ ...red, imageUrl: red.imageUrl }, red).url, red.imageUrl);
  assert.equal(detailImageSource(product, { ...blue, cardPreviewImagePath: "products/blue/card-preview/blue.jpg" }).path, product.variantImages[variantCombinationKey(blue)].imagePath);
  assert.equal(detailImageSource(red, { ...blue, cardPreviewImagePath: "products/blue/card-preview/blue.jpg" }).path, "products/blue/card-preview/blue.jpg");
  assert.equal(detailImageSource(product, { ...blue, imageUrl: "https://legacy.example/blue.jpg", variantImages: {} }).path, product.variantImages[variantCombinationKey(blue)].imagePath);
  assert.equal(detailImageSource({ ...red, cardPreviewImagePath: "products/red/card-preview/card.jpg" }, blue).url, blue.imageUrl);
});

test("inline galleries deduplicate images and honor the chosen variant's gallery", () => {
  const origin = { id: "A", colour: "Red", cardPreviewImagePath: "products/red/card-preview/main.jpg", galleryImagePaths: ["products/red/gallery/side.jpg"] };
  const blue = { id: "B", colour: "Blue", cardPreviewImagePath: "products/blue/card-preview/main.jpg", galleryImagePaths: ["products/blue/card-preview/main.jpg", "products/blue/gallery/side.jpg"] };
  const images = productGallery(origin, blue, [origin, blue]);
  assert.deepEqual(images.map((item) => item.source.path), [blue.cardPreviewImagePath, blue.galleryImagePaths[1]]);
  assert.equal(images.some((item) => item.source.path.includes("red")), false);
  assert.equal(productGallery({}).length, 0);
});

test("legacy galleries remain usable without requiring new image fields", () => {
  const product = { id: "A", imageUrl: "https://example.test/main.jpg", images: ["https://example.test/main.jpg", "https://example.test/side.jpg", "javascript:invalid"] };
  assert.deepEqual(productGallery(product).map((item) => item.source.url), [product.imageUrl, product.images[1]]);
  assert.equal(productGallery({ imageUrl: product.imageUrl, images: "not-an-array" }).length, 1);
});
