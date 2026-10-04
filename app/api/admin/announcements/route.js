import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb, requireRole } from "@/lib/admin";
import { auditPayload, text } from "@/lib/serverData";
import { validAnnouncementLink } from "@/lib/announcements.mjs";

export async function GET(request) {
  const access = await requireRole(request, ["owner", "admin"]);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  const snap = await adminDb().collection("announcements").get();
  return NextResponse.json({ announcements: snap.docs.map((doc) => ({ announcementId: doc.id, ...doc.data(), startDate: doc.data().startDate?.toDate?.()?.toISOString?.() || doc.data().startDate || "", endDate: doc.data().endDate?.toDate?.()?.toISOString?.() || doc.data().endDate || "" })).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)) });
}

export async function POST(request) {
  const access = await requireRole(request, ["owner", "admin"]);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  const body = await request.json().catch(() => ({}));
  const title = text(body.title, 120), message = text(body.body, 1200);
  if (!title || !message) return NextResponse.json({ error: "Add a title and message." }, { status: 400 });
  if (!validAnnouncementLink(body.actionUrl)) return NextResponse.json({ error: "Use an internal path or HTTPS action link." }, { status: 400 });
  const startDate = body.startDate ? new Date(body.startDate) : null;
  const endDate = body.endDate ? new Date(body.endDate) : null;
  if (startDate && Number.isNaN(startDate.getTime()) || endDate && Number.isNaN(endDate.getTime()) || startDate && endDate && endDate < startDate) return NextResponse.json({ error: "Choose a valid announcement date range." }, { status: 400 });
  const sortOrder = Number(body.sortOrder ?? 0);
  if (!Number.isSafeInteger(sortOrder) || sortOrder < 0) return NextResponse.json({ error: "Sort order must be a non-negative whole number." }, { status: 400 });
  const store = adminDb();
  const announcementId = body.announcementId ? text(body.announcementId, 100) : `ANN-${crypto.randomUUID()}`;
  const ref = store.collection("announcements").doc(announcementId);
  const old = await ref.get();
  if (body.announcementId && !old.exists) return NextResponse.json({ error: "Announcement not found." }, { status: 404 });
  const value = { announcementId, title, body: message, style: body.style === "crawler" ? "crawler" : "static", actionLabel: text(body.actionLabel, 80), actionUrl: text(body.actionUrl, 500), sortOrder, startDate: startDate?.toISOString() || null, endDate: endDate?.toISOString() || null, active: body.active !== false, archived: body.archived === true, updatedAt: FieldValue.serverTimestamp(), updatedBy: access.user.uid };
  const batch = store.batch();
  batch.set(ref, { ...value, ...(old.exists ? {} : { createdAt: FieldValue.serverTimestamp() }) }, { merge: true });
  batch.create(store.collection("admin_audit").doc(), auditPayload(access.user, old.exists ? "UPDATE_ANNOUNCEMENT" : "CREATE_ANNOUNCEMENT", "announcement", announcementId, `${old.exists ? "Updated" : "Created"} announcement ${title}.`, old.exists ? old.data() : null, value));
  await batch.commit();
  return NextResponse.json({ ok: true, announcementId });
}
