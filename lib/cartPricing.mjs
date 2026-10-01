import { resolveDiscount } from "./discount.mjs";

const cents = (value) => Math.round(Number(value || 0) * 100);

export function priceCart(products, rules = [], deals = [], now = new Date()) {
  const lines = products.map((product) => {
    const quantity = Number(product.quantity || 0);
    const subtotalCents = cents(product.price) * quantity;
    return { ...product, quantity, subtotalCents, ruleDiscountCents: 0, dealDiscountCents: 0, rule: null, dealIds: [] };
  });
  const byId = new Map(lines.map((line) => [line.id, line]));
  const remaining = new Map(lines.map((line) => [line.id, line.quantity]));
  const rankedDeals = deals.filter((deal) => deal.active !== false && deal.archived !== true && Array.isArray(deal.productIds) && deal.productIds.length >= 2 && Number(deal.finalPrice) > 0 && deal.productIds.every((id) => byId.has(id)))
    .map((deal) => ({ ...deal, savingCents: deal.productIds.reduce((sum, id) => sum + cents(byId.get(id).price), 0) - cents(deal.finalPrice) }))
    .filter((deal) => deal.savingCents > 0)
    .sort((a, b) => b.savingCents - a.savingCents || String(a.dealId).localeCompare(String(b.dealId)));
  for (const deal of rankedDeals) {
    const count = Math.min(...deal.productIds.map((id) => remaining.get(id)));
    if (!count) continue;
    const saving = deal.savingCents * count;
    const gross = deal.productIds.reduce((sum, id) => sum + cents(byId.get(id).price), 0);
    const capacities = deal.productIds.map((id) => cents(byId.get(id).price) * count);
    const shares = deal.productIds.map((id, index) => Math.min(capacities[index], Math.floor(saving * cents(byId.get(id).price) / gross)));
    let remainder = saving - shares.reduce((sum, share) => sum + share, 0);
    for (let index = 0; index < shares.length && remainder > 0; index += 1) {
      const add = Math.min(remainder, capacities[index] - shares[index]);
      shares[index] += add;
      remainder -= add;
    }
    deal.productIds.forEach((id, index) => {
      const line = byId.get(id);
      line.dealDiscountCents += shares[index];
      line.dealIds.push(deal.dealId);
      remaining.set(id, remaining.get(id) - count);
    });
  }
  for (const line of lines) {
    // A bundle takes precedence for its entire product line: no other offer stacks on it.
    if (line.dealIds.length) continue;
    const eligibleQuantity = remaining.get(line.id);
    if (!eligibleQuantity) continue;
    const applied = resolveDiscount(line, eligibleQuantity, rules, now);
    line.ruleDiscountCents = cents(applied.amount);
    line.rule = applied.rule;
  }
  const subtotalCents = lines.reduce((sum, line) => sum + line.subtotalCents, 0);
  const discountCents = lines.reduce((sum, line) => sum + line.ruleDiscountCents + line.dealDiscountCents, 0);
  return {
    subtotal: subtotalCents / 100,
    discount: discountCents / 100,
    total: (subtotalCents - discountCents) / 100,
    lines: lines.map((line) => ({ ...line, lineTotal: (line.subtotalCents - line.ruleDiscountCents - line.dealDiscountCents) / 100 })),
  };
}

