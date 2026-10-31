import test from "node:test";
import assert from "node:assert/strict";
import { cardImageSource, detailImageSource, galleryImagePaths, getProductImageUrl, isProductImagePath, productImageFolder, productGallery, variantCombinationKey, productImageSrcSet } from "../lib/productImages.mjs";

test("image paths stay inside the product image namespace", () => {
  const folder = productImageFolder("SKU 123");
  assert.match(folder, /^sku-123-[a-z0-9]+$/);
  assert.equal(isProductImagePath(`products/${folder}/gallery/photo.jpg`), true);
  for (const path of ["products/sku/../../secret.jpg", "users/uid/avatar.jpg", "products/sku/gallery/photo.svg", "products/sku/gallery/photo.jpg/other"]) assert.equal(isProductImagePath(path), false);
  assert.equal(getProductImageUrl(`products/${folder}/gallery/photo.jpg`, 500), `/images/products/${folder}/gallery/photo.jpg?w=640&fmt=webp&q=85`);
});

test("responsive product images offer valid stored sizes and leave legacy URLs alone", () => {
  const path = "products/test/card-preview/photo.png";
  for (const [width, expected] of [[80, [160]], [100, [160, 320]], [350, [160, 320, 640, 960]], [1000, [160, 320, 640, 960, 1600]]]) {
    const candidates = productImageSrcSet(path, width).split(", ");
    assert.deepEqual(candidates.map((candidate) => Number(candidate.match(/ (\d+)w$/)[1])), expected);
    assert.ok(candidates.every((candidate) => candidate.startsWith(`/images/${path}?`) && candidate.includes("&fmt=webp&q=85")));
  }
  assert.equal(productImageSrcSet("https://example.test/legacy.jpg"), undefined);
  assert.equal(productImageSrcSet("products/test/../../private.png"), undefined);
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

test("product routes resolve escaped slashes and preserve exact public identities", async () => {
  const { resolveStorefrontProduct } = await import("../lib/productRouting.mjs");
  const wipes = { id: "MIN-WIP-BL/P-004", sku: "MIN-WIP-BL/P-004", name: "Mini wet wipes" };
  const renamed = { id: "OLD-ID", sku: "CURRENT-SKU" };
  const products = [wipes, renamed];
  const before = JSON.stringify(products);
  for (const route of [wipes.id, encodeURIComponent(wipes.id), encodeURIComponent(encodeURIComponent(wipes.id))]) assert.equal(resolveStorefrontProduct(products, route), wipes);
  assert.equal(resolveStorefrontProduct(products, "CURRENT-SKU"), renamed);
  assert.equal(resolveStorefrontProduct(products, "OLD-ID"), renamed);
  assert.equal(JSON.stringify(products), before);
});

test("route lookup never exposes missing products or confuses literal percent identifiers", async () => {
  const { resolveStorefrontProduct, productRouteCandidates } = await import("../lib/productRouting.mjs");
  const slash = { id: "A/B", sku: "SLASH" }, percent = { id: "A%2FB", sku: "PERCENT" };
  assert.equal(resolveStorefrontProduct([slash, percent], "A%2FB"), percent);
  assert.equal(resolveStorefrontProduct([slash, percent], "A%252FB"), percent);
  assert.equal(resolveStorefrontProduct([slash], "A%2FB"), slash);
  for (const value of [undefined, null, "", ["A", "B"], "DELETED-SKU", "%malformed"]) assert.equal(resolveStorefrontProduct([slash], value), null);
  assert.deepEqual(productRouteCandidates("%malformed"), ["%malformed"]);
});
