import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb, requireRole } from "@/lib/admin";
import { auditPayload, nullableNumber, text } from "@/lib/serverData";

export async function POST(request) {
  const access = await requireRole(request, ["owner", "admin"]);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  const body = await request.json().catch(() => ({}));
  const id = text(body.id || body.sku, 80);
  const name = text(body.name, 160);
  const categoryId = text(body.categoryId, 120);
  if (!id || !name || !categoryId) return NextResponse.json({ error: "Product ID, name and category are required." }, { status: 400 });

  const store = adminDb();
  const ref = store.collection("products").doc(encodeURIComponent(id));
  const existing = await ref.get();
  const category = await store.collection("categories").doc(categoryId).get();
  if (!category.exists) return NextResponse.json({ error: "Choose an existing category." }, { status: 400 });
  if (body.create && existing.exists) return NextResponse.json({ error: "That product ID already exists." }, { status: 409 });
  if (!body.create && !existing.exists) return NextResponse.json({ error: "Product not found." }, { status: 404 });

  const barcode = text(body.barcode, 100);
  if (barcode) {
    const matches = await store.collection("products").where("barcode", "==", barcode).limit(2).get();
    if (matches.docs.some((doc) => doc.id !== ref.id)) return NextResponse.json({ error: "That barcode is already assigned." }, { status: 409 });
  }

  const price = nullableNumber(body.price);
  const costPrice = nullableNumber(body.costPrice);
  if ((price != null && price < 0) || (costPrice != null && costPrice < 0)) return NextResponse.json({ error: "Prices cannot be negative." }, { status: 400 });
  const openingStock = body.create ? Math.floor(Number(body.openingStock || 0)) : 0;
  if (openingStock < 0 || !Number.isFinite(openingStock)) return NextResponse.json({ error: "Opening stock must be zero or greater." }, { status: 400 });
  const oldValue = existing.exists ? existing.data() : null;
  const product = {
    id,
    sku: text(body.sku || id, 100),
    barcode,
    name,
    description: text(body.description, 3000),
    categoryId,
    category: category.data().name,
    price,
    costPrice,
    pinned: Boolean(body.pinned),
    active: body.active !== false,
    archived: Boolean(body.archived),
    sellable: body.active !== false && !body.archived && Number(price) > 0,
    lowStockLevel: nullableNumber(body.lowStockLevel),
    imageUrl: text(body.imageUrl, 1000),
    images: Array.isArray(body.images) ? body.images.map((value) => text(value, 1000)).filter(Boolean).slice(0, 12) : oldValue?.images || [],
    updatedAt: FieldValue.serverTimestamp(),
  };

  const batch = store.batch();
  if (existing.exists) batch.update(ref, product);
  else batch.create(ref, { ...product, stock: openingStock, createdAt: FieldValue.serverTimestamp() });

  if (openingStock > 0) {
    const movementRef = store.collection("stock_movements").doc();
    batch.create(movementRef, {
      type: "opening",
      productId: id,
      quantity: openingStock,
      oldStock: 0,
      newStock: openingStock,
      supplier: "Opening stock",
      notes: "Opening quantity recorded when the product was created.",
      staff: access.user.uid,
      staffEmail: access.user.email,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
  const auditRef = store.collection("admin_audit").doc();
  batch.create(auditRef, auditPayload(access.user, existing.exists ? "UPDATE_PRODUCT" : "CREATE_PRODUCT", "product", id, `${existing.exists ? "Updated" : "Created"} ${name}.`, oldValue, product));
  await batch.commit();
  return NextResponse.json({ ok: true, id });
}
