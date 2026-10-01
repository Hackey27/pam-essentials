import { isSellable } from "@/lib/productData";
import { activeHierarchy, loadHierarchy, productInActiveHierarchy } from "@/lib/categoryHierarchy";
import { activeRule } from "@/lib/discount.mjs";
export { activeRule, resolveDiscount } from "@/lib/discount.mjs";
export { priceCart } from "@/lib/cartPricing.mjs";

export async function catalogueContext(store) {
  const [hierarchy, discountsSnap, dealsSnap, dealsSetting] = await Promise.all([
    loadHierarchy(store),
    store.collection("discount_rules").get(),
    store.collection("deal_bundles").get(),
    store.collection("settings").doc("PAM_DEALS_ACTIVE").get(),
  ]);
  const active = activeHierarchy(hierarchy);
  const activeCategoryIds = new Set(active.categories.map((item) => item.categoryId || item.id));
  const rules = discountsSnap.docs.map((doc) => ({ ruleId: doc.id, ...doc.data() })).filter(activeRule);
  const dealsActive = dealsSetting.exists && dealsSetting.data().value === true;
  const deals = dealsActive ? dealsSnap.docs.map((doc) => ({ dealId: doc.id, ...doc.data() })).filter((deal) => deal.active !== false && deal.archived !== true) : [];
  return { activeCategoryIds, hierarchy, activeHierarchy: active, rules, deals, dealsActive };
}

export function availableForSale(product, context) {
  return isSellable(product) && context.activeCategoryIds.has(product.categoryId) && productInActiveHierarchy(product, context.hierarchy);
}

export function publicDiscountRule(rule) {
  return {
    ruleId: rule.ruleId,
    name: rule.name,
    kind: rule.kind || "discount",
    scopeType: rule.scopeType,
    scopeId: rule.scopeId || null,
    discountType: rule.discountType,
    value: Number(rule.value || 0),
    minQty: Number(rule.minQty || 1),
    priority: Number(rule.priority || 0),
    startDate: rule.startDate?.toDate?.()?.toISOString?.() || rule.startDate || null,
    endDate: rule.endDate?.toDate?.()?.toISOString?.() || rule.endDate || null,
  };
}

