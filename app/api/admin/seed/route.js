import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import products from "@/data/products.json";
import { adminDb, requireRole } from "@/lib/admin";

export async function POST(request) {
  const access = await requireRole(request, ["owner", "admin"]);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });

  const store = adminDb();
  const existing = await store.collection("products").select().get();
  const existingIds = new Set(existing.docs.map((doc) => doc.id));
  const categories = new Map();
  products.forEach((product) => categories.set(product.categoryId, product.category));

  let created = 0;
  let batch = store.batch();
  let batchSize = 0;

  for (const product of products) {
    const documentId = encodeURIComponent(product.id);
    if (existingIds.has(documentId)) continue;
    batch.create(store.collection("products").doc(documentId), {
      ...product,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    created += 1;
    batchSize += 1;
    if (batchSize === 400) {
      await batch.commit();
      batch = store.batch();
      batchSize = 0;
    }
  }
  if (batchSize) await batch.commit();

  const categorySnap = await store.collection("categories").select().get();
  const existingCategories = new Set(categorySnap.docs.map((doc) => doc.id));
  const categoryBatch = store.batch();
  let categoryCreated = 0;
  let sortOrder = 1;
  for (const [categoryId, name] of categories) {
    if (!existingCategories.has(categoryId)) {
      categoryBatch.create(store.collection("categories").doc(categoryId), {
        categoryId,
        name,
        description: "",
        active: true,
        sortOrder,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      categoryCreated += 1;
    }
    sortOrder += 1;
  }
  if (categoryCreated) await categoryBatch.commit();

  const settings = {
    DEFAULT_LOW_STOCK_LEVEL: 8,
    DISCOUNT_STACKING: false,
    TAX_ENABLED: false,
    PRICES_INCLUDE_TAX: true,
    VAT_RATE: null,
    NHIL_RATE: null,
    GETFUND_RATE: null,
    RECEIPT_TAX_NOTE: "All prices are VAT inclusive.",
  };
  for (const [key, value] of Object.entries(settings)) {
    const ref = store.collection("settings").doc(key);
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.create({ key, value, createdAt: FieldValue.serverTimestamp(), updatedBy: access.user.uid });
    }
  }

  const discountRef = store.collection("discount_rules").doc("DISC001");
  if (!(await discountRef.get()).exists) {
    await discountRef.create({
      ruleId: "DISC001",
      name: "Standard Bulk Discount",
      scopeType: "GLOBAL",
      scopeId: null,
      discountType: "PERCENT",
      value: 5,
      minQty: 3,
      startDate: null,
      endDate: null,
      active: true,
      priority: 1,
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  await store.collection("admin_audit").add({
    timestamp: FieldValue.serverTimestamp(),
    admin: access.user.uid,
    action: "SEED_CATALOGUE",
    entityType: "catalogue",
    entityId: "Data.xlsx",
    description: `Created ${created} products and ${categoryCreated} categories from the initial catalogue.`,
  });

  return NextResponse.json({
    created,
    skipped: products.length - created,
    categoryCreated,
    totalSourceProducts: products.length,
  });
}

