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
    const [snapshot, context, dealsSetting, flyerSetting] = await Promise.all([store.collection("products").get(), catalogueContext(store), store.collection("settings").doc("PAM_DEALS_ACTIVE").get(), store.collection("settings").doc("HERO_FLYER_URL").get()]);
    const dealsActive = dealsSetting.exists && dealsSetting.data().value === true;
    const flyerUrl = flyerSetting.exists ? String(flyerSetting.data().value || "") : "";
    const publicLaunch = process.env.STORE_PUBLIC === "true";
    const ranked = snapshot.docs
      .map(serializeDoc)
      .filter((product) => availableForSale(product, context))
      .map((product) => ({ ...publicProduct(product), ...categoryLabels(product, context.hierarchy), _score: popularityScore(product), _popular: Number(product.clickCount || 0) >= 20 || Number(product.purchaseCount || 0) >= 3 }))
      .sort((a, b) => (publicLaunch ? b._score - a._score : 0) || Number(b.pinned) - Number(a.pinned) || a.name.localeCompare(b.name));

    const popularProducts = publicLaunch ? ranked
      .filter((product) => product._popular)
      .slice(0, 3)
      .map(({ id, name }) => ({ id, name })) : [];
    const products = ranked.map(({ _score, _popular, ...product }) => product);

    return NextResponse.json({ products, ...context.activeHierarchy, discountRules: context.rules.map(publicDiscountRule), popularProducts, publicLaunch, dealsActive, flyerUrl });
  } catch (error) {
    console.error("catalog", error);
    return NextResponse.json({ products: [], error: "The catalogue is temporarily unavailable." }, { status: 503 });
  }
}

