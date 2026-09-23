import { NextResponse } from "next/server";
import { adminDb } from "@/lib/admin";
import { availableForSale, catalogueContext, publicDiscountRule } from "@/lib/commerce";
import { publicProduct, serializeDoc } from "@/lib/productData";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const store = adminDb();
    const [snapshot, context] = await Promise.all([store.collection("products").get(), catalogueContext(store)]);
    const products = snapshot.docs
      .map(serializeDoc)
      .filter((product) => availableForSale(product, context.activeCategoryIds))
      .map(publicProduct)
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.name.localeCompare(b.name));

    return NextResponse.json({ products, discountRules: context.rules.map(publicDiscountRule) });
  } catch (error) {
    console.error("catalog", error);
    return NextResponse.json({ products: [], error: "The catalogue is temporarily unavailable." }, { status: 503 });
  }
}
