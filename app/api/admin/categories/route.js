import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb, requireRole } from "@/lib/admin";
import { auditPayload, slug, text } from "@/lib/serverData";

export async function POST(request) {
  const access = await requireRole(request, ["owner", "admin"]);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  const body = await request.json().catch(() => ({}));
  const name = text(body.name, 120);
  const categoryId = text(body.categoryId, 120) || slug(name);
  if (!name || !categoryId) return NextResponse.json({ error: "Category name is required." }, { status: 400 });

  const store = adminDb();
  const ref = store.collection("categories").doc(categoryId);
  const existing = await ref.get();
  const nameMatches = await store.collection("categories").where("name", "==", name).limit(2).get();
  if (nameMatches.docs.some((doc) => doc.id !== categoryId)) return NextResponse.json({ error: "Category names must be unique." }, { status: 409 });
  if (body.create && existing.exists) return NextResponse.json({ error: "That category already exists." }, { status: 409 });
  if (!body.create && !existing.exists) return NextResponse.json({ error: "Category not found." }, { status: 404 });

  const value = {
    categoryId,
    name,
    description: text(body.description, 1000),
    active: body.active !== false,
    archived: Boolean(body.archived),
    sortOrder: Math.max(0, Math.floor(Number(body.sortOrder || 0))),
    updatedAt: FieldValue.serverTimestamp(),
  };
  const batch = store.batch();
  if (existing.exists) batch.update(ref, value);
  else batch.create(ref, { ...value, createdAt: FieldValue.serverTimestamp() });
  batch.create(store.collection("admin_audit").doc(), auditPayload(access.user, existing.exists ? "UPDATE_CATEGORY" : "CREATE_CATEGORY", "category", categoryId, `${existing.exists ? "Updated" : "Created"} category ${name}.`, existing.exists ? existing.data() : null, value));
  await batch.commit();
  return NextResponse.json({ ok: true, categoryId });
}
