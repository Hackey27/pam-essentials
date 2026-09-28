import { NextResponse } from "next/server";
import { adminDb, requireRole } from "@/lib/admin";
import { serializeDoc } from "@/lib/productData";
import { receiptSnapshot } from "@/lib/receiptData.mjs";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const access = await requireRole(request, ["owner", "admin", "supervisor", "cashier"]);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  const snapshot = await adminDb().collection("sales").orderBy("createdAt", "desc").limit(500).get();
  const sales = snapshot.docs.map((doc) => receiptSnapshot(serializeDoc(doc)));
  const query = new URL(request.url).searchParams.get("query")?.trim().toLowerCase() || "";
  const receipts = query ? sales.filter((sale) => `${sale.receiptId} ${sale.customerName} ${sale.customerPhone} ${sale.orderReference}`.toLowerCase().includes(query)) : sales;
  return NextResponse.json({ receipts, lastUpdated: new Date().toISOString(), limitedToRecent: 500 });
}

