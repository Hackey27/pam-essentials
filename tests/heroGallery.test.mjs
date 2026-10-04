import test from "node:test";
import assert from "node:assert/strict";
import { heroImageList, validHeroImageList } from "../lib/heroGallery.mjs";

test("ordered hero galleries preserve legacy fallback and screen size", () => {
  const oldPath = "hero/web/legacy.webp";
  assert.deepEqual(heroImageList({ HERO_WEB_IMAGE_PATH: { value: oldPath } }, "web"), [{ path: oldPath, sortOrder: 0, active: true }]);
  const gallery = [{ path: "hero/web/second.webp", sortOrder: 2, active: true }, { path: "hero/web/first.webp", sortOrder: 1, active: false }];
  assert.deepEqual(heroImageList({ HERO_WEB_IMAGE_PATH: { value: oldPath }, HERO_WEB_IMAGES: { value: gallery } }, "web").map((item) => item.path), ["hero/web/first.webp", "hero/web/second.webp"]);
  assert.deepEqual(heroImageList({ HERO_WEB_IMAGE_PATH: { value: oldPath }, HERO_WEB_IMAGES: { value: [] } }, "web"), []);
  assert.equal(validHeroImageList(gallery, "web"), true);
  assert.equal(validHeroImageList([{ path: "hero/mobile/wrong.webp", sortOrder: 1, active: true }], "web"), false);
  assert.equal(validHeroImageList([{ ...gallery[0] }, { ...gallery[0] }], "web"), false);
});
