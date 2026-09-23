import { NextResponse } from "next/server";
import { adminDb, requireRole } from "@/lib/admin";
import { isSellable, publicProduct, serializeDoc } from "@/lib/productData";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const access = await requireRole(request, ["owner", "admin", "supervisor", "cashier"]);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });

  const snapshot = await adminDb().collection("products").get();
  const products = snapshot.docs.map(serializeDoc).filter(isSellable).map(publicProduct);
  return NextResponse.json({ products });
}

