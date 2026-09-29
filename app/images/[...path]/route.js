import { NextResponse } from "next/server";
import { Storage } from "@google-cloud/storage";
import sharp from "sharp";
import { isProductImagePath } from "@/lib/productImages.mjs";

export const runtime = "nodejs";
const storage = new Storage();
const bucketName = process.env.STORAGE_BUCKET_NAME || "pam-essentials-2d7fb.firebasestorage.app";
const cacheControl = "public, max-age=31536000, s-maxage=31536000, immutable";

function requestOptions(searchParams) {
  const width = Number(searchParams.get("w") || 1000);
  const quality = Number(searchParams.get("q") || 80);
  const format = searchParams.get("fmt") || "webp";
  if (!Number.isInteger(width) || width < 1 || width > 2400 || !Number.isInteger(quality) || quality < 40 || quality > 95 || !["webp", "avif"].includes(format)) return null;
  return { width, quality, format };
}

export async function GET(request, { params }) {
  const path = (await params).path.join("/");
  const options = requestOptions(new URL(request.url).searchParams);
  if (!isProductImagePath(path) || !options) return NextResponse.json({ error: "Invalid image request." }, { status: 400 });
  try {
    const object = storage.bucket(bucketName).file(path);
    const [metadata] = await object.getMetadata();
    const size = Number(metadata.size);
    if (!/^image\/(jpeg|png|webp|avif)$/.test(metadata.contentType || "") || !Number.isFinite(size) || size <= 0 || size > 20 * 1024 * 1024) return NextResponse.json({ error: "Image unavailable." }, { status: 404 });
    const [original] = await object.download();
    const transformed = await sharp(original, { limitInputPixels: 40_000_000, failOn: "error" })
      .rotate().resize({ width: options.width, withoutEnlargement: true })
      .toFormat(options.format, { quality: options.quality }).toBuffer();
    return new Response(transformed, { headers: { "content-type": `image/${options.format}`, "cache-control": cacheControl, "x-content-type-options": "nosniff", vary: "Accept" } });
  } catch (error) {
    if (error?.code === 404) return NextResponse.json({ error: "Image not found." }, { status: 404 });
    console.error("Image resize failed", { path, error });
    return NextResponse.json({ error: "Image unavailable." }, { status: 503 });
  }
}
