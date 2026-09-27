import { NextResponse } from "next/server";
import { adminDb, requireRole } from "@/lib/admin";
import { availableForSale, catalogueContext, publicDiscountRule } from "@/lib/commerce";
import { publicProduct, serializeDoc } from "@/lib/productData";
import { categoryLabels } from "@/lib/categoryHierarchy";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const access = await requireRole(request, ["owner", "admin", "supervisor", "cashier"]);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });

  const store = adminDb();
  const [snapshot, context] = await Promise.all([store.collection("products").get(), catalogueContext(store)]);
  const products = snapshot.docs.map(serializeDoc).filter((product) => availableForSale(product, context)).map((product) => ({ ...publicProduct(product), ...categoryLabels(product, context.hierarchy) }));
  return NextResponse.json({ products, ...context.activeHierarchy, discountRules: context.rules.map(publicDiscountRule) });
}

