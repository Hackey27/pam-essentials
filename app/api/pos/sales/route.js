import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb, requireRole } from "@/lib/admin";
import { availableForSale, catalogueContext, priceCart } from "@/lib/commerce";
import { SHOP_ADDRESS } from "@/lib/shop";
import { receiptSnapshot } from "@/lib/receiptData.mjs";

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
      if (existing.exists) {
        const sale = existing.data();
        return { ...receiptSnapshot({ ...sale, createdAt: sale.createdAt?.toDate?.()?.toISOString?.() || null }), duplicate: true };
      }
      const shiftRef = store.collection("shifts").doc(shiftId);
      const shiftSnap = await tx.get(shiftRef);
      if (!shiftSnap.exists || shiftSnap.data().status !== "open" || shiftSnap.data().staffId !== access.user.uid) throw new Error("This till shift is no longer open.");

      const normalizedItems = [...quantities].map(([id, quantity]) => ({ id, quantity }));
      const salesChannel = ["walk-in", "website", "whatsapp", "phone"].includes(body.salesChannel) ? body.salesChannel : "walk-in";
      const orderReference = String(body.orderReference || "").trim().slice(0, 100) || null;
      const customerName = String(body.customerName || "").trim().slice(0, 120);
      const customerPhone = String(body.customerPhone || "").trim().slice(0, 40);
      if (["website", "whatsapp"].includes(salesChannel) && !(orderReference || (customerName && customerPhone))) throw new Error("Website and WhatsApp sales need an order reference or customer name and phone.");
      const productRefs = normalizedItems.map(({ id }) => store.collection("products").doc(encodeURIComponent(id)));
      const productSnaps = await tx.getAll(...productRefs);
      const linkedOrderSnap = orderReference ? await tx.get(store.collection("orders").doc(orderReference)) : null;
      const receiptDay = new Date().toISOString().slice(2, 10).replaceAll("-", "");
      const sequenceRef = store.collection("receipt_sequences").doc(receiptDay);
      const sequenceSnap = await tx.get(sequenceRef);
      const receiptNumber = Number(sequenceSnap.data()?.lastNumber || 0) + 1;
      const receiptId = `PAM-${receiptDay}-${String(receiptNumber).padStart(4, "0")}`;
      if (salesChannel === "website" && orderReference && !linkedOrderSnap.exists) throw new Error("The linked website order no longer exists.");
      const linkedOrder = linkedOrderSnap?.data();
      for (let index = 0; index < normalizedItems.length; index += 1) {
        const snap = productSnaps[index];
        const quantity = normalizedItems[index].quantity;
        if (!snap.exists) throw new Error("A selected product no longer exists.");
        if (!availableForSale(snap.data(), context)) throw new Error(`${snap.data().name} is not available for sale.`);
        if (Number(snap.data().stock) < quantity) throw new Error(`Only ${snap.data().stock} × ${snap.data().name} remain.`);
      }
      const pricing = priceCart(productSnaps.map((snap, index) => ({ id: normalizedItems[index].id, categoryId: snap.data().categoryId, price: Number(snap.data().price), quantity: normalizedItems[index].quantity })), context.rules, context.deals);
      const lines = [];
      let cost = 0;

      for (let index = 0; index < normalizedItems.length; index += 1) {
        const item = normalizedItems[index];
        const productRef = productRefs[index];
        const snap = productSnaps[index];
        const product = snap.data();
        const quantity = item.quantity;
        const priced = pricing.lines[index];
        const netLineTotal = priced.lineTotal;
        const lineCost = Math.round(Number(product.costPrice || 0) * quantity * 100) / 100;
        cost += lineCost;
        lines.push({
          productId: product.id,
          productGroupId: product.productGroupId || "",
          variantId: product.productGroupId ? product.id : "",
          sku: product.id,
          colour: product.colour || "",
          size: product.size || "",
          name: product.name,
          quantity,
          unitPrice: Number(product.price),
          lineTotal: netLineTotal,
          unitCost: Number(product.costPrice || 0),
          lineCost,
          lineProfit: Math.round((netLineTotal - lineCost) * 100) / 100,
          categorySnapshot: { id: product.categoryId, name: product.category },
          discountRuleSnapshot: priced.rule ? { ruleId: priced.rule.ruleId, name: priced.rule.name, amount: priced.ruleDiscountCents / 100 } : null,
          dealBundleSnapshot: priced.dealIds.length ? { dealIds: priced.dealIds, amount: priced.dealDiscountCents / 100 } : null,
        });
        tx.update(productRef, { stock: Number(product.stock) - quantity, ...(salesChannel === "walk-in" ? { purchaseCount: FieldValue.increment(quantity) } : {}), updatedAt: FieldValue.serverTimestamp() });
        tx.create(store.collection("stock_movements").doc(), {
          type: "sale",
          productId: product.id,
          productName: product.name,
          quantity: -quantity,
          qtyChange: -quantity,
          oldStock: Number(product.stock),
          newStock: Number(product.stock) - quantity,
          saleId: transactionId,
          reason: "POS sale",
          staff: access.user.uid,
          staffEmail: access.user.email,
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      const total = pricing.total;
      const paymentMethod = ["cash", "mobile-money", "card", "bank-transfer"].includes(body.paymentMethod) ? body.paymentMethod : "cash";
      if (paymentMethod !== "cash" && body.transactionVerified !== true) throw new Error("Confirm the payment provider notification before completing this sale.");
      const tendered = Number(body.amountPaid);
      if (!Number.isFinite(tendered) || tendered < total) throw new Error("Amount paid cannot be less than the sale total.");
      const change = Math.round((tendered - total) * 100) / 100;
      tx.set(sequenceRef, { lastNumber: receiptNumber, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      const saleData = {
        receiptId,
        clientTransactionId: transactionId,
        items: lines,
        subtotal: pricing.subtotal,
        discount: pricing.discount,
        total,
        cost,
        profit: total - cost,
        paymentMethod,
        amountPaid: tendered,
        change,
        salesChannel,
        orderReference,
        customerName,
        customerPhone,
        fulfilmentSnapshot: { deliveryMethod: linkedOrder?.deliveryMethod || "pickup", originAddress: linkedOrder?.originAddress || SHOP_ADDRESS, deliveryAddress: linkedOrder?.deliveryAddress || linkedOrder?.landmark || "" },
        taxSnapshot: { enabled: false },
        staffId: access.user.uid,
        staffEmail: access.user.email,
        shiftId,
        deviceId,
        createdAt: FieldValue.serverTimestamp(),
      };
      tx.create(saleRef, saleData);
      if (shiftSnap.data().aggregationVersion === 1) tx.update(shiftRef, { transactionCount: FieldValue.increment(1), salesTotal: FieldValue.increment(total), [`paymentMix.${paymentMethod}`]: FieldValue.increment(total) });
      return { ...receiptSnapshot({ ...saleData, createdAt: new Date().toISOString() }), duplicate: false };
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error.message || "Checkout failed." }, { status: 409 });
  }
}

