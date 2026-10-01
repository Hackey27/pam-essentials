function asDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function activeRule(rule, now = new Date()) {
  if (rule.active === false || rule.archived === true) return false;
  const start = asDate(rule.startDate);
  const end = asDate(rule.endDate);
  return (!start || start <= now) && (!end || end >= now);
}

export function resolveDiscount(product, quantity, rules, now = new Date()) {
  const candidates = rules.filter((rule) => {
    if (!activeRule(rule, now) || quantity < Number(rule.minQty || 1)) return false;
    if (rule.scopeType === "PRODUCT") return rule.scopeId === product.id;
    if (rule.scopeType === "CATEGORY") return rule.scopeId === product.categoryId;
    return rule.scopeType === "GLOBAL";
  });
  const scopeRank = { GLOBAL: 1, CATEGORY: 2, PRODUCT: 3 };
  candidates.sort((a, b) => Number(b.kind === "promotion") - Number(a.kind === "promotion") || (scopeRank[b.scopeType] || 0) - (scopeRank[a.scopeType] || 0) || Number(b.priority || 0) - Number(a.priority || 0));
  const rule = candidates[0];
  if (!rule) return { amount: 0, rule: null };
  const gross = Number(product.price) * quantity;
  const raw = rule.discountType === "FIXED_AMOUNT" ? Number(rule.value) : gross * Number(rule.value) / 100;
  return { amount: Math.min(gross, Math.max(0, Math.round(raw * 100) / 100)), rule };
}

