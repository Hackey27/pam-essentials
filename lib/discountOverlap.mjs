const enabled = (item) => item && item.active !== false && item.archived !== true;
const stamp = (value, fallback) => {
  if (!value) return fallback;
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isFinite(date.getTime()) ? date.getTime() : fallback;
};

function datesOverlap(left, right) {
  return stamp(left.startDate, -Infinity) <= stamp(right.endDate, Infinity) && stamp(right.startDate, -Infinity) <= stamp(left.endDate, Infinity);
}

function covers(rule, product) {
  if (rule.scopeType === "GLOBAL") return true;
  if (rule.scopeType === "CATEGORY") return rule.scopeId === product.categoryId;
  return rule.scopeType === "PRODUCT" && rule.scopeId === product.id;
}

function ruleScopesOverlap(left, right, products) {
  if (left.scopeType === "GLOBAL" || right.scopeType === "GLOBAL") return true;
  if (left.scopeType === right.scopeType) return left.scopeId === right.scopeId;
  return products.some((product) => covers(left, product) && covers(right, product));
}

const entry = (type, item) => ({ type, id: item.ruleId || item.dealId, name: item.name });

export function findRuleOverlaps(draft, rules = [], deals = [], products = []) {
  if (!enabled(draft)) return [];
  const relatedRules = rules.filter((rule) => enabled(rule) && rule.ruleId !== draft.ruleId && datesOverlap(draft, rule) && ruleScopesOverlap(draft, rule, products)).map((rule) => entry("rule", rule));
  const relatedDeals = deals.filter((deal) => enabled(deal) && (deal.productIds || []).some((id) => {
    const product = products.find((candidate) => candidate.id === id);
    return product && covers(draft, product);
  })).map((deal) => entry("deal", deal));
  return [...relatedRules, ...relatedDeals];
}

export function findDealOverlaps(draft, deals = [], rules = [], products = []) {
  if (!enabled(draft)) return [];
  const ids = new Set(draft.productIds || []);
  const relatedDeals = deals.filter((deal) => enabled(deal) && deal.dealId !== draft.dealId && (deal.productIds || []).some((id) => ids.has(id))).map((deal) => entry("deal", deal));
  const relatedRules = rules.filter((rule) => enabled(rule) && products.some((product) => ids.has(product.id) && covers(rule, product))).map((rule) => entry("rule", rule));
  return [...relatedDeals, ...relatedRules];
}
