import test from "node:test";
import assert from "node:assert/strict";
import { findRuleOverlaps, findDealOverlaps } from "../lib/discountOverlap.mjs";

const products = [
  { id: "A", categoryId: "school" },
  { id: "B", categoryId: "school" },
  { id: "C", categoryId: "home" },
];
const globalRule = { ruleId: "BULK", name: "Bulk 5%", scopeType: "GLOBAL", active: true };

test("rule overlap respects scope, dates, and archived status", () => {
  const draft = { ruleId: "PROMO", name: "School promo", scopeType: "CATEGORY", scopeId: "school", active: true, startDate: "2026-10-01", endDate: "2026-10-31" };
  const rules = [
    globalRule,
    { ruleId: "HOME", name: "Home", scopeType: "CATEGORY", scopeId: "home", active: true },
    { ruleId: "OLD", name: "Old", scopeType: "PRODUCT", scopeId: "A", active: true, endDate: "2026-09-30" },
    { ruleId: "ARCHIVED", name: "Archived", scopeType: "PRODUCT", scopeId: "A", archived: true },
  ];
  const deals = [{ dealId: "DEAL", name: "School deal", productIds: ["A", "C"], active: true }];
  assert.deepEqual(findRuleOverlaps(draft, rules, deals, products).map(({ id }) => id), ["BULK", "DEAL"]);
  assert.deepEqual(findRuleOverlaps({ ...draft, archived: true }, rules, deals, products), []);
});

test("bundle overlap sees shared products and eligible rules", () => {
  const draft = { dealId: "NEW", name: "New deal", productIds: ["A", "C"], active: true };
  const deals = [
    { dealId: "OTHER", name: "Other", productIds: ["A", "B"], active: true },
    { dealId: "SEPARATE", name: "Separate", productIds: ["B"], active: true },
  ];
  assert.deepEqual(findDealOverlaps(draft, deals, [globalRule], products).map(({ id }) => id), ["OTHER", "BULK"]);
  assert.deepEqual(findDealOverlaps({ ...draft, active: false }, deals, [globalRule], products), []);
});
