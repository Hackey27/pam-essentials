export const clampZoom = (scale) => Math.max(1, Math.min(4, Number(scale) || 1));
export function boundedZoom(value, width, height) {
  const scale = clampZoom(value.scale), maxX = Math.max(0, width * (scale - 1) / 2), maxY = Math.max(0, height * (scale - 1) / 2);
  return { scale, x: Math.max(-maxX, Math.min(maxX, Number(value.x) || 0)) || 0, y: Math.max(-maxY, Math.min(maxY, Number(value.y) || 0)) || 0 };
}
export function pinchZoom(origin, midpoint, distance, centre) {
  const scale = clampZoom(origin.zoom.scale * distance / Math.max(1, origin.distance)), ratio = scale / origin.zoom.scale;
  return { scale, x: midpoint.x - centre.x - (origin.midpoint.x - centre.x - origin.zoom.x) * ratio, y: midpoint.y - centre.y - (origin.midpoint.y - centre.y - origin.zoom.y) * ratio };
}
export function gallerySwipe(dx, dy, scale, multiple = false) { return !multiple && scale === 1 && Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) ? dx < 0 ? 1 : -1 : 0; }
