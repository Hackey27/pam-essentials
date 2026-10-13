import { activeRule, effectiveRuleEnd, resolveDiscount } from "./discount.mjs";
import { priceCart } from "./cartPricing.mjs";
import { hasSellingPrice, requiresPricingInquiry } from "./productPricing.mjs";

export const previewChannels = [["walk-in", "Walk-in sale"], ["website", "Website order"], ["whatsapp", "WhatsApp order"], ["phone", "Phone order"]];
export function pricingPreview(product, quantity, rules, hierarchy, at, channel, deals = [], dealsActive = false) {
  if (!previewChannels.some(([key]) => key === channel) || !Number.isInteger(quantity) || quantity < 1 || quantity > 999 || !Number.isFinite(new Date(at).getTime())) throw new Error("Choose a product, quantity between 1 and 999, valid date and channel.");
  const now = new Date(at), blockers = [];
  if (!product) throw new Error("Choose a product.");
  if (product.active === false || product.archived) blockers.push("The product is inactive or archived.");
  if (!hasSellingPrice(product)) blockers.push(requiresPricingInquiry(product) ? "This is an intentional quote product. A selling price must be agreed before checkout." : "The product is awaiting a selling price.");
  const category = hierarchy.categories.find((v) => (v.categoryId || v.id) === product.categoryId);
  if (!category || category.active === false || category.archived) blockers.push("The main category is unavailable.");
  // Match the existing checkout hierarchy gate, including its legacy-ID behaviour.
  const sub = hierarchy.subcategories.find((v) => (v.subcategoryId || v.id) === product.subcategoryId);
  const leaf = hierarchy.subSubcategories.find((v) => (v.subSubcategoryId || v.id) === product.subSubcategoryId);
  if (sub && (sub.active === false || sub.archived || sub.categoryId !== product.categoryId)) blockers.push("The subcategory is unavailable.");
  if (leaf && (leaf.active === false || leaf.archived || leaf.subcategoryId !== product.subcategoryId)) blockers.push("The sub-subcategory is unavailable.");
  if (Number(product.stock || 0) < quantity) blockers.push(`Only ${Number(product.stock || 0)} units are currently in stock.`);
  const chosen = hasSellingPrice(product) ? resolveDiscount(product, quantity, rules, now).rule : null;
  const ruleResults = rules.map((rule) => {
    const reasons = [];
    if (rule.active === false) reasons.push("Inactive");
    if (rule.archived) reasons.push("Archived");
    if (rule.startDate && new Date(rule.startDate) > now) reasons.push("Has not started");
    if (effectiveRuleEnd(rule.endDate) && effectiveRuleEnd(rule.endDate) < now) reasons.push("Expired");
    if (quantity < Number(rule.minQty || 1)) reasons.push(`Needs ${rule.minQty} units of this product`);
    if (rule.scopeType === "PRODUCT" && rule.scopeId !== product.id) reasons.push("Different product");
    else if (rule.scopeType === "CATEGORY" && rule.scopeId !== product.categoryId) reasons.push("Different category");
    else if (!["PRODUCT", "CATEGORY", "GLOBAL"].includes(rule.scopeType)) reasons.push("Unsupported scope");
    if (!hasSellingPrice(product)) reasons.push("No selling price");
    const selected = !reasons.length && chosen?.ruleId === rule.ruleId;
    if (!reasons.length && !selected) reasons.push("Eligible, but a higher-ranked rule takes precedence");
    return { ...rule, selected, reasons, explanation: selected ? "Applied by the checkout pricing engine" : reasons.join(" · ") };
  });
  const priced = hasSellingPrice(product) ? priceCart([{ ...product, quantity }], rules, [], now) : null;
  const bundles = deals.filter((v) => v.productIds?.includes(product.id)).map((v) => ({ name: v.name, explanation: !dealsActive ? "PAM Deals is switched off" : v.active === false || v.archived ? "Bundle is inactive or archived" : "Add the other bundle products to a real basket; a single-product preview cannot qualify for this bundle" }));
  return { ...priced, blockers, ruleResults, bundles, purchasable: blockers.length === 0, channelNote: "Current rules apply to every sales channel. Changing the channel does not change the calculation.", precedenceNote: "Promotions first, then product scope, category scope, global scope, and priority. Offers do not stack on the same product line." };
}
