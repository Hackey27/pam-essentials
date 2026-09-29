import { Storage } from "@google-cloud/storage";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { requireRole } from "@/lib/admin";
import { isHeroImagePath } from "@/lib/heroImages.mjs";

export const runtime = "nodejs";
const storage = new Storage();
const bucketName = process.env.STORAGE_BUCKET_NAME || "pam-essentials-2d7fb.firebasestorage.app";
const maxBytes = 20 * 1024 * 1024;
const types = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp", "image/avif": "heif" };

function matchesSignature(bytes, type) {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (type === "image/webp") return bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (type === "image/avif") return bytes.toString("ascii", 4, 8) === "ftyp" && ["avif", "avis"].includes(bytes.toString("ascii", 8, 12));
  return false;
}

export async function POST(request) {
  const access = await requireRole(request, ["owner", "admin"]);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  const slot = request.headers.get("x-hero-slot") || "";
  const path = request.headers.get("x-image-path") || "";
  const type = (request.headers.get("content-type") || "").split(";")[0].toLowerCase();
  const length = Number(request.headers.get("content-length") || 0);
  if (!["web", "mobile"].includes(slot) || !isHeroImagePath(path, slot) || !types[type]) return NextResponse.json({ error: "Invalid hero image request." }, { status: 400 });
  if (length > maxBytes) return NextResponse.json({ error: "Images must be smaller than 20 MB." }, { status: 413 });
  const bytes = Buffer.from(await request.arrayBuffer());
  if (!bytes.length || bytes.length > maxBytes) return NextResponse.json({ error: "Images must be smaller than 20 MB." }, { status: 413 });
  if (!matchesSignature(bytes, type)) return NextResponse.json({ error: "The file contents do not match the selected image type." }, { status: 400 });
  try {
    const metadata = await sharp(bytes, { limitInputPixels: 40_000_000, failOn: "error" }).metadata();
    if (metadata.format !== types[type] || !metadata.width || !metadata.height || metadata.width * metadata.height > 40_000_000) return NextResponse.json({ error: "Choose a valid JPG, PNG, WebP or AVIF image under 40 megapixels." }, { status: 400 });
    await storage.bucket(bucketName).file(path).save(bytes, { resumable: false, preconditionOpts: { ifGenerationMatch: 0 }, metadata: { contentType: type, cacheControl: "public,max-age=31536000,immutable" } });
    return NextResponse.json({ path, width: metadata.width, height: metadata.height });
  } catch (error) {
    if ([401, 403].includes(error?.code)) return NextResponse.json({ error: "Image storage rejected the server. Grant the Cloud Run service account Storage Object Creator on the image bucket." }, { status: 503 });
    if (error?.code === 404) return NextResponse.json({ error: "The configured image bucket was not found." }, { status: 503 });
    if (error?.code === 412) return NextResponse.json({ error: "That image already exists. Try uploading again." }, { status: 409 });
    console.error("Admin hero image upload failed", { path, code: error?.code, error });
    return NextResponse.json({ error: "Hero image upload failed on the server." }, { status: 503 });
  }
}
