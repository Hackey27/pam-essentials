import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminAuth, adminDb, requireRole } from "@/lib/admin";
import { auditPayload, text } from "@/lib/serverData";

const roles = ["cashier", "supervisor", "admin", "owner"];

export async function POST(request) {
  const access = await requireRole(request, ["owner", "admin"]);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  const body = await request.json().catch(() => ({}));
  const role = text(body.role, 20).toLowerCase();
  if (!roles.includes(role) || (role === "owner" && access.user.role !== "owner")) return NextResponse.json({ error: "Choose a permitted staff role." }, { status: 400 });
  const store = adminDb();

  try {
    let uid = text(body.uid, 128);
    let authUser;
    let ref;
    let existing;
    if (body.create) {
      const email = text(body.email, 254).toLowerCase();
      const password = String(body.temporaryPassword || "");
      if (!email || password.length < 8) return NextResponse.json({ error: "Email and a temporary password of at least 8 characters are required." }, { status: 400 });
      authUser = await adminAuth().createUser({ email, password, displayName: text(body.displayName, 120), disabled: body.active === false });
      uid = authUser.uid;
      ref = store.collection("users").doc(uid);
      existing = await ref.get();
    } else {
      if (!uid) return NextResponse.json({ error: "Staff account not found." }, { status: 404 });
      ref = store.collection("users").doc(uid);
      existing = await ref.get();
      if (!existing.exists) return NextResponse.json({ error: "Staff profile not found." }, { status: 404 });
      if (existing.data().role === "owner" && access.user.role !== "owner") return NextResponse.json({ error: "Only an owner can change an owner account." }, { status: 403 });
      authUser = await adminAuth().updateUser(uid, { displayName: text(body.displayName, 120), disabled: body.active === false });
    }

    const profile = {
      email: authUser.email || text(body.email, 254),
      displayName: authUser.displayName || text(body.displayName, 120),
      role,
      active: body.active !== false,
      updatedAt: FieldValue.serverTimestamp(),
    };
    const batch = store.batch();
    batch.set(ref, { ...profile, ...(existing.exists ? {} : { createdAt: FieldValue.serverTimestamp() }) }, { merge: true });
    batch.create(store.collection("admin_audit").doc(), auditPayload(access.user, body.create ? "CREATE_STAFF" : "UPDATE_STAFF", "user", uid, `${body.create ? "Created" : "Updated"} staff account ${profile.email}.`, existing.exists ? existing.data() : null, profile));
    await batch.commit();
    return NextResponse.json({ ok: true, uid });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Staff account could not be saved." }, { status: 409 });
  }
}
