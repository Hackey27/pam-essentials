import test from "node:test";
import assert from "node:assert/strict";
import { boundedZoom, clampZoom, gallerySwipe, pinchZoom } from "../lib/galleryGestures.mjs";
test("gallery zoom bounds and reset keep an image reachable on narrow mobile viewports", () => {
  assert.equal(clampZoom(9), 4); assert.equal(clampZoom(.3), 1);
  assert.deepEqual(boundedZoom({ scale: 1, x: 50, y: -90 }, 300, 600), { scale: 1, x: 0, y: 0 });
  assert.deepEqual(boundedZoom({ scale: 2, x: 900, y: -900 }, 300, 600), { scale: 2, x: 150, y: -300 });
});
test("pinching doubles scale around the touched point and follows the moving midpoint", () => {
  const origin = { zoom: { scale: 1, x: 0, y: 0 }, midpoint: { x: 120, y: 230 }, distance: 100 };
  assert.deepEqual(pinchZoom(origin, { x: 130, y: 240 }, 200, { x: 100, y: 200 }), { scale: 2, x: -10, y: -20 });
});
test("swiping advances either way at base zoom, never during a pinch, vertical scroll or enlarged pan", () => {
  assert.equal(gallerySwipe(-100, 10, 1), 1); assert.equal(gallerySwipe(100, 10, 1), -1);
  for (const values of [[100,10,2], [100,10,1,true], [10,100,1], [20,0,1]]) assert.equal(gallerySwipe(...values), 0);
});
