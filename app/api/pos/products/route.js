import { NextResponse } from "next/server";
import { adminDb, requireRole } from "@/lib/admin";
import { availableForSale, catalogueContext, publicDiscountRule } from "@/lib/commerce";
import { publicProduct, serializeDoc } from "@/lib/productData";
import { categoryLabels, effectiveCollections } from "@/lib/categoryHierarchy";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const access = await requireRole(request, ["owner", "admin", "supervisor", "cashier"]);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });

  const store = adminDb();
  const [snapshot, context] = await Promise.all([store.collection("products").get(), catalogueContext(store)]);
  const products = snapshot.docs.map(serializeDoc).filter((product) => availableForSale(product, context)).map((product) => ({ ...publicProduct(product), sku: product.sku || product.id, barcode: product.barcode || "", barcodeEntries: product.barcodeEntries, qrCode: product.qrCode || "", productCode: product.productCode || "", purchaseCount: Number(product.purchaseCount || 0), ...categoryLabels(product, context.hierarchy), collections: effectiveCollections(product, context.hierarchy) }));
  const productMap = new Map(products.map((product) => [product.id, product]));
  const dealBundles = context.deals.filter((deal) => (deal.productIds || []).length >= 2 && deal.productIds.every((id) => productMap.has(id))).map((deal) => ({ dealId: deal.dealId, name: deal.name, productIds: deal.productIds, finalPrice: Number(deal.finalPrice), aggregatePrice: Math.round(deal.productIds.reduce((sum, id) => sum + productMap.get(id).price, 0) * 100) / 100, available: deal.productIds.every((id) => productMap.get(id).stock > 0) }));
  return NextResponse.json({ products, ...context.activeHierarchy, discountRules: context.rules.map(publicDiscountRule), dealBundles });
}

