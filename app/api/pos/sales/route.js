import {wholesaleAvailableUnits,packingIssue} from "@/lib/wholesaleUnits.mjs";
import { pricePurchaseCart, purchaseType } from "@/lib/wholesale.mjs";
import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb, requireRole } from "@/lib/admin";
import { availableForSale, availableForWholesale, catalogueContext, priceCart } from "@/lib/commerce";
import { CURRENT_SHOP_ADDRESS } from "@/lib/shopAddress.mjs";
import { receiptSnapshot } from "@/lib/receiptData.mjs";
import { offlineReceiptId } from "@/lib/offlineSale.mjs";
import { managerRoles, capturedPricing, posRoles } from "@/lib/posOperations.mjs";
import { auditPayload, text } from "@/lib/serverData";
import { accountingContext, postSource } from "@/lib/accountingServer";
import { saleJournal, saleTax, productBook, today } from "@/lib/accounting.mjs";

export async function GET(request) {
  const access = await requireRole(request, posRoles);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  const id = text(new URL(request.url).searchParams.get("transactionId"), 120);
  if (!id || id.includes("/")) return NextResponse.json({ error: "Transaction reference is required." }, { status: 400 });
  const snap = await adminDb().collection("sales").doc(id).get();
  if (!snap.exists) return NextResponse.json({ found: false }, { headers: { "Cache-Control": "private, no-store" } });
  if (snap.data().staffId !== access.user.uid && !managerRoles.includes(access.user.role)) return NextResponse.json({ error: "This transaction belongs to another staff member." }, { status: 403 });
  return NextResponse.json({ found: true, receipt: receiptSnapshot({ ...snap.data(), id: snap.id, createdAt: snap.data().createdAt?.toDate?.()?.toISOString?.() || null }) }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request) {
  const access = await requireRole(request, ["owner", "admin", "supervisor", "cashier"]);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await request.json().catch(() => ({}));
  const reconciliation = body.reconciliation;
  if (reconciliation && !managerRoles.includes(access.user.role)) return NextResponse.json({ error: "Only an owner or admin may reconcile an offline sale." }, { status: 403 });
  if (reconciliation && (body.offlineFinal !== true || !text(reconciliation.reason, 500) || reconciliation.confirmCaptured !== true)) return NextResponse.json({ error: "Confirm the captured receipt and give a reconciliation reason." }, { status: 400 });
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
  if (!/^[A-Za-z0-9-]{1,120}$/.test(transactionId)) return NextResponse.json({ error: "A valid transaction ID is required." }, { status: 400 });
  const offlineFinal = body.offlineFinal === true;
  if (offlineFinal && (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(transactionId) || !Number.isFinite(Number(body.offlineTotal)))) return NextResponse.json({ error: "Offline sale needs a valid transaction ID and captured total." }, { status: 400 });
  const shiftId = String(body.shiftId || "").trim();
  if (reconciliation && reconciliation.receipt?.receiptId !== offlineReceiptId(transactionId)) return NextResponse.json({ error: "Captured receipt number does not match the offline transaction." }, { status: 400 });
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
        if (sale.staffId !== access.user.uid && !managerRoles.includes(access.user.role)) throw new Error("This transaction belongs to another staff member.");
        return { ...receiptSnapshot({ ...sale, createdAt: sale.createdAt?.toDate?.()?.toISOString?.() || null }), duplicate: true };
      }
      const shiftRef = store.collection("shifts").doc(shiftId);
      const shiftSnap = await tx.get(shiftRef);
      if (!shiftSnap.exists || shiftSnap.data().status !== "open" || (!reconciliation && shiftSnap.data().staffId !== access.user.uid)) throw new Error("This till shift is no longer open.");

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
      const sequenceSnap = offlineFinal ? null : await tx.get(sequenceRef);
      const receiptNumber = Number(sequenceSnap?.data()?.lastNumber || 0) + 1;
      const receiptId = offlineFinal ? offlineReceiptId(transactionId) : `PAM-${receiptDay}-${String(receiptNumber).padStart(4, "0")}`;
      if (salesChannel === "website" && orderReference && !linkedOrderSnap.exists) throw new Error("The linked website order no longer exists.");
      const linkedOrder = linkedOrderSnap?.data();
      const mode = purchaseType(reconciliation?.receipt?.purchaseType ?? linkedOrder?.purchaseType ?? body.purchaseType);
      if (mode === "wholesale" && requested.some(item=>!Number.isInteger(Number(item.quantity)))) throw new Error("Wholesale quantities must be whole individual units.");
      for (let index = 0; index < normalizedItems.length; index += 1) {
        const snap = productSnaps[index];
        const quantity = normalizedItems[index].quantity;
        if (!snap.exists) throw new Error("A selected product no longer exists.");
        if (!(mode === "wholesale" ? availableForWholesale(snap.data(),context) : availableForSale(snap.data(), context))) throw new Error(`${snap.data().name} is not available for sale.`);
        if(mode==="wholesale"&&!reconciliation){const issue=packingIssue(snap.data(),requested.find(item=>String(item.id||"").trim()===normalizedItems[index].id));if(issue)throw new Error(issue);}
        if(mode==="wholesale"&&quantity>wholesaleAvailableUnits(snap.data()))throw new Error("Wholesale quantity unavailable. Retail stock is protected.");
        if (Number(snap.data().stock) < quantity) throw new Error(`Only ${snap.data().stock} × ${snap.data().name} remain.`);
      }
      const currentPricing = pricePurchaseCart(productSnaps.map((snap,index)=>({...snap.data(),id:normalizedItems[index].id,quantity:normalizedItems[index].quantity})),context.rules,context.deals,mode,!reconciliation);
      if (mode === "wholesale" && !offlineFinal && (!Number.isFinite(Number(body.expectedTotal)) || Math.abs(Number(body.expectedTotal)-currentPricing.total)>.005)) throw new Error("Wholesale prices changed. Refresh the basket and confirm the new total.");
      const pricing = reconciliation ? capturedPricing(reconciliation.receipt, normalizedItems) : currentPricing;
      if (offlineFinal && Math.abs(pricing.total - Number(body.offlineTotal)) > 0.005) throw new Error("Offline total differs from current pricing. Keep the local receipt and ask a manager to reconcile this sale.");
      const accounting = await accountingContext(tx, store, today(), { type: "sale", id: transactionId });
      const taxSnapshot = reconciliation ? reconciliation.receipt.taxSnapshot || { enabled: false } : saleTax(pricing, productSnaps.map(s => s.data()), accounting.settings.tax, today());
      if (offlineFinal && !reconciliation) {
        const captured = body.offlineTaxSnapshot || { enabled: false };
        if (captured.enabled !== taxSnapshot.enabled || Boolean(captured.registered ?? captured.enabled) !== Boolean(taxSnapshot.registered) || captured.enabled && (Math.abs(Number(captured.tax) - taxSnapshot.tax) > 0.005 || JSON.stringify(captured.lines) !== JSON.stringify(taxSnapshot.lines))) throw new Error("Tax settings changed since this offline receipt was captured. Keep it queued and ask a manager to reconcile it.");
      }
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
        const inventoryBook = productBook(product, accounting.settings);
        const trackedCost = accounting.settings.active && accounting.settings.costing === "weighted-average" && Number.isSafeInteger(inventoryBook.value) && Number.isInteger(inventoryBook.quantity) && inventoryBook.quantity >= quantity;
        const lineCost = trackedCost ? Math.round(inventoryBook.value * quantity / inventoryBook.quantity) / 100 : Math.round(Number(product.costPrice || 0) * quantity * 100) / 100;
        cost += lineCost;
        lines.push({
          productId: product.id,
          productGroupId: product.productGroupId || "",
          variantId: product.productGroupId ? product.id : "",
          sku: product.sku || product.id,
          colour: product.colour || "",
          size: product.size || "",
          variantOptions: product.variantOptions || {},
          name: product.name,
          quantity,
          unitPrice: reconciliation ? priced.unitPrice : Number(priced.price),
          purchaseType: mode,
          ...(mode === "wholesale" ? { wholesaleSnapshot: reconciliation ? priced.wholesaleSnapshot || reconciliation.receipt.items.find(line=>(line.productId||line.id)===item.id)?.wholesaleSnapshot || null : priced.wholesaleSnapshot } : {}),
          lineTotal: netLineTotal,
          unitCost: Number(product.costPrice || 0),
          costRecorded: product.costPrice != null && (!accounting.settings.active || !Number.isInteger(inventoryBook.quantity) || inventoryBook.quantity >= quantity),
          lineCost,
          lineProfit: Math.round((netLineTotal - Number(taxSnapshot.productLines?.[index]?.tax || 0) - lineCost) * 100) / 100,
          categorySnapshot: { id: product.categoryId, name: product.category },
          discountRuleSnapshot: priced.rule ? { ruleId: priced.rule.ruleId, name: priced.rule.name, discountType: priced.rule.discountType, value: priced.rule.value, minQty: priced.rule.minQty, amount: priced.ruleDiscountCents / 100 } : null,
          dealBundleSnapshot: priced.dealIds.length ? { dealIds: priced.dealIds, amount: priced.dealDiscountCents / 100 } : null,
        });
        tx.update(productRef, { ...(accounting.settings.active && Number.isInteger(inventoryBook.quantity) ? { accountingStockQuantity: inventoryBook.quantity - quantity, accountingStockValueCents: Number.isSafeInteger(inventoryBook.value) ? inventoryBook.value - Math.round(lineCost * 100) : null } : {}), stock: Number(product.stock) - quantity, ...(salesChannel === "walk-in" ? { purchaseCount: FieldValue.increment(quantity) } : {}), updatedAt: FieldValue.serverTimestamp() });
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
      const cashChangeSource = body.cashChangeSource || "cash";
      if (!["cash","payment-method"].includes(cashChangeSource)) throw new Error("Choose how change was returned.");
      const cashChangePaid = paymentMethod !== "cash" && cashChangeSource === "cash" ? change : 0;
      if (!offlineFinal) tx.set(sequenceRef, { lastNumber: receiptNumber, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      const saleData = {
        receiptId,
        clientTransactionId: transactionId,
        items: lines,
        subtotal: pricing.subtotal,
        discount: pricing.discount,
        total,
        cost,
        profit: Math.round((total - Number(taxSnapshot.tax || 0) - cost) * 100) / 100,
        paymentMethod,
        amountPaid: tendered,
        change,
        cashChangeSource,
        cashChangePaid,
        salesChannel,
        purchaseType: mode,
        orderReference,
        customerName,
        customerPhone,
        fulfilmentSnapshot: { deliveryMethod: linkedOrder?.deliveryMethod || "pickup", originAddress: linkedOrder?.originAddress || CURRENT_SHOP_ADDRESS, deliveryAddress: linkedOrder?.deliveryAddress || linkedOrder?.landmark || "" },
        taxSnapshot,
        staffId: reconciliation ? shiftSnap.data().staffId : access.user.uid,
        staffName: reconciliation ? shiftSnap.data().staffName || "Staff" : access.user.displayName,
        staffEmail: reconciliation ? shiftSnap.data().staffEmail || "" : access.user.email,
        shiftId,
        deviceId,
        offlineFinal,
        ...(reconciliation ? { reconciliation: { reason: text(reconciliation.reason, 500), managerId: access.user.uid, managerName: access.user.displayName, currentTotal: currentPricing.total, capturedTotal: pricing.total, reconciledAt: FieldValue.serverTimestamp() } } : {}),
        createdAt: FieldValue.serverTimestamp(),
      };
      tx.create(saleRef, saleData);
      postSource(tx, accounting, saleJournal({ ...saleData, id: transactionId }, today()), access.user);
      if (reconciliation) tx.create(store.collection("admin_audit").doc(), auditPayload(access.user, "RECONCILE_OFFLINE_SALE", "sale", transactionId, text(reconciliation.reason, 500), { currentTotal: currentPricing.total }, { capturedTotal: pricing.total, receiptId, shiftId }));
      if (shiftSnap.data().aggregationVersion === 1) tx.update(shiftRef, { transactionCount: FieldValue.increment(1), salesTotal: FieldValue.increment(total), [`paymentMix.${paymentMethod}`]: FieldValue.increment(total) });
      else tx.update(shiftRef, { lastSaleAt: FieldValue.serverTimestamp() });
      if (cashChangePaid) tx.update(shiftRef, { cashChangePaid: FieldValue.increment(cashChangePaid) });
      return { ...receiptSnapshot({ ...saleData, createdAt: new Date().toISOString() }), duplicate: false };
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error.message || "Checkout failed." }, { status: 409 });
  }
}
