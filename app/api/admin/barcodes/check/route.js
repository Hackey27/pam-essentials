import { NextResponse } from "next/server";
import { adminDb, requireRole } from "@/lib/admin";
import { normalizeBarcode } from "@/lib/barcodes.mjs";
import { barcodeOwner } from "@/lib/scannerWorkflow.mjs";

export async function POST(request) {
  const access = await requireRole(request, ["owner", "admin"]);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  const body = await request.json().catch(() => ({}));
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!code || code.length > 100 || /[,\r\n]/.test(code)) return NextResponse.json({ error: "Enter one valid barcode or QR code, up to 100 characters." }, { status: 400 });
  const store = adminDb();
  const registry = await store.collection("barcode_registry").doc(encodeURIComponent(normalizeBarcode(code))).get();
  if (registry.exists) {
    const record = registry.data();
    const product = record.productId ? await store.collection("products").doc(encodeURIComponent(record.productId)).get() : null;
    return NextResponse.json({ assigned: true, productId: record.productId, name: product?.data()?.name || record.sku || record.productId, sku: record.sku, archived: Boolean(record.archived) });
  }
  const products = await store.collection("products").get();
  const owner = barcodeOwner(products.docs.map((doc) => ({ ...doc.data(), id: doc.data().id || decodeURIComponent(doc.id) })), code);
  return NextResponse.json(owner ? { assigned: true, productId: owner.id, name: owner.name || owner.sku || owner.id, sku: owner.sku } : { assigned: false });
}
