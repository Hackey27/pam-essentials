import { NextResponse } from "next/server";
import { adminDb, requireRole } from "@/lib/admin";
import { serializeDoc } from "@/lib/productData";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const access = await requireRole(request, ["owner", "admin", "supervisor"]);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });

  const store = adminDb();
  const isAdmin = ["owner", "admin"].includes(access.user.role);
  const [productsSnap, ordersSnap, movementsSnap, categoriesSnap, discountsSnap, settingsSnap, usersSnap, auditSnap, salesSnap, expensesSnap] = await Promise.all([
    store.collection("products").get(),
    store.collection("orders").get(),
    store.collection("stock_movements").orderBy("createdAt", "desc").limit(100).get(),
    store.collection("categories").get(),
    isAdmin ? store.collection("discount_rules").get() : Promise.resolve({ docs: [] }),
    isAdmin ? store.collection("settings").get() : Promise.resolve({ docs: [] }),
    isAdmin ? store.collection("users").get() : Promise.resolve({ docs: [] }),
    isAdmin ? store.collection("admin_audit").orderBy("timestamp", "desc").limit(100).get() : Promise.resolve({ docs: [] }),
    isAdmin ? store.collection("sales").orderBy("createdAt", "desc").limit(500).get() : Promise.resolve({ docs: [] }),
    isAdmin ? store.collection("expenses").orderBy("createdAt", "desc").limit(500).get() : Promise.resolve({ docs: [] }),
  ]);

  const fullProducts = productsSnap.docs.map(serializeDoc).sort((a, b) => a.name.localeCompare(b.name));
  const products = isAdmin ? fullProducts : fullProducts.map(({ costPrice, wholesalePackPrice, ...product }) => product);
  const orders = ordersSnap.docs.map(serializeDoc).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const movements = movementsSnap.docs.map(serializeDoc);
  const categories = categoriesSnap.docs.map(serializeDoc).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
  const discounts = discountsSnap.docs.map(serializeDoc).sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));
  const settings = Object.fromEntries(settingsSnap.docs.map((doc) => [doc.id, serializeDoc(doc)]));
  const users = usersSnap.docs.map(serializeDoc).map(({ email = "", displayName = "", role = "", active = true, id }) => ({ id, email, displayName, role, active }));
  const audit = auditSnap.docs.map(serializeDoc);
  const sales = salesSnap.docs.map(serializeDoc);
  const expenses = expensesSnap.docs.map(serializeDoc);

  const metrics = {
    products: fullProducts.length,
    active: fullProducts.filter((p) => p.active !== false && !p.archived && Number(p.price) > 0).length,
    needsPricing: fullProducts.filter((p) => !(Number(p.price) > 0)).length,
    lowStock: fullProducts.filter((p) => Number(p.price) > 0 && Number(p.stock) > 0 && Number(p.stock) <= Number(p.lowStockLevel || 8)).length,
    outOfStock: fullProducts.filter((p) => Number(p.price) > 0 && Number(p.stock) <= 0).length,
    openOrders: orders.filter((o) => !["completed", "cancelled"].includes(o.status)).length,
  };
  if (isAdmin) {
    metrics.sales = sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
    metrics.profit = sales.reduce((sum, sale) => sum + Number(sale.profit || 0), 0);
    metrics.transactions = sales.length;
    metrics.unitsSold = sales.reduce((sum, sale) => sum + (sale.items || []).reduce((qty, item) => qty + Number(item.quantity || 0), 0), 0);
    metrics.stockValuation = fullProducts.reduce((sum, product) => sum + Number(product.stock || 0) * Number(product.costPrice || 0), 0);
    metrics.expenses = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    metrics.netProfit = metrics.profit - metrics.expenses;
  }

  return NextResponse.json({ products, orders, movements, categories, discounts, settings, users, audit, sales, expenses, metrics, permissions: { isAdmin } });
}
