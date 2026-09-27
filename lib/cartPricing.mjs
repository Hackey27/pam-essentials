import { resolveDiscount } from "./discount.mjs";

const cents = (value) => Math.round(Number(value || 0) * 100);

export function priceCart(products, rules = [], deals = [], now = new Date()) {
  const cartQuantity = products.reduce((sum, product) => sum + Number(product.quantity || 0), 0);
  const lines = products.map((product) => {
    const quantity = Number(product.quantity || 0);
    const subtotalCents = cents(product.price) * quantity;
    const applied = resolveDiscount(product, quantity, rules, now, cartQuantity);
    return { ...product, quantity, subtotalCents, ruleDiscountCents: cents(applied.amount), dealDiscountCents: 0, rule: applied.rule, dealIds: [] };
  });
  const byId = new Map(lines.map((line) => [line.id, line]));
  const remaining = new Map(lines.map((line) => [line.id, line.quantity]));
  const rankedDeals = deals.filter((deal) => deal.active !== false && Array.isArray(deal.productIds) && deal.productIds.length >= 2 && Number(deal.finalPrice) > 0 && deal.productIds.every((id) => byId.has(id)))
    .map((deal) => ({ ...deal, savingCents: deal.productIds.reduce((sum, id) => sum + cents(byId.get(id).price), 0) - cents(deal.finalPrice) }))
    .filter((deal) => deal.savingCents > 0)
    .sort((a, b) => b.savingCents - a.savingCents || String(a.dealId).localeCompare(String(b.dealId)));
  for (const deal of rankedDeals) {
    const count = Math.min(...deal.productIds.map((id) => remaining.get(id)));
    if (!count) continue;
    const existingDiscount = Math.round(deal.productIds.reduce((sum, id) => {
      const line = byId.get(id);
      return sum + line.ruleDiscountCents / line.quantity;
    }, 0) * count);
    const extra = Math.max(0, deal.savingCents * count - existingDiscount);
    if (!extra) continue;
    const gross = deal.productIds.reduce((sum, id) => sum + cents(byId.get(id).price), 0);
    const capacities = deal.productIds.map((id) => {
      const line = byId.get(id);
      return Math.max(0, cents(line.price) * count - Math.round(line.ruleDiscountCents * count / line.quantity));
    });
    const shares = deal.productIds.map((id, index) => Math.min(capacities[index], Math.floor(extra * cents(byId.get(id).price) / gross)));
    let remainder = extra - shares.reduce((sum, share) => sum + share, 0);
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
  const subtotalCents = lines.reduce((sum, line) => sum + line.subtotalCents, 0);
  const discountCents = lines.reduce((sum, line) => sum + line.ruleDiscountCents + line.dealDiscountCents, 0);
  return {
    subtotal: subtotalCents / 100,
    discount: discountCents / 100,
    total: (subtotalCents - discountCents) / 100,
    lines: lines.map((line) => ({ ...line, lineTotal: (line.subtotalCents - line.ruleDiscountCents - line.dealDiscountCents) / 100 })),
  };
}

