import { NextResponse } from "next/server";
import { adminDb, requireRole } from "@/lib/admin";
import { serializeDoc } from "@/lib/productData";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const access = await requireRole(request, ["owner", "admin", "supervisor"]);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });

  const [productsSnap, ordersSnap, movementsSnap] = await Promise.all([
    adminDb().collection("products").get(),
    adminDb().collection("orders").get(),
    adminDb().collection("stock_movements").orderBy("createdAt", "desc").limit(40).get(),
  ]);

  const products = productsSnap.docs.map(serializeDoc).sort((a, b) => a.name.localeCompare(b.name));
  const orders = ordersSnap.docs.map(serializeDoc).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const movements = movementsSnap.docs.map(serializeDoc);

  const metrics = {
    products: products.length,
    active: products.filter((p) => p.active !== false && !p.archived && Number(p.price) > 0).length,
    needsPricing: products.filter((p) => !(Number(p.price) > 0)).length,
    lowStock: products.filter((p) => Number(p.price) > 0 && Number(p.stock) > 0 && Number(p.stock) <= Number(p.lowStockLevel || 8)).length,
    outOfStock: products.filter((p) => Number(p.price) > 0 && Number(p.stock) <= 0).length,
    openOrders: orders.filter((o) => !["completed", "cancelled"].includes(o.status)).length,
  };

  return NextResponse.json({ products, orders, movements, metrics });
}

