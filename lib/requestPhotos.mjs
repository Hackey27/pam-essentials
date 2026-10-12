import sharp from "sharp";
import { optimizedPhotoBytes, requestPhotoBytes, requestPhotoTypes } from "./productRequests.mjs";

export async function prepareRequestPhoto(file) {
  if (!file || typeof file.arrayBuffer !== "function" || !requestPhotoTypes.includes(file.type) || !file.size || file.size > requestPhotoBytes) throw new Error("Use JPG, PNG or WebP photos, up to 5 MB each.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const expected = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" }[file.type];
  let metadata, optimized;
  try {
    metadata = await sharp(bytes, { limitInputPixels: 25_000_000 }).metadata();
    if (metadata.format !== expected || !metadata.width || !metadata.height) throw new Error();
    optimized = await sharp(bytes, { limitInputPixels: 25_000_000 }).rotate().resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true }).webp({ quality: 75 }).toBuffer();
    if (optimized.length > optimizedPhotoBytes) optimized = await sharp(bytes, { limitInputPixels: 25_000_000 }).rotate().resize({ width: 800, height: 800, fit: "inside", withoutEnlargement: true }).webp({ quality: 65 }).toBuffer();
  } catch { throw new Error("One photo could not be read. Choose a valid JPG, PNG or WebP photo."); }
  if (optimized.length > optimizedPhotoBytes) throw new Error("One photo is too complex. Use a smaller photo.");
  // New WebP output omits the original location/EXIF metadata.
  return { base64: optimized.toString("base64"), contentType: "image/webp", bytes: optimized.length };
}
