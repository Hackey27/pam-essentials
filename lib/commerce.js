import { isSellable } from "@/lib/productData";
import { activeHierarchy, loadHierarchy, productInActiveHierarchy } from "@/lib/categoryHierarchy";
import { activeRule } from "@/lib/discount.mjs";
export { activeRule, resolveDiscount } from "@/lib/discount.mjs";

export async function catalogueContext(store) {
  const [hierarchy, discountsSnap] = await Promise.all([
    loadHierarchy(store),
    store.collection("discount_rules").get(),
  ]);
  const active = activeHierarchy(hierarchy);
  const activeCategoryIds = new Set(active.categories.map((item) => item.categoryId || item.id));
  const rules = discountsSnap.docs.map((doc) => ({ ruleId: doc.id, ...doc.data() })).filter(activeRule);
  return { activeCategoryIds, hierarchy, activeHierarchy: active, rules };
}

export function availableForSale(product, context) {
  return isSellable(product) && context.activeCategoryIds.has(product.categoryId) && productInActiveHierarchy(product, context.hierarchy);
}

export function publicDiscountRule(rule) {
  return {
    ruleId: rule.ruleId,
    name: rule.name,
    scopeType: rule.scopeType,
    scopeId: rule.scopeId || null,
    discountType: rule.discountType,
    value: Number(rule.value || 0),
    minQty: Number(rule.minQty || 1),
    priority: Number(rule.priority || 0),
  };
}

