import { NextResponse } from "next/server";
import { adminDb } from "@/lib/admin";
import { availableForSale, catalogueContext, publicDiscountRule } from "@/lib/commerce";
import { publicProduct, serializeDoc } from "@/lib/productData";
import { categoryLabels, effectiveCollections } from "@/lib/categoryHierarchy";
import { popularityScore } from "@/lib/catalogueBrowse.mjs";
import { isHeroImagePath } from "@/lib/heroImages.mjs";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const store = adminDb();
    const [snapshot, context, flyerSetting, webHeroSetting, mobileHeroSetting] = await Promise.all([store.collection("products").get(), catalogueContext(store), store.collection("settings").doc("HERO_FLYER_URL").get(), store.collection("settings").doc("HERO_WEB_IMAGE_PATH").get(), store.collection("settings").doc("HERO_MOBILE_IMAGE_PATH").get()]);
    const dealsActive = context.dealsActive;
    const flyerUrl = flyerSetting.exists ? String(flyerSetting.data().value || "") : "";
    const webHeroPath = isHeroImagePath(webHeroSetting.data()?.value, "web") ? webHeroSetting.data().value : "";
    const mobileHeroPath = isHeroImagePath(mobileHeroSetting.data()?.value, "mobile") ? mobileHeroSetting.data().value : "";
    const publicLaunch = process.env.STORE_PUBLIC === "true";
    const ranked = snapshot.docs
      .map(serializeDoc)
      .filter((product) => availableForSale(product, context))
      .map((product) => ({ ...publicProduct(product), ...categoryLabels(product, context.hierarchy), collections: effectiveCollections(product, context.hierarchy), _score: popularityScore(product), _popular: Number(product.clickCount || 0) >= 20 || Number(product.purchaseCount || 0) >= 3 }))
      .sort((a, b) => (publicLaunch ? b._score - a._score : 0) || Number(b.pinned) - Number(a.pinned) || a.name.localeCompare(b.name));

    const popularProducts = publicLaunch ? ranked
      .filter((product) => product._popular)
      .slice(0, 3)
      .map(({ id, name }) => ({ id, name })) : [];
    const products = ranked.map(({ _score, _popular, ...product }) => product);
    const productMap = new Map(products.map((product) => [product.id, product]));
    const dealBundles = context.deals.filter((deal) => (deal.productIds || []).length >= 2 && deal.productIds.every((id) => productMap.has(id))).map((deal) => ({ dealId: deal.dealId, name: deal.name, productIds: deal.productIds, finalPrice: Number(deal.finalPrice), aggregatePrice: Math.round(deal.productIds.reduce((sum, id) => sum + productMap.get(id).price, 0) * 100) / 100, available: deal.productIds.every((id) => productMap.get(id).stock > 0) }));

    return NextResponse.json({ products, ...context.activeHierarchy, discountRules: context.rules.map(publicDiscountRule), dealBundles, popularProducts, publicLaunch, dealsActive, flyerUrl, webHeroPath, mobileHeroPath });
  } catch (error) {
    console.error("catalog", error);
    return NextResponse.json({ products: [], error: "The catalogue is temporarily unavailable." }, { status: 503 });
  }
}

