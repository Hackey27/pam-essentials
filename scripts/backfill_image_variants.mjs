import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldPath } from "firebase-admin/firestore";
import { Storage } from "@google-cloud/storage";
import { isProductImagePath } from "../lib/productImages.mjs";
import { isHeroImagePath } from "../lib/heroImages.mjs";
import { writeImageVariants } from "../lib/imageVariantStorage.js";

const projectId = "pam-essentials-2d7fb";
if (process.env.GOOGLE_CLOUD_PROJECT !== projectId || !process.argv.includes(`--confirm=${projectId}`)) {
  throw new Error(`Set GOOGLE_CLOUD_PROJECT and pass --confirm=${projectId} to run this one-off image backfill.`);
}
initializeApp({ projectId });
const store = getFirestore();
const bucket = new Storage({ projectId }).bucket(process.env.STORAGE_BUCKET_NAME || `${projectId}.firebasestorage.app`);

function collectPaths(record, paths) {
  if (typeof record === "string" && (isProductImagePath(record) || isHeroImagePath(record))) paths.add(record);
  else if (Array.isArray(record)) record.forEach((entry) => collectPaths(entry, paths));
  else if (record && typeof record === "object") Object.values(record).forEach((entry) => collectPaths(entry, paths));
}

async function imageInventory() {
  const cards = new Set(), other = new Set();
  let cursor;
  do {
    let query = store.collection("products").select("cardPreviewImagePath", "galleryImagePaths", "masterImagePath", "variantImages")
      .orderBy(FieldPath.documentId()).limit(25);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    page.docs.forEach((doc) => { collectPaths(doc.data().cardPreviewImagePath, cards); collectPaths(doc.data(), other); });
    cursor = page.size === 25 ? page.docs.at(-1).id : null;
  } while (cursor);
  const settings = await store.getAll(...["HERO_WEB_IMAGE_PATH", "HERO_MOBILE_IMAGE_PATH", "HERO_WEB_IMAGES", "HERO_MOBILE_IMAGES"].map((key) => store.collection("settings").doc(key)));
  settings.forEach((doc) => collectPaths(doc.data(), other));
  return [...new Set([...cards, ...other])];
}

async function generateMissingVariants(path) {
  const [ready] = await bucket.file(`image-variants/v1/${path}/ready.json`).exists();
  if (ready) return "already-ready";
  const original = bucket.file(path);
  const [metadata] = await original.getMetadata();
  const size = Number(metadata.size);
  if (!/^image\/(jpeg|png|webp|avif)$/.test(metadata.contentType || "") || !Number.isFinite(size) || size <= 0 || size > 20 * 1024 * 1024) {
    throw new Error("Unsupported or oversized original image");
  }
  const [bytes] = await original.download();
  await writeImageVariants(bucket, path, bytes);
  return "generated";
}

const paths = await imageInventory();
const counts = { total: paths.length, generated: 0, ready: 0, failed: 0 };
console.log(JSON.stringify({ event: "image-backfill-started", projectId, total: paths.length }));
for (const [index, path] of paths.entries()) {
  const started = Date.now();
  try {
    const status = await generateMissingVariants(path);
    counts[status === "generated" ? "generated" : "ready"]++;
    console.log(JSON.stringify({ event: "image-backfill-progress", index: index + 1, total: paths.length, path, status, ms: Date.now() - started }));
  } catch (error) {
    counts.failed++;
    console.error(JSON.stringify({ event: "image-backfill-failed", path, code: error.code, message: error.message }));
  }
}
console.log(JSON.stringify({ event: "image-backfill-complete", ...counts }));
if (counts.failed) process.exitCode = 1;
