import { NextResponse } from "next/server";
import { adminAuth, adminDb, requireRole } from "@/lib/admin";
import { customerContact, wishlistSummary } from "@/lib/customerDirectory.mjs";

export const dynamic = "force-dynamic";
export async function GET(request) {
  const access = await requireRole(request, ["owner", "admin"]);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  const params = new URL(request.url).searchParams;
  const pageToken = params.get("pageToken") || undefined;
  if (pageToken && pageToken.length > 2000) return NextResponse.json({ error: "Invalid account page." }, { status: 400 });
  try {
    const store = adminDb();
    const staffSnap = await store.collection("users").get();
    const staffIds = new Set(staffSnap.docs.filter((doc) => doc.data().role || doc.data().active === false).map((doc) => doc.id));
    if (params.get("view") === "wishlist") {
      const accounts = await store.collection("customer_accounts").get();
      return NextResponse.json({ ...wishlistSummary(accounts.docs.map((doc) => ({ ...doc.data(), id: doc.id })), staffIds), updatedAt: new Date().toISOString() }, { headers: { "Cache-Control": "private, no-store" } });
    }
    const page = await adminAuth().listUsers(1000, pageToken);
    const users = page.users.filter((user) => !staffIds.has(user.uid) && !user.customClaims?.role);
    const profiles = users.length ? await store.getAll(...users.map((user) => store.collection("customer_accounts").doc(user.uid))) : [];
    return NextResponse.json({ customers: users.map((user, index) => customerContact(user, profiles[index]?.data() || {})), nextPageToken: page.pageToken || null, updatedAt: new Date().toISOString() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Customer data could not be loaded. Refresh to retry." }, { status: 503 });
  }
}
