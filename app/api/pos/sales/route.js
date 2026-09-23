import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb, requireRole } from "@/lib/admin";
import { availableForSale, catalogueContext, resolveDiscount } from "@/lib/commerce";

export async function POST(request) {
  const access = await requireRole(request, ["owner", "admin", "supervisor", "cashier"]);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await request.json().catch(() => ({}));
  const requested = Array.isArray(body.items) ? body.items : [];
  if (!requested.length) return NextResponse.json({ error: "Add at least one product." }, { status: 400 });

  const quantities = new Map();
  for (const item of requested) {
    const id = String(item.id || "").trim();
    const quantity = Math.floor(Number(item.quantity));
    if (!id || !Number.isFinite(quantity) || quantity < 1 || quantity > 999) {
      return NextResponse.json({ error: "Each sale item needs a valid product and quantity." }, { status: 400 });
    }
    const combinedQuantity = (quantities.get(id) || 0) + quantity;
    if (combinedQuantity > 999) {
      return NextResponse.json({ error: "A sale cannot contain more than 999 of one product." }, { status: 400 });
    }
    quantities.set(id, combinedQuantity);
  }

  const transactionId = String(body.transactionId || "").trim();
  if (!transactionId) return NextResponse.json({ error: "A transaction ID is required." }, { status: 400 });
  const shiftId = String(body.shiftId || "").trim();
  const deviceId = String(body.deviceId || "").trim().slice(0, 120);
  if (!shiftId || !deviceId) return NextResponse.json({ error: "Open a till shift before checkout." }, { status: 409 });

  const store = adminDb();
  const context = await catalogueContext(store);
  const saleRef = store.collection("sales").doc(transactionId);

  try {
    const result = await store.runTransaction(async (tx) => {
      const existing = await tx.get(saleRef);
      if (existing.exists) return { receiptId: existing.data().receiptId, duplicate: true };
      const shiftRef = store.collection("shifts").doc(shiftId);
      const shiftSnap = await tx.get(shiftRef);
      if (!shiftSnap.exists || shiftSnap.data().status !== "open" || shiftSnap.data().staffId !== access.user.uid) throw new Error("This till shift is no longer open.");

      const normalizedItems = [...quantities].map(([id, quantity]) => ({ id, quantity }));
      const productRefs = normalizedItems.map(({ id }) => store.collection("products").doc(encodeURIComponent(id)));
      const productSnaps = await tx.getAll(...productRefs);
      const lines = [];
      let subtotal = 0;
      let discount = 0;
      let cost = 0;

      for (let index = 0; index < normalizedItems.length; index += 1) {
        const item = normalizedItems[index];
        const productRef = productRefs[index];
        const snap = productSnaps[index];
        if (!snap.exists) throw new Error("A selected product no longer exists.");
        const product = snap.data();
        const quantity = item.quantity;
        if (!availableForSale(product, context.activeCategoryIds)) throw new Error(`${product.name} is not available for sale.`);
        if (Number(product.stock) < quantity) throw new Error(`Only ${product.stock} × ${product.name} remain.`);

        const lineTotal = Number(product.price) * quantity;
        const applied = resolveDiscount(product, quantity, context.rules);
        subtotal += lineTotal;
        discount += applied.amount;
        cost += Number(product.costPrice || 0) * quantity;
        lines.push({
          productId: product.id,
          name: product.name,
          quantity,
          unitPrice: Number(product.price),
          lineTotal: Math.round((lineTotal - applied.amount) * 100) / 100,
          categorySnapshot: { id: product.categoryId, name: product.category },
          discountRuleSnapshot: applied.rule ? { ruleId: applied.rule.ruleId, name: applied.rule.name, amount: applied.amount } : null,
        });
        tx.update(productRef, { stock: Number(product.stock) - quantity, updatedAt: FieldValue.serverTimestamp() });
      }

      const receiptId = `PAM-${Date.now().toString(36).toUpperCase()}`;
      const total = Math.round((subtotal - discount) * 100) / 100;
      tx.create(saleRef, {
        receiptId,
        clientTransactionId: transactionId,
        items: lines,
        subtotal: Math.round(subtotal * 100) / 100,
        discount: Math.round(discount * 100) / 100,
        total,
        cost,
        profit: total - cost,
        paymentMethod: body.paymentMethod || "cash",
        amountPaid: Number(body.amountPaid || total),
        change: Math.max(0, Number(body.amountPaid || total) - total),
        salesChannel: body.salesChannel || "walk-in",
        staffId: access.user.uid,
        staffEmail: access.user.email,
        shiftId,
        deviceId,
        createdAt: FieldValue.serverTimestamp(),
      });
      return { receiptId, total, duplicate: false };
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error.message || "Checkout failed." }, { status: 409 });
  }
}
