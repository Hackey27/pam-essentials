import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb, requireRole } from "@/lib/admin";
import { auditPayload, slug, text } from "@/lib/serverData";

export async function POST(request) {
  const access = await requireRole(request, ["owner", "admin"]);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  const body = await request.json().catch(() => ({}));
  const kind = body.kind;
  if (!["subcategory", "subSubcategory"].includes(kind)) return NextResponse.json({ error: "Choose a hierarchy level." }, { status: 400 });
  const name = text(body.name, 120);
  const categoryId = text(body.categoryId, 120);
  const subcategoryId = kind === "subSubcategory" ? text(body.subcategoryId, 250) : "";
  if (!name || !categoryId || (kind === "subSubcategory" && !subcategoryId)) return NextResponse.json({ error: "Name and parent are required." }, { status: 400 });
  const store = adminDb();
  const category = await store.collection("categories").doc(categoryId).get();
  if (!category.exists) return NextResponse.json({ error: "Choose an existing category." }, { status: 400 });
  if (kind === "subSubcategory") {
    const parent = await store.collection("subcategories").doc(subcategoryId).get();
    if (!parent.exists || parent.data().categoryId !== categoryId) return NextResponse.json({ error: "Choose a subcategory within this category." }, { status: 400 });
  }
  const idField = kind === "subcategory" ? "subcategoryId" : "subSubcategoryId";
  const collection = kind === "subcategory" ? "subcategories" : "sub_subcategories";
  const id = text(body[idField], 350) || `${kind === "subcategory" ? categoryId : subcategoryId}--${slug(name)}`;
  if (!id || id.includes("/")) return NextResponse.json({ error: "Invalid hierarchy ID." }, { status: 400 });
  const ref = store.collection(collection).doc(id);
  const existing = await ref.get();
  if (body.create && existing.exists) return NextResponse.json({ error: "That item already exists." }, { status: 409 });
  if (!body.create && !existing.exists) return NextResponse.json({ error: "Item not found." }, { status: 404 });
  const parentField = kind === "subcategory" ? "categoryId" : "subcategoryId";
  const parentId = kind === "subcategory" ? categoryId : subcategoryId;
  if (existing.exists && existing.data()[parentField] !== parentId) return NextResponse.json({ error: "Changing the parent of an existing item is not supported. Create a new item under the chosen parent." }, { status: 400 });
  const siblings = await store.collection(collection).where(parentField, "==", parentId).get();
  if (siblings.docs.some((doc) => doc.id !== id && doc.data().name.toLowerCase() === name.toLowerCase())) return NextResponse.json({ error: "Names must be unique within a parent." }, { status: 409 });
  const requestedSort = Number(body.sortOrder);
  if (!Number.isInteger(requestedSort) || requestedSort < 0) return NextResponse.json({ error: "Sort order must be a nonnegative whole number." }, { status: 400 });
  const value = {
    [idField]: id, categoryId, name,
    ...(kind === "subSubcategory" ? { subcategoryId } : {}),
    description: text(body.description, 1000),
    sortOrder: requestedSort,
    collections: (Array.isArray(body.collections) ? body.collections : existing.data()?.collections || []).map((item) => text(item, 80)).filter(Boolean).slice(0, 12),
    active: body.active !== false,
    archived: Boolean(body.archived),
    updatedAt: FieldValue.serverTimestamp(),
  };
  const batch = store.batch();
  if (existing.exists) batch.update(ref, value);
  else batch.create(ref, { ...value, createdAt: FieldValue.serverTimestamp() });
  batch.create(store.collection("admin_audit").doc(), auditPayload(access.user, existing.exists ? "UPDATE_HIERARCHY" : "CREATE_HIERARCHY", kind, id, `${existing.exists ? "Updated" : "Created"} ${kind} ${name}.`, existing.exists ? existing.data() : null, value));
  await batch.commit();
  return NextResponse.json({ ok: true, id });
}

