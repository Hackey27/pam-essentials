import {channelProduct} from "@/lib/channelPricing.mjs";
import {availableStock} from "@/lib/reservations.mjs";
import {unitSnapshot,stockUnitIssue} from "@/lib/stockUnits.mjs";
import {packingIssue} from "@/lib/wholesaleUnits.mjs";
import { pricePurchaseCart, purchaseType } from "@/lib/wholesale.mjs";
import { FieldValue } from "firebase-admin/firestore";
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/admin";
import { customerIdentity, optionalCustomerIdentity } from "@/lib/customerAuth";
import { availableForSale, availableForWholesale, catalogueContext, priceCart } from "@/lib/commerce";
import { deliveryMethods } from "@/lib/shop";
import { CURRENT_SHOP_ADDRESS } from "@/lib/shopAddress.mjs";

import { publicOrder } from "@/lib/customerTracking.mjs";
import { CHECKOUT_KEY, normalizeCheckoutPreferences, fulfilmentEstimate } from "@/lib/shopPreferences.mjs";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const account = await customerIdentity(request);
  if (account.error) return NextResponse.json({ error: account.error }, { status: account.status });
  const url = new URL(request.url);
  const orderId = String(url.searchParams.get("reference") || "").trim().toUpperCase();
  const store = adminDb();
  const snaps = orderId ? [await store.collection("orders").doc(orderId).get()] : (await store.collection("orders").where("customerUid", "==", account.uid).get()).docs;
  const orders = snaps.filter((snap) => snap.exists && snap.data().customerUid === account.uid).map((snap) => {
    return publicOrder(snap.id, snap.data());
  }).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  if (orderId) return orders[0] ? NextResponse.json({ order: orders[0] }, { headers: { "cache-control": "private, no-store" } }) : NextResponse.json({ error: "This order is not linked to your account." }, { status: 404 });
  return NextResponse.json({ orders }, { headers: { "cache-control": "private, no-store" } });
}

export async function POST(request) {
  const account = await optionalCustomerIdentity(request);
  if (account.error) return NextResponse.json({ error: account.error }, { status: account.status });
  const body = await request.json().catch(() => ({}));
  let mode;
  try { mode = purchaseType(body.purchaseType); } catch (error) { return NextResponse.json({ error:error.message },{status:400}); }
  const requested = Array.isArray(body.items) ? body.items : [];
  const customer = String(body.customer || "").trim();
  const phone = String(body.phone || "").trim();
  if (!requested.length || !customer || !phone) {
    return NextResponse.json({ error: "Name, phone number and order items are required." }, { status: 400 });
  }
  if (requested.length > 100 || customer.length > 120 || !/^\+?[0-9 ()-]{7,25}$/.test(phone)) return NextResponse.json({ error: "Check the order details and use a valid phone number." }, { status: 400 });
  const deliveryMethod = String(body.deliveryMethod || "pickup");
  const deliveryAddress = String(body.deliveryAddress || body.landmark || "").trim().slice(0, 500);
  const notes = String(body.notes || "").trim().slice(0, 1000);
  if (!deliveryMethods.includes(deliveryMethod) || (deliveryMethod === "delivery-shop" && !deliveryAddress)) return NextResponse.json({ error: "Choose a valid fulfilment method and delivery address." }, { status: 400 });

  const store = adminDb();
  const context = await catalogueContext(store);
  const checkoutSetting = await store.collection("settings").doc(CHECKOUT_KEY).get();
  const fulfilmentDetails = fulfilmentEstimate(new Date(), deliveryMethod, normalizeCheckoutPreferences(checkoutSetting.data()?.value));
  const quantities = new Map();
  for (const item of requested) {
    const id = String(item.id || "").trim();
    const quantity = mode === "wholesale" ? Number(item.quantity) : Math.floor(Number(item.quantity));
    const combinedQuantity = (quantities.get(id) || 0) + quantity;
    if (!id || id.length > 160 || !Number.isInteger(quantity) || quantity < 1 || combinedQuantity > 999) {
      return NextResponse.json({ error: "Each order item needs a valid product and quantity." }, { status: 400 });
    }
    quantities.set(id, combinedQuantity);
  }

  const normalizedItems = [...quantities].map(([id, quantity]) => ({ id, quantity }));
  const productRefs = normalizedItems.map(({ id }) => store.collection("products").doc(encodeURIComponent(id)));
  const productSnaps = await store.getAll(...productRefs);
  const items = [];
  for (let index = 0; index < normalizedItems.length; index += 1) {
    const snap = productSnaps[index];
    const quantity = normalizedItems[index].quantity;
    if (!snap.exists || !(mode === "wholesale" ? availableForWholesale(snap.data(),context) : availableForSale(snap.data(), context))) return NextResponse.json({ error: "A selected product is no longer available." }, { status: 409 });
    if(mode==="wholesale"){const issue=packingIssue(snap.data(),requested.find(item=>String(item.id||"").trim()===normalizedItems[index].id));if(issue)return NextResponse.json({error:issue},{status:409});}
    const unitIssue=stockUnitIssue(snap.data(),requested.find(i=>i.id===normalizedItems[index].id));if(unitIssue)return NextResponse.json({error:unitIssue},{status:409});
    if (availableStock(snap.data()) < quantity) return NextResponse.json({ error: `Only ${snap.data().stock} × ${snap.data().name} remain.` }, { status: 409 });
  }
  let pricing;
  try { pricing = pricePurchaseCart(productSnaps.map((snap,index)=>({...channelProduct(snap.data(),context.channelSettings,"website"),id:normalizedItems[index].id,quantity:normalizedItems[index].quantity})),context.rules,context.deals,mode,true,{channel:body.channel==="whatsapp"?"whatsapp":"website"}); }
  catch(error) { return NextResponse.json({error:error.message},{status:409}); }
  if(mode==="wholesale" && (!Number.isFinite(Number(body.expectedTotal)) || Math.abs(Number(body.expectedTotal)-pricing.total)>.005)) return NextResponse.json({error:"Wholesale prices changed. Refresh your basket and review the total before ordering."},{status:409});
  for (let index = 0; index < normalizedItems.length; index += 1) {
    const item = normalizedItems[index];
    const snap = productSnaps[index];
    const product = snap.data();
    const quantity = item.quantity;
    const priced = pricing.lines[index];
    items.push({
      productId: product.id,
      productGroupId: product.productGroupId || "",
      variantId: product.productGroupId ? product.id : "",
      sku: product.sku || product.id,
      colour: product.colour || "",
      size: product.size || "",
      variantOptions: product.variantOptions || {},
      ...unitSnapshot(product),
      name: product.name,
      quantity,
      unitPrice: Number(priced.price),
      purchaseType: mode,
      ...(mode === "wholesale" ? { wholesaleSnapshot: priced.wholesaleSnapshot } : {}),
      lineTotal: priced.lineTotal,
      categorySnapshot: { id: product.categoryId, name: product.category },
      orderDiscountSnapshot: pricing.orderDiscount ? {...pricing.orderDiscount,amount:Number(priced.orderDiscountCents||0)/100}:null,
      discountRuleSnapshot: priced.rule ? { ruleId: priced.rule.ruleId, name: priced.rule.name, discountType: priced.rule.discountType, value: priced.rule.value, minQty: priced.rule.minQty, amount: priced.ruleDiscountCents / 100 } : null,
      dealBundleSnapshot: priced.dealIds.length ? { dealIds: priced.dealIds, amount: priced.dealDiscountCents / 100 } : null,
    });
  }
  const orderId = `ORD-${Date.now().toString(36).toUpperCase()}-${randomBytes(5).toString("hex").toUpperCase()}`;
  const total = pricing.total;
  const orderSnapshot = {
    orderId,
    customer,
    phone,
    customerUid: account.uid,
    items,
    subtotal: pricing.subtotal,
    discount: pricing.discount,
    orderDiscount: pricing.orderDiscount || null,
    total,
    purchaseType: mode,
    channel: body.channel === "whatsapp" ? "whatsapp" : "website",
    deliveryMethod,
    originAddress: CURRENT_SHOP_ADDRESS,
    fulfilmentDetails,
    deliveryAddress: deliveryMethod === "pickup" ? "" : deliveryAddress,
    landmark: deliveryMethod === "pickup" ? "" : deliveryAddress,
    notes,
    paymentStatus: "pending",
    status: "pending",
    statusHistory: [{ status: "pending", at: new Date(), by: "customer" }],
    createdAt: FieldValue.serverTimestamp(),
  };
  await store.collection("orders").doc(orderId).create(orderSnapshot);
  return NextResponse.json({ orderId, purchaseType: mode, subtotal: orderSnapshot.subtotal, discount: orderSnapshot.discount, total, items: items.map(({ name, sku, colour, size, variantOptions, quantity, unitPrice, lineTotal, purchaseType, wholesaleSnapshot,retailUnit }) => ({ name, sku, colour, size, variantOptions, quantity, unitPrice, lineTotal,retailUnit, ...(purchaseType==="wholesale"?{purchaseType,wholesaleSnapshot}:{}) })), deliveryMethod, originAddress: CURRENT_SHOP_ADDRESS, deliveryAddress: orderSnapshot.deliveryAddress, notes, fulfilmentDetails });
}

