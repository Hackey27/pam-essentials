import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb, requireRole } from "@/lib/admin";
import { auditPayload, nullableNumber, text } from "@/lib/serverData";
import { isProductImagePath, productImageFolder, variantCombinationKey } from "@/lib/productImages.mjs";
import { allBarcodeCodes, normalizeBarcode, planBarcodes } from "@/lib/barcodes.mjs";
import { planVariantGroup, remapVariantImages } from "@/lib/adminVariants.mjs";

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

  const oldValue = existing.exists ? existing.data() : null;
  const managingVariants = body.variantEnabled !== undefined;
  const variantProducts = managingVariants ? (await store.collection("products").get()).docs.map((doc) => ({ ...doc.data(), id: doc.data().id || decodeURIComponent(doc.id) })) : [];
  const variantPlan = managingVariants ? planVariantGroup(body, { ...(oldValue || { id }), categoryId, subcategoryId: body.subcategoryId ?? oldValue?.subcategoryId ?? "", subSubcategoryId: body.subSubcategoryId ?? oldValue?.subSubcategoryId ?? "" }, variantProducts.map((item) => item.id === id ? { ...item, categoryId, subcategoryId: body.subcategoryId ?? item.subcategoryId ?? "", subSubcategoryId: body.subSubcategoryId ?? item.subSubcategoryId ?? "" } : item)) : null;
  if (variantPlan?.error) return NextResponse.json({ error: variantPlan.error }, { status: 400 });
  const groupId = oldValue?.productGroupId || "";
  const groupSnapshot = groupId ? await store.collection("products").where("productGroupId", "==", groupId).get() : { docs: [] };
  const groupDocs = groupSnapshot.docs;
  const allowedFolders = new Set([id, ...groupDocs.map((doc) => doc.data().id || doc.id)].map((productId) => `products/${productImageFolder(productId)}/`));
  const validPath = (path) => !path || isProductImagePath(path) && [...allowedFolders].some((folder) => path.startsWith(folder));
  const imageField = (key) => body[key] === undefined ? oldValue?.[key] || "" : String(body[key] || "");
  const imageList = (key) => body[key] === undefined ? oldValue?.[key] || [] : body[key];
  const cardPreviewImagePath = imageField("cardPreviewImagePath");
  const masterImagePath = imageField("masterImagePath");
  const galleryImagePaths = imageList("galleryImagePaths");
  const variantImages = body.variantImages === undefined ? oldValue?.variantImages || {} : body.variantImages;
  if (!validPath(cardPreviewImagePath) || !validPath(masterImagePath) || !Array.isArray(galleryImagePaths) || galleryImagePaths.length > 12 || !galleryImagePaths.every((path) => typeof path === "string" && validPath(path))) return NextResponse.json({ error: "Product image paths are invalid." }, { status: 400 });
  const knownKeys = new Set(groupDocs.map((doc) => variantCombinationKey(doc.data())).filter(Boolean));
  if (!variantImages || typeof variantImages !== "object" || Array.isArray(variantImages) || Object.keys(variantImages).length > 60 || Object.entries(variantImages).some(([key, entry]) => !key || key.length > 250 || !knownKeys.has(key) && !Object.hasOwn(oldValue?.variantImages || {}, key) || !entry || typeof entry !== "object" || Array.isArray(entry) || !validPath(entry.imagePath || "") || !Array.isArray(entry.galleryImagePaths || []) || (entry.galleryImagePaths || []).length > 12 || !(entry.galleryImagePaths || []).every((path) => typeof path === "string" && validPath(path)))) return NextResponse.json({ error: "Variant image assignments are invalid." }, { status: 400 });
  const subcategoryId = text(body.subcategoryId ?? (oldValue?.categoryId === categoryId ? oldValue?.subcategoryId : ""), 250);
  const subSubcategoryId = text(body.subSubcategoryId ?? (oldValue?.categoryId === categoryId ? oldValue?.subSubcategoryId : ""), 350);
  let subcategoryName = "";
  let subSubcategoryName = "";
  if (subcategoryId) {
    const subcategory = await store.collection("subcategories").doc(subcategoryId).get();
    if (!subcategory.exists || subcategory.data().categoryId !== categoryId) return NextResponse.json({ error: "Choose a subcategory within the selected category." }, { status: 400 });
    subcategoryName = subcategory.data().name;
  }
  if (subSubcategoryId) {
    if (!subcategoryId) return NextResponse.json({ error: "Choose a subcategory before a sub-subcategory." }, { status: 400 });
    const subSubcategory = await store.collection("sub_subcategories").doc(subSubcategoryId).get();
    if (!subSubcategory.exists || subSubcategory.data().subcategoryId !== subcategoryId || subSubcategory.data().categoryId !== categoryId) return NextResponse.json({ error: "Choose a sub-subcategory within the selected subcategory." }, { status: 400 });
    subSubcategoryName = subSubcategory.data().name;
  }

  const sku = text(body.sku || id, 100);
  const archiveCodes = Array.isArray(body.archiveBarcodes) ? body.archiveBarcodes : [];
  const barcodes = planBarcodes(oldValue || { id, sku }, {
    additions: body.barcodeAdditions ?? (body.create ? body.barcode || "" : ""),
    archive: archiveCodes,
    deletions: body.deleteBarcodes ?? [],
    multiple: body.multipleBarcodes === true,
    sku,
  });
  if (barcodes.error) return NextResponse.json({ error: barcodes.error }, { status: 400 });
  const allProducts = await store.collection("products").get();
  const newCodes = new Set(barcodes.entries.filter((entry) => !allBarcodeCodes(oldValue).some((code) => normalizeBarcode(code) === normalizeBarcode(entry.code))).map((entry) => normalizeBarcode(entry.code)));
  if (newCodes.size && allProducts.docs.some((doc) => doc.id !== ref.id && [
    ...allBarcodeCodes(doc.data()), doc.data().sku, doc.data().id || doc.id, doc.data().qrCode, doc.data().productCode,
  ].some((code) => newCodes.has(normalizeBarcode(code))))) return NextResponse.json({ error: "A barcode is already assigned to another product or product code." }, { status: 409 });
  const barcodeRefs = [...newCodes].map((code) => store.collection("barcode_registry").doc(encodeURIComponent(code)));
  if (barcodeRefs.length && (await store.getAll(...barcodeRefs)).some((snap) => snap.exists)) return NextResponse.json({ error: "A barcode was previously assigned and cannot be reused." }, { status: 409 });
  const deletionRefs = barcodes.deleted.map((entry) => store.collection("barcode_registry").doc(encodeURIComponent(normalizeBarcode(entry.code))));
  const deletionSnapshots = deletionRefs.length ? await store.getAll(...deletionRefs) : [];
  if (deletionSnapshots.some((snap) => snap.exists && snap.data().productId !== id)) return NextResponse.json({ error: "A barcode registration belongs to another product. Reload the product before deleting it." }, { status: 409 });

  const price = nullableNumber(body.price);
  const costPrice = nullableNumber(body.costPrice);
  if ((price != null && price < 0) || (costPrice != null && costPrice < 0)) return NextResponse.json({ error: "Prices cannot be negative." }, { status: 400 });
  const openingStock = body.create ? Math.floor(Number(body.openingStock || 0)) : 0;
  if (openingStock < 0 || !Number.isFinite(openingStock)) return NextResponse.json({ error: "Opening stock must be zero or greater." }, { status: 400 });
  const collections = Array.isArray(body.collections) ? body.collections : oldValue?.collections || [];
  const product = {
    id,
    sku,
    barcode: barcodes.barcode,
    barcodeEntries: barcodes.entries,
    multipleBarcodes: barcodes.multipleBarcodes,
    name,
    description: text(body.description, 3000),
    categoryId,
    category: category.data().name,
    subcategoryId,
    subcategory: subcategoryName,
    subSubcategoryId,
    subSubcategory: subSubcategoryName,
    price,
    costPrice,
    pinned: Boolean(body.pinned),
    randomColours: Boolean(body.randomColours),
    ...(typeof body.randomShapes === "boolean" ? { randomShapes: body.randomShapes } : {}),
    newArrival: Boolean(body.newArrival),
    collections: collections.map((value) => text(value, 80)).filter(Boolean).slice(0, 12),
    active: body.active !== false,
    archived: Boolean(body.archived),
    sellable: body.active !== false && !body.archived && Number(price) > 0,
    lowStockLevel: nullableNumber(body.lowStockLevel),
    imageUrl: text(body.imageUrl, 1000),
    images: Array.isArray(body.images) ? body.images.map((value) => text(value, 1000)).filter(Boolean).slice(0, 12) : oldValue?.images || [],
    cardPreviewImagePath,
    galleryImagePaths,
    masterImagePath,
    variantImages,
    updatedAt: FieldValue.serverTimestamp(),
  };

  const batch = store.batch();
  if (variantPlan) {
    product.variantManaged = true;
    product.variantEnabled = variantPlan.enabled;
    product.productGroupId = variantPlan.groupId;
    product.variantTitles = variantPlan.titles || [];
    if (!variantPlan.enabled) product.variantOptions = {};
    else product.variantOptions = variantPlan.members.find((item) => item.product.id === id)?.options || {};
    product.colour = product.variantOptions.colour || "";
    product.size = product.variantOptions.size || "";
    if (variantPlan.enabled) product.variantImages = remapVariantImages(variantPlan, variantImages);
  }
  if (existing.exists) batch.update(ref, product, existing.updateTime ? { lastUpdateTime: existing.updateTime } : {});
  else batch.create(ref, { ...product, stock: openingStock, createdAt: FieldValue.serverTimestamp() });
  for (const [index, code] of [...newCodes].entries()) batch.create(barcodeRefs[index], { code, productId: id, sku, archived: false, createdAt: FieldValue.serverTimestamp() });
  for (const code of archiveCodes) batch.set(store.collection("barcode_registry").doc(encodeURIComponent(normalizeBarcode(code))), { code: normalizeBarcode(code), productId: id, sku: oldValue?.sku || id, archived: true, archivedAt: FieldValue.serverTimestamp() }, { merge: true });
  deletionSnapshots.forEach((snap, index) => {
    if (snap.exists) batch.delete(deletionRefs[index], snap.updateTime ? { lastUpdateTime: snap.updateTime } : {});
  });
  if (groupId && body.variantImages !== undefined) for (const sibling of groupDocs) if (sibling.ref.path !== ref.path) batch.update(sibling.ref, { variantImages, updatedAt: FieldValue.serverTimestamp() });
  if (variantPlan?.enabled) for (const member of variantPlan.members) if (member.product.id !== id) {
    batch.update(store.collection("products").doc(encodeURIComponent(member.product.id)), { productGroupId: variantPlan.groupId, variantEnabled: true, variantManaged: true, variantTitles: variantPlan.titles, variantOptions: member.options, colour: member.options.colour || "", size: member.options.size || "", variantImages: product.variantImages, updatedAt: FieldValue.serverTimestamp() });
  }
  if (variantPlan) for (const member of variantPlan.removed) if (member.id !== id) {
    batch.update(store.collection("products").doc(encodeURIComponent(member.id)), { productGroupId: "", variantEnabled: false, variantManaged: true, variantTitles: [], variantOptions: {}, updatedAt: FieldValue.serverTimestamp() });
  }

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
  for (const entry of barcodes.deleted) {
    const { reason, ...record } = entry;
    batch.create(store.collection("admin_audit").doc(), auditPayload(access.user, "DELETE_BARCODE", "product", id, `Deleted barcode ${entry.code} from SKU ${entry.sku || oldValue?.sku || id}. Reason: ${reason}`, record, { code: entry.code, unlinked: true, reason }));
  }
  try { await batch.commit(); }
  catch (error) {
    if ([6, 9, "already-exists", "failed-precondition"].includes(error.code)) return NextResponse.json({ error: "The product or barcode changed while you were saving. Reload and try again; no changes were saved." }, { status: 409 });
    throw error;
  }
  return NextResponse.json({ ok: true, id });
}

