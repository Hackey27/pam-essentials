import { cardImageSource, variantCombinationKey } from "./productImages.mjs";
import { hasSellingPrice, requiresPricingInquiry } from "./productPricing.mjs";
import { deepestCategory, editorVariantState, planVariantGroup } from "./adminVariants.mjs";

export const adminNavigationGroups = [
  ["Workspace", ["Overview"]], ["Sales", ["Orders", "Transactions", "Discounts", "Promotions"]],
  ["Catalogue", ["Products", "Categories", "Inventory"]],
  ["Customers", ["Customers", "Inquiries", "Product Requests", "Reviews", "Restock Alerts"]],
  ["Content", ["Announcements", "Appearance"]], ["Insights", ["Analytics", "Accounting"]],
  ["Settings", ["Staff", "Settings", "Audit"]],
];
export function groupedNavigation(allowed) {
  const known = new Set(adminNavigationGroups.flatMap(([, tabs]) => tabs));
  return [...adminNavigationGroups.map(([title, tabs]) => ({ title, tabs: tabs.filter((tab) => allowed.includes(tab)) })),
    { title: "More", tabs: allowed.filter((tab) => !known.has(tab)) }].filter((group) => group.tabs.length);
}
export const readinessLabels = { photo: "Missing photo", description: "Missing description", classification: "Classification needs attention", variants: "Variant correction", pricing: "Awaiting pricing", quote: "Intentional quote product" };
export function productReadiness(product, products, hierarchy) {
  const issues = [];
  if (!cardImageSource(product).url) issues.push("photo");
  if (!String(product.description || "").trim()) issues.push("description");
  const category = hierarchy.categories.find((v) => (v.categoryId || v.id) === product.categoryId);
  const sub = hierarchy.subcategories.find((v) => (v.subcategoryId || v.id) === product.subcategoryId);
  const leaf = hierarchy.subSubcategories.find((v) => (v.subSubcategoryId || v.id) === product.subSubcategoryId);
  if (!category || category.active === false || category.archived || product.subcategoryId && (!sub || sub.categoryId !== product.categoryId || sub.active === false || sub.archived) || product.subSubcategoryId && (!sub || !leaf || leaf.subcategoryId !== product.subcategoryId || leaf.categoryId !== product.categoryId || leaf.active === false || leaf.archived)) issues.push("classification");
  if (!hasSellingPrice(product) && !requiresPricingInquiry(product)) issues.push("pricing");
  const group = product.productGroupId ? products.filter((v) => v.productGroupId === product.productGroupId) : [];
  if (product.variantEnabled || group.length) {
    const keys = group.map(variantCombinationKey);
    const managed = product.variantManaged === true;
    let invalid = !product.productGroupId || !group.length || group.some((v) => deepestCategory(v) !== deepestCategory(product)) || keys.some((v) => !v) || new Set(keys).size !== keys.length;
    if (managed && !invalid) {
      const state = editorVariantState(product, products);
      invalid = Boolean(planVariantGroup({ ...state, create: false }, product, products).error);
    }
    if (invalid) issues.push("variants");
  }
  return { id: product.id, issues, quote: requiresPricingInquiry(product), ready: !issues.length };
}
export const builtInProductViews = [
  ["all", "All products"], ["photo", "Missing photos"], ["pricing", "Awaiting pricing"],
  ["quote", "Quote products"], ["description", "Missing descriptions"], ["classification", "Classification issues"], ["variants", "Variant issues"],
];
export function matchesReadiness(readiness, filter) { return !filter || filter === "all" || (filter === "quote" ? readiness.quote : readiness.issues.includes(filter)); }
export function normalizeProductView(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Choose valid view filters.");
  const query = String(value.query || "").trim();
  const category = String(value.category || "all");
  const status = String(value.status || "all");
  const readiness = String(value.readiness || "all");
  if (query.length > 160 || category.length > 250 || !["all", "priced", "needs-pricing", "low", "archived", "active", "inactive", "quote"].includes(status) || !builtInProductViews.some(([key]) => key === readiness)) throw new Error("Choose valid view filters.");
  return { query, category, status, readiness };
}
export function waitingLabel(createdAt, now = Date.now()) {
  const date = new Date(createdAt).getTime();
  if (!Number.isFinite(date)) return "Time unavailable";
  const minutes = Math.max(0, Math.floor((now - date) / 60000));
  return minutes < 1 ? "Just received" : minutes < 60 ? `${minutes} min` : minutes < 1440 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${Math.floor(minutes / 1440)}d ${Math.floor(minutes % 1440 / 60)}h`;
}
