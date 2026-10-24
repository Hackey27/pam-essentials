import { NextResponse } from "next/server";
import { adminDb, requireRole } from "@/lib/admin";
import { serializeDoc } from "@/lib/productData";
import { categoryLabels, loadHierarchy } from "@/lib/categoryHierarchy";
import { documentVersion } from "@/lib/documentVersion.mjs";
import { requiresPricingInquiry } from "@/lib/productPricing.mjs";
import { currentShopAddress } from "@/lib/shopAddress.mjs";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const access = await requireRole(request, ["owner", "admin", "supervisor"]);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });

  const store = adminDb();
  const isAdmin = ["owner", "admin"].includes(access.user.role);
  const [productsSnap, ordersSnap, movementsSnap, hierarchy, discountsSnap, settingsSnap, usersSnap, auditSnap, salesSnap, expensesSnap, dealsSnap, orderRulesSnap] = await Promise.all([
    store.collection("products").get(),
    store.collection("orders").get(),
    store.collection("stock_movements").orderBy("createdAt", "desc").limit(100).get(),
    loadHierarchy(store),
    isAdmin ? store.collection("discount_rules").get() : Promise.resolve({ docs: [] }),
    isAdmin ? store.collection("settings").get() : Promise.resolve({ docs: [] }),
    isAdmin ? store.collection("users").get() : Promise.resolve({ docs: [] }),
    isAdmin ? store.collection("admin_audit").orderBy("timestamp", "desc").limit(100).get() : Promise.resolve({ docs: [] }),
    isAdmin ? store.collection("sales").orderBy("createdAt", "desc").limit(500).get() : Promise.resolve({ docs: [] }),
    isAdmin ? store.collection("expenses").orderBy("createdAt", "desc").get() : Promise.resolve({ docs: [] }),
    isAdmin ? store.collection("deal_bundles").get() : Promise.resolve({ docs: [] }),
    isAdmin ? store.collection("order_discount_rules").get() : Promise.resolve({docs:[]}),
  ]);

  if(expensesSnap.docs.length>50000)return NextResponse.json({error:"Expense dataset exceeds the reporting limit; no partial expense total was generated."},{status:409});
  const fullProducts = productsSnap.docs.map((doc) => ({ ...serializeDoc(doc), editVersion: documentVersion(doc) })).map((product) => ({ ...product, ...categoryLabels(product, hierarchy) })).sort((a, b) => a.name.localeCompare(b.name));
  const products = isAdmin ? fullProducts : fullProducts.map(({ costPrice, wholesalePackPrice, accountingStockValueCents, accountingStockQuantity, ...product }) => product);
  const orders = ordersSnap.docs.map(serializeDoc).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const movements = movementsSnap.docs.map(serializeDoc);
  const { categories, subcategories, subSubcategories } = hierarchy;
  const discounts = [...discountsSnap.docs,...orderRulesSnap.docs].map(serializeDoc).map((rule) => ({ ...rule, startDate: rule.startDate?.toDate?.()?.toISOString?.() || rule.startDate || null, endDate: rule.endDate?.toDate?.()?.toISOString?.() || rule.endDate || null })).sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));
  const settings = Object.fromEntries(settingsSnap.docs.map((doc) => [doc.id, serializeDoc(doc)]));
  if (settings.STORE_LOCATION) settings.STORE_LOCATION.value = currentShopAddress(settings.STORE_LOCATION.value);
  const users = usersSnap.docs.map(serializeDoc).map(({ email = "", displayName = "", role = "", active = true, id }) => ({ id, email, displayName, role, active }));
  const audit = auditSnap.docs.map((doc) => ({ ...serializeDoc(doc), timestamp: doc.data().timestamp?.toDate?.()?.toISOString?.() || doc.data().timestamp || null }));
  const sales = salesSnap.docs.map(serializeDoc);
  const expenses = expensesSnap.docs.map(serializeDoc);
  const dealBundles = dealsSnap.docs.map(serializeDoc).map((deal) => ({ ...deal, aggregatePrice: Math.round((deal.productIds || []).reduce((sum, id) => sum + Number(fullProducts.find((product) => product.id === id)?.price || 0), 0) * 100) / 100 }));

  const metrics = {
    products: fullProducts.length,
    active: fullProducts.filter((p) => p.active !== false && !p.archived && Number(p.price) > 0).length,
    needsPricing: fullProducts.filter((p) => !(Number(p.price) > 0) && !requiresPricingInquiry(p)).length,
    quoteProducts: fullProducts.filter(requiresPricingInquiry).length,
    lowStock: fullProducts.filter((p) => Number(p.price) > 0 && Number(p.stock) > 0 && Number(p.stock) <= Number(p.lowStockLevel || 8)).length,
    outOfStock: fullProducts.filter((p) => Number(p.price) > 0 && Number(p.stock) <= 0).length,
    openOrders: orders.filter((o) => !["completed", "cancelled"].includes(o.status)).length,
  };
  if (isAdmin) {
    metrics.sales = sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
    metrics.profit = sales.reduce((sum, sale) => sum + Number(sale.profit || 0), 0);
    metrics.transactions = sales.filter(sale => sale.saleType !== "reversal").length;
    metrics.reversals = sales.filter(sale => sale.saleType === "reversal").length;
    metrics.unitsSold = sales.reduce((sum, sale) => sum + (sale.items || []).reduce((qty, item) => qty + Number(item.quantity || 0), 0), 0);
    metrics.stockValuation = fullProducts.reduce((sum, product) => sum + (Number.isSafeInteger(product.accountingStockValueCents) && product.accountingStockQuantity === Number(product.stock || 0) ? product.accountingStockValueCents / 100 : Number(product.stock || 0) * Number(product.costPrice || 0)), 0);
    metrics.expenses = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    metrics.netProfit = metrics.profit - metrics.expenses;
  }

  return NextResponse.json({ products, orders, movements, categories, subcategories, subSubcategories, discounts, dealBundles, settings, users, audit, sales, expenses, metrics, permissions: { isAdmin } });
}

