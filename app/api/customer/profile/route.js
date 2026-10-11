import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/admin";
import { customerIdentity } from "@/lib/customerAuth";

export const dynamic = "force-dynamic";
const profileData = (data, account) => ({ name: data?.name || "", email: account.email, phone: data?.phone || "", marketingEmail: data?.marketingEmail === true, marketingPhone: data?.marketingPhone === true });
export async function GET(request) {
  const account = await customerIdentity(request);
  if (account.error) return NextResponse.json({ error: account.error }, { status: account.status });
  const snap = await adminDb().collection("customer_accounts").doc(account.uid).get();
  return NextResponse.json({ profile: profileData(snap.data(), account) }, { headers: { "Cache-Control": "private, no-store" } });
}
export async function POST(request) {
  const account = await customerIdentity(request);
  if (account.error) return NextResponse.json({ error: account.error }, { status: account.status });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.name !== "string" || typeof body.phone !== "string" || body.name.length > 120 || body.phone.length > 40 || /[\u0000-\u001f]/.test(body.name + body.phone) || body.phone.trim() && !/^\+?[\d ()-]{6,40}$/.test(body.phone.trim()) || typeof body.marketingEmail !== "boolean" || typeof body.marketingPhone !== "boolean") return NextResponse.json({ error: "Enter a valid name, phone and contact preferences." }, { status: 400 });
  const profile = { name: body.name.trim(), phone: body.phone.trim(), email: account.email, marketingEmail: body.marketingEmail, marketingPhone: body.marketingPhone };
  if (profile.marketingPhone && !profile.phone || profile.marketingEmail && !account.email) return NextResponse.json({ error: "Add contact details before opting in to promotional messages." }, { status: 400 });
  await adminDb().collection("customer_accounts").doc(account.uid).set({ ...profile, preferencesUpdatedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return NextResponse.json({ profile });
}
