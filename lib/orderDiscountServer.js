import {createHash} from "node:crypto";
import {pricePurchaseCart} from "@/lib/wholesale.mjs";
import {channelProduct} from "@/lib/channelPricing.mjs";
import {catalogueContext,availableForSale,availableForWholesale} from "@/lib/commerce";
import {manualOrderDiscount,orderDiscountKey} from "@/lib/orderDiscounts.mjs";
export const discountFingerprint=(pricing,choice,mode,channel)=>createHash("sha256").update(JSON.stringify({mode,channel,lines:pricing.lines.map(l=>({id:l.id,quantity:l.quantity,price:l.price,total:l.lineTotal})),discount:pricing.discount,choice:{discountType:choice.discountType,value:Number(choice.value),reason:String(choice.reason||"").trim()}})).digest("hex");
export async function discountQuote(store,body) {
 const mode=body.purchaseType||"retail",channel=body.salesChannel||"walk-in";if(!["retail","wholesale"].includes(mode)||!["walk-in","website","whatsapp","phone"].includes(channel))throw new Error("Manual discounts are available on direct retail/wholesale sales.");
 if(!Array.isArray(body.items)||!body.items.length||body.items.length>100)throw new Error("Add between 1 and 100 products.");
 const seen=new Set(),context=await catalogueContext(store),products=[];
 for(const i of body.items){if(!i.id||seen.has(i.id)||!Number.isInteger(i.quantity)||i.quantity<1||i.quantity>999)throw new Error("Check product quantities.");seen.add(i.id);const snap=await store.collection("products").doc(encodeURIComponent(i.id)).get(),p=snap.data();if(!snap.exists||!(mode==="wholesale"?availableForWholesale(p,context):availableForSale(p,context)))throw new Error("A selected product is unavailable.");products.push({...channelProduct(p,context.channelSettings,channel==="website"?"website":"walk-in"),id:i.id,quantity:i.quantity});}
 return {pricing:pricePurchaseCart(products,context.rules,context.deals,mode,true,{channel}),mode,channel};
}
export async function authorizeOrderDiscount(tx,store,pricing,choice,user,mode,channel,transactionId) {
 if(!choice||choice.value==null||choice.value==="")return pricing;
 const config=(await tx.get(store.collection("settings").doc(orderDiscountKey))).data()?.value||{},manager=["owner","admin"].includes(user.role);
 let approved=false,approvalRef;
 if(choice.approvalId){approvalRef=store.collection("order_discount_approvals").doc(String(choice.approvalId));const snap=await tx.get(approvalRef),v=snap.data();if(!snap.exists||v.staffId!==user.uid||v.status!=="approved"||Date.parse(v.expiresAt)<Date.now()||v.fingerprint!==discountFingerprint(pricing,choice,mode,channel))throw new Error("Discount approval expired or the basket changed. Request a new approval.");approved=true;}
 const result=manualOrderDiscount(pricing,choice,config.staff?.[user.uid],{manager,approved});return {...result,orderDiscount:{...result.orderDiscount,staffId:user.uid,approved},approvalRef,discountTransactionId:transactionId};
}
