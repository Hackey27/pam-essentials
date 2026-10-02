import { activeRule, resolveDiscount } from "./discount.mjs";

export function quantityOfferMessage(product, quantity, rules = [], now = new Date()) {
  if (!product || !Number.isFinite(Number(quantity)) || Number(quantity) < 1) return "";
  const applied = resolveDiscount(product, Number(quantity), rules, now);
  if (applied.amount > 0 && applied.rule) {
    return applied.rule.discountType === "PERCENT" ? `${applied.rule.value}% discount applied` : "Discount applied";
  }
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

export function appliedOfferLabel(line) {
  if (line?.ruleDiscountCents > 0 && line.rule) {
    return line.rule.discountType === "PERCENT" ? `${line.rule.value}% discount applied` : "Discount applied";
  }
  return line?.dealDiscountCents > 0 ? "Deal applied" : "";
}

export function appliedOfferBadge(line) {
  if (line?.ruleDiscountCents > 0 && line.rule?.discountType === "PERCENT") return `−${line.rule.value}%`;
  const amount = (Number(line?.ruleDiscountCents || 0) + Number(line?.dealDiscountCents || 0)) / 100;
  return amount > 0 ? `−GH₵${amount.toFixed(2)}` : "";
}

export function orderOfferLabel(item) {
  const snapshot = item?.discountRuleSnapshot;
  if (snapshot?.discountType === "PERCENT" && Number(snapshot.amount) > 0) return `${snapshot.value}% discount applied`;
  if (Number(item?.dealBundleSnapshot?.amount) > 0) return "Deal applied";
  // Historical orders saved the rule amount but not its percentage.
  const gross = Number(item?.unitPrice) * Number(item?.quantity);
  if (!item?.dealBundleSnapshot && gross > 0 && Number(item?.quantity) >= 3 && Math.abs((gross - Number(item.lineTotal)) / gross - 0.05) < 0.0001) return "5% discount applied";
  if (snapshot && Number(snapshot.amount) > 0) return "Discount applied";
  return "";
}
