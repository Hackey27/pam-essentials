import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb, requireRole } from "@/lib/admin";
import { auditPayload, text } from "@/lib/serverData";
import { serializeDoc } from "@/lib/productData";
import { documentVersion } from "@/lib/documentVersion.mjs";
import { splitTax } from "@/lib/accounting.mjs";
import { priceHistoryReport, priceHistoryCsv, priceValues } from "@/lib/priceHistory.mjs";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const json = (value, status = 200) => NextResponse.json(value, { status, headers });
const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
async function complete(store, collection) {
  const snap = await store.collection(collection).limit(50001).get();
  if (snap.docs.length > 50000) throw new Error("This dataset needs paginated reporting. No partial history or comparison was returned.");
  return snap.docs.map(serializeDoc);
}
export async function GET(request) {
  const access = await requireRole(request, ["owner", "admin"]);
  if (access.error) return json({ error: access.error }, access.status);
  try {
    const store = adminDb(), url = new URL(request.url), now = new Date().toISOString();
    const [products, audit, sales, baselines, settings] = await Promise.all([
      complete(store, "products"), complete(store, "admin_audit"), complete(store, "sales"), complete(store, "product_price_baselines"), store.collection("accounting_settings").doc("config").get(),
    ]);
    products.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    if (!products.length) return json({ empty: true, products: [], updatedAt: now });
    const id = url.searchParams.get("productId"), product = id ? products.find(p => p.id === id) : products[0];
    if (!product) return json({ error: "Product not found. Refresh the product list." }, 404);
    const custom = url.searchParams.has("beforeStart") ? Object.fromEntries(["beforeStart", "beforeEnd", "afterStart", "afterEnd"].map(k => [k, url.searchParams.get(k)])) : undefined;
    const netPrice = product.price == null ? null : splitTax(Number(product.price), settings.data()?.tax || { enabled: false }, now.slice(0, 10), product.taxExempt === true, "inclusive").net / 100;
    const report = priceHistoryReport({ product, products, audit, sales, baselines, now, netPrice, custom, days: Number(url.searchParams.get("days") || 30), changeId: url.searchParams.get("changeId") || undefined });
    report.coverage = { products: products.length, sales: sales.length, audit: audit.length, complete: true };
    if (url.searchParams.get("format") === "csv") return new Response(priceHistoryCsv(report), { headers: { ...headers, "Content-Type": "text/csv;charset=utf-8", "Content-Disposition": 'attachment; filename="pam-price-cost-history.csv"', "X-Content-Type-Options": "nosniff" } });
    return json(report);
  } catch (error) { return json({ error: error.message || "Price history could not be loaded." }, 409); }
}

// Baselines are private, immutable reference records. They do not change prices,
// stock, financial postings or any existing product document.
export async function POST(request) {
  const access = await requireRole(request, ["owner", "admin"]);
  if (access.error) return json({ error: access.error }, access.status);
  const b = await request.json().catch(() => ({}));
  if (!["preview", "apply"].includes(b.mode)) return json({ error: "Preview the baseline before preserving it." }, 400);
  const reason = text(b.reason, 500);
  if (reason.length < 3) return json({ error: "Enter a reason for preserving these baseline values." }, 400);
  if (b.mode === "apply" && (!/^[a-z0-9-]{36}$/i.test(b.requestId || "") || !/^[a-f0-9]{64}$/i.test(b.previewHash || ""))) return json({ error: "Refresh the baseline preview." }, 400);
  try {
    const store = adminDb();
    const result = await store.runTransaction(async tx => {
      const requestRef = b.mode === "apply" ? store.collection("price_history_requests").doc(b.requestId) : null;
      const old = requestRef ? await tx.get(requestRef) : null;
      if (old?.exists) {
        if (old.data().staffId !== access.user.uid || old.data().previewHash !== b.previewHash || old.data().requestFingerprint !== hash({ reason, productId: b.productId || "" })) throw new Error("This request reference belongs to another preview.");
        return { ...old.data().result, duplicate: true };
      }
      const [products, baselines] = await Promise.all([tx.get(store.collection("products").limit(50001)), tx.get(store.collection("product_price_baselines").limit(50001))]);
      if (products.docs.length > 50000 || baselines.docs.length > 50000) throw new Error("Catalogue exceeds the baseline coverage limit. Nothing was preserved.");
      const saved = new Set(baselines.docs.map(d => d.data().productId));
      const candidates = products.docs.filter(d => !saved.has(d.data().id || decodeURIComponent(d.id)) && (!b.productId || (d.data().id || decodeURIComponent(d.id)) === b.productId)).sort((a, b) => a.id.localeCompare(b.id));
      const selected = candidates.slice(0, 400);
      const rows = selected.map(d => ({ productId: d.data().id || decodeURIComponent(d.id), sku: d.data().sku || d.data().id || decodeURIComponent(d.id), name: d.data().name || d.id, values: priceValues(d.data()), version: documentVersion(d) }));
      const previewHash = hash({ rows, reason, productId: b.productId || "", remaining: candidates.length - rows.length });
      const preview = { rows, count: rows.length, remaining: candidates.length - rows.length, previewHash };
      if (b.mode === "preview") return preview;
      if (previewHash !== b.previewHash) throw new Error("Catalogue values changed. Preview again; no baseline was saved.");
      for (const row of rows) tx.create(store.collection("product_price_baselines").doc(hash(row.productId)), { ...row, reason, staffId: access.user.uid, staffName: access.user.displayName || access.user.email, createdAt: FieldValue.serverTimestamp(), immutable: true });
      const response = { ok: true, preserved: rows.length, remaining: preview.remaining };
      tx.create(requestRef, { staffId: access.user.uid, previewHash, requestFingerprint: hash({ reason, productId: b.productId || "" }), result: response, createdAt: FieldValue.serverTimestamp() });
      tx.create(store.collection("admin_audit").doc(), auditPayload(access.user, "PRESERVE_PRICE_BASELINES", "price_history", b.requestId, reason, null, { preserved: rows.length, remaining: preview.remaining }));
      return response;
    });
    return json(result);
  } catch (error) { return json({ error: error.message || "Baseline could not be preserved. Your catalogue is unchanged." }, 409); }
}
