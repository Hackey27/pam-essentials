import test from "node:test";
import assert from "node:assert/strict";
import { getHeroImageUrl, isHeroImagePath } from "../lib/heroImages.mjs";

test("hero image paths are scoped to desktop or mobile and resized safely", () => {
  assert.equal(isHeroImagePath("hero/web/banner.webp", "web"), true);
  assert.equal(isHeroImagePath("hero/mobile/portrait.jpg", "mobile"), true);
  for (const path of ["hero/web/../secret.jpg", "hero/mobile/portrait.svg", "products/item/gallery/photo.jpg", "hero/web/banner.jpg/other"]) assert.equal(isHeroImagePath(path), false);
  assert.equal(isHeroImagePath("hero/mobile/portrait.jpg", "web"), false);
  assert.equal(getHeroImageUrl("hero/web/banner.webp", 5000), "/images/hero/web/banner.webp?w=2400&fmt=webp&q=82");
});
