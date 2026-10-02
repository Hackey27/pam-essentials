import { activeRule, resolveDiscount } from "./discount.mjs";

export function quantityOfferMessage(product, quantity, rules = [], now = new Date()) {
  const candidates = rules.filter((rule) => activeRule(rule, now) && Number(rule.minQty || 1) > quantity && Number(rule.minQty || 1) > 1 && (
    rule.scopeType === "GLOBAL" || rule.scopeType === "CATEGORY" && rule.scopeId === product.categoryId || rule.scopeType === "PRODUCT" && rule.scopeId === product.id
  )).sort((a, b) => Number(a.minQty) - Number(b.minQty));
  const next = candidates.find((rule) => resolveDiscount(product, Number(rule.minQty), rules, now).rule?.ruleId === rule.ruleId);
  if (!next) return "";
  const needed = Number(next.minQty) - quantity;
  return next.discountType === "PERCENT"
    ? `Add ${needed} more ${needed === 1 ? "unit" : "units"} of this product to get ${next.value}% off.`
    : `Add ${needed} more ${needed === 1 ? "unit" : "units"} of this product to save GH₵${Number(next.value).toFixed(2)}.`;
}
