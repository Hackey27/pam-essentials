import { Storage } from "@google-cloud/storage";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { adminDb, requireRole } from "@/lib/admin";
import { isProductImagePath, productImageFolder } from "@/lib/productImages.mjs";

export const runtime = "nodejs";
const storage = new Storage();
const bucketName = process.env.STORAGE_BUCKET_NAME || "pam-essentials-2d7fb.firebasestorage.app";
const maxBytes = 20 * 1024 * 1024;
const types = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp", "image/avif": "heif" };

function matchesSignature(bytes, contentType) {
  if (contentType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (contentType === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (contentType === "image/webp") return bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (contentType === "image/avif") return bytes.toString("ascii", 4, 8) === "ftyp" && ["avif", "avis"].includes(bytes.toString("ascii", 8, 12));
  return false;
}

export async function POST(request) {
  const access = await requireRole(request, ["owner", "admin"]);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });

  const productId = request.headers.get("x-product-id") || "";
  const path = request.headers.get("x-image-path") || "";
  const contentType = (request.headers.get("content-type") || "").split(";")[0].toLowerCase();
  const length = Number(request.headers.get("content-length") || 0);
  if (!productId || productId.length > 80 || !isProductImagePath(path) || !path.startsWith(`products/${productImageFolder(productId)}/`) || !types[contentType]) {
    return NextResponse.json({ error: "Invalid product image request." }, { status: 400 });
  }
  if (length > maxBytes) return NextResponse.json({ error: "Images must be smaller than 20 MB." }, { status: 413 });

  const product = await adminDb().collection("products").doc(encodeURIComponent(productId)).get();
  if (!product.exists) return NextResponse.json({ error: "Save the product before uploading images." }, { status: 404 });

  const bytes = Buffer.from(await request.arrayBuffer());
  if (!bytes.length || bytes.length > maxBytes) return NextResponse.json({ error: "Images must be smaller than 20 MB." }, { status: 413 });
  if (!matchesSignature(bytes, contentType)) return NextResponse.json({ error: "The file contents do not match the selected image type." }, { status: 400 });
  try {
    const metadata = await sharp(bytes, { limitInputPixels: 40_000_000, failOn: "error" }).metadata();
    if (metadata.format !== types[contentType] || !metadata.width || !metadata.height || metadata.width * metadata.height > 40_000_000) {
      return NextResponse.json({ error: "The file contents do not match a supported image type." }, { status: 400 });
    }
    await storage.bucket(bucketName).file(path).save(bytes, {
      resumable: false,
      preconditionOpts: { ifGenerationMatch: 0 },
      metadata: { contentType, cacheControl: "public,max-age=31536000,immutable" },
    });
    return NextResponse.json({ path });
  } catch (error) {
    if (error?.code === 403 || error?.code === 401) return NextResponse.json({ error: "Image storage rejected the server. Grant the Cloud Run service account Storage Object Creator on the product image bucket." }, { status: 503 });
    if (error?.code === 404) return NextResponse.json({ error: "The configured image bucket was not found." }, { status: 503 });
    if (error?.code === 412) return NextResponse.json({ error: "That image already exists. Try uploading it again." }, { status: 409 });
    if (error?.name === "Error" && /unsupported|Input buffer|corrupt|invalid/i.test(error.message)) return NextResponse.json({ error: "The selected file is not a valid JPG, PNG, WebP or AVIF image." }, { status: 400 });
    console.error("Admin product image upload failed", { path, code: error?.code, error });
    return NextResponse.json({ error: "Image upload failed on the server. Try again or ask the owner to check the storage service." }, { status: 503 });
  }
}
