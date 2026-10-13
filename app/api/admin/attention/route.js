import { NextResponse } from "next/server";
import { adminDb, requireRole } from "@/lib/admin";
import { serializeDoc } from "@/lib/productData";
import { publicReview } from "@/lib/productReviews.mjs";
export const dynamic = "force-dynamic";
const pick = (value, fields) => Object.fromEntries(fields.map((key) => [key, value[key] ?? ""]));
function record(section, doc) {
  const v = serializeDoc(doc);
  if (section === "Orders") return { ...v, id: doc.id, orderId: v.orderId || doc.id };
  if (section === "Reviews") return { ...publicReview(doc.id, doc.data()), productId: v.productId, sku: v.sku, status: v.status, reason: v.reason || "", revision: v.revision, moderatedBy: v.moderatedBy || "", moderatedAt: v.moderatedAt || null };
  if (section === "Inquiries") return { id: doc.id, ...pick(v, ["reference", "productId", "productName", "sku", "category", "name", "phone", "email", "measurements", "message", "status", "internalNotes", "updatedBy", "createdAt", "updatedAt"]), variantOptions: v.variantOptions || {}, quantity: v.quantity || 1 };
  return { id: doc.id, ...pick(v, ["reference", "name", "phone", "email", "productName", "description", "measurements", "preferences", "productLink", "preferredDate", "status", "internalNotes", "quotation", "updatedBy", "createdAt", "updatedAt"]), quantity: v.quantity || 1, allowAlternatives: v.allowAlternatives === true, budget: v.budget ?? null, quoteTotal: v.quoteTotal ?? null, imageCount: v.imageIds?.length || 0 };
}
export async function GET(request) {
  const access = await requireRole(request, ["owner", "admin", "supervisor"]);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  const definitions = [{ section: "Orders", title: "New orders", collection: "orders", statuses: ["pending"] },
    ...(["owner", "admin"].includes(access.user.role) ? [
      { section: "Inquiries", title: "Unanswered inquiries", collection: "inquiries", statuses: ["new"] },
      { section: "Product Requests", title: "Sourcing requests", collection: "product_requests", statuses: ["new", "checking-availability"] },
      { section: "Reviews", title: "Pending reviews", collection: "product_reviews", statuses: ["pending"] },
    ] : [])];
  try {
    const store = adminDb();
    const queues = await Promise.all(definitions.map(async (definition) => {
      const matches = await Promise.all(definition.statuses.map((status) => store.collection(definition.collection).where("status", "==", status).get()));
      const rows = matches.flatMap((snap) => snap.docs).map((doc) => {
        const entry = record(definition.section, doc);
        return { ...entry, waitingSince: definition.section === "Reviews" ? entry.updatedAt || entry.createdAt : entry.createdAt };
      }).sort((a, b) => (new Date(a.waitingSince).getTime() || Infinity) - (new Date(b.waitingSince).getTime() || Infinity));
      return { section: definition.section, title: definition.title, count: rows.length, oldestAt: rows[0]?.waitingSince || null, records: rows.slice(0, 5) };
    }));
    return NextResponse.json({ queues, updatedAt: new Date().toISOString() }, { headers: { "cache-control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "The attention inbox could not be refreshed. Previous counts may be out of date." }, { status: 503 }); }
}
