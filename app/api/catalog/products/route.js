import { NextResponse } from "next/server";
import { adminDb } from "@/lib/admin";
import { availableForSale, catalogueContext, publicDiscountRule } from "@/lib/commerce";
import { publicProduct, serializeDoc } from "@/lib/productData";
import { categoryLabels } from "@/lib/categoryHierarchy";
import { popularityScore } from "@/lib/catalogueBrowse.mjs";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const store = adminDb();
    const [snapshot, context] = await Promise.all([store.collection("products").get(), catalogueContext(store)]);
    const publicLaunch = process.env.STORE_PUBLIC === "true";
    const products = snapshot.docs
      .map(serializeDoc)
      .filter((product) => availableForSale(product, context))
      .map((product) => ({ ...publicProduct(product), ...categoryLabels(product, context.hierarchy) }))
      .sort((a, b) => (publicLaunch ? popularityScore(b) - popularityScore(a) : 0) || Number(b.pinned) - Number(a.pinned) || a.name.localeCompare(b.name));

    const popularProducts = publicLaunch ? products
      .filter((product) => Number(product.clickCount || 0) >= 20 || Number(product.purchaseCount || 0) >= 3)
      .slice(0, 3)
      .map(({ id, name }) => ({ id, name })) : [];

    return NextResponse.json({ products, ...context.activeHierarchy, discountRules: context.rules.map(publicDiscountRule), popularProducts, publicLaunch });
  } catch (error) {
    console.error("catalog", error);
    return NextResponse.json({ products: [], error: "The catalogue is temporarily unavailable." }, { status: 503 });
  }
}

