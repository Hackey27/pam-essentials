import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import products from "@/data/products.json";
import metadata from "@/data/product_metadata.json";
import hierarchy from "@/data/category_hierarchy.json";
import { adminDb, requireRole } from "@/lib/admin";

export async function POST(request) {
  const access = await requireRole(request, ["owner", "admin"]);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });

  const store = adminDb();
  const existing = await store.collection("products").get();
  const existingProducts = new Map(existing.docs.map((doc) => [doc.id, doc.data()]));
  const metadataById = new Map(metadata.map((item) => [item.id, item]));

  let created = 0;
  let updated = 0;
  let batch = store.batch();
  let batchSize = 0;

  for (const seedProduct of products) {
    const product = { ...seedProduct, ...(metadataById.get(seedProduct.id) || {}) };
    const documentId = encodeURIComponent(product.id);
    const ref = store.collection("products").doc(documentId);
    const current = existingProducts.get(documentId);
    if (current) {
      const details = {
        name: product.name, category: product.category, categoryId: product.categoryId,
        subcategory: product.subcategory, subcategoryId: product.subcategoryId,
        subSubcategory: product.subSubcategory, subSubcategoryId: product.subSubcategoryId,
        productGroupId: product.productGroupId, colour: product.colour, size: product.size,
        colorVariantSizeProductId: product.colorVariantSizeProductId,
        sizeVariantColorProductId: product.sizeVariantColorProductId,
        keywords: product.keywords,
      };
      // Admin-managed combinations are authoritative after the initial import.
      if (current.variantManaged === true) {
        delete details.productGroupId;
        delete details.colour;
        delete details.size;
        delete details.colorVariantSizeProductId;
        delete details.sizeVariantColorProductId;
      }
      if (product.description && !current.description) details.description = product.description;
      if (Object.entries(details).every(([key, value]) => JSON.stringify(current[key] ?? null) === JSON.stringify(value))) continue;
      batch.update(ref, { ...details, updatedAt: FieldValue.serverTimestamp() });
      updated += 1;
    } else {
      batch.create(ref, { ...product, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      created += 1;
    }
    batchSize += 1;
    if (batchSize === 400) {
      await batch.commit();
      batch = store.batch();
      batchSize = 0;
    }
  }
  if (batchSize) await batch.commit();

  const categorySnap = await store.collection("categories").get();
  const existingCategories = new Set(categorySnap.docs.map((doc) => doc.id));
  let categoryBatch = store.batch();
  let categoryBatchSize = 0;
  let categoryCreated = 0;
  let sortOrder = Math.max(0, ...categorySnap.docs.map((doc) => Number(doc.data().sortOrder || 0)));
  for (const { categoryId, name } of hierarchy.categories) {
    if (!existingCategories.has(categoryId)) {
      sortOrder += 1;
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
      categoryBatchSize += 1;
    }
  }
  if (categoryBatchSize) await categoryBatch.commit();
  const seedChildren = async (collection, items, idKey) => {
    const snap = await store.collection(collection).select().get();
    const known = new Set(snap.docs.map((doc) => doc.id));
    let childBatch = store.batch();
    let childBatchSize = 0;
    let count = 0;
    for (const item of items) {
      if (known.has(item[idKey])) continue;
      childBatch.create(store.collection(collection).doc(item[idKey]), {
        ...item, description: "", active: true, archived: false,
        createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      });
      count += 1;
      childBatchSize += 1;
      if (childBatchSize === 400) {
        await childBatch.commit();
        childBatch = store.batch();
        childBatchSize = 0;
      }
    }
    if (childBatchSize) await childBatch.commit();
    return count;
  };
  const subcategoryCreated = await seedChildren("subcategories", hierarchy.subcategories, "subcategoryId");
  const subSubcategoryCreated = await seedChildren("sub_subcategories", hierarchy.subSubcategories, "subSubcategoryId");

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
    description: `Created ${created} products, updated ${updated} product details, created ${categoryCreated} categories, ${subcategoryCreated} subcategories and ${subSubcategoryCreated} sub-subcategories. Operational product fields and existing hierarchy settings were preserved.`,
  });

  return NextResponse.json({
    created,
    updated,
    skipped: products.length - created - updated,
    categoryCreated,
    subcategoryCreated,
    subSubcategoryCreated,
    totalSourceProducts: products.length,
  });
}

