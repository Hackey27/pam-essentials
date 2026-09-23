import { NextResponse } from "next/server";
import { adminDb, requireRole } from "@/lib/admin";
import { serializeDoc } from "@/lib/productData";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const access = await requireRole(request, ["owner", "admin", "supervisor", "cashier"]);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  const snapshot = await adminDb().collection("orders").get();
  const orders = snapshot.docs.map(serializeDoc).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return NextResponse.json({ orders });
}
