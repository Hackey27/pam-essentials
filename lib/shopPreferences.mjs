export const CHECKOUT_KEY = "STOREFRONT_CHECKOUT";
export const SYNONYMS_KEY = "SEARCH_SYNONYMS";
export const paymentMethods = ["Cash", "Mobile Money", "Card", "Bank transfer"];
export const checkoutDefaults = { feeMode: "quote", feeAmount: null, pickupMinHours: 1, pickupMaxHours: 3, deliveryHours: 3, openTime: "06:30", closeTime: "20:00", paymentInstructions: "Pay on pickup or delivery. Confirm payment details with our team before sending money.", acceptedMethods: paymentMethods, momoNumber: "0596 661 439", momoMerchantId: "497023" };
export function checkoutPreferences(value) { const v = value && typeof value === "object" && !Array.isArray(value) ? value : {}; return { ...checkoutDefaults, ...Object.fromEntries(Object.keys(checkoutDefaults).filter((k) => v[k] !== undefined).map((k) => [k,v[k]])) }; }
export function validCheckoutPreferences(v) {
  if (!v || typeof v !== "object" || Array.isArray(v) || Object.keys(v).some((k) => !Object.hasOwn(checkoutDefaults,k))) return false;
  const p = checkoutPreferences(v), time = /^([01]\d|2[0-3]):[0-5]\d$/;
  return ["quote","free","fixed"].includes(p.feeMode) && (p.feeMode !== "fixed" || typeof p.feeAmount === "number" && Number.isFinite(p.feeAmount) && p.feeAmount >= .01 && p.feeAmount <= 10000 && Math.abs(p.feeAmount*100-Math.round(p.feeAmount*100))<.00001) && [p.pickupMinHours,p.pickupMaxHours,p.deliveryHours].every((n) => typeof n === "number" && Number.isFinite(n) && n > 0 && n <= 72) && p.pickupMinHours <= p.pickupMaxHours && time.test(p.openTime) && time.test(p.closeTime) && p.openTime < p.closeTime && typeof p.paymentInstructions === "string" && p.paymentInstructions.length <= 1500 && typeof p.momoNumber === "string" && p.momoNumber.length <= 40 && typeof p.momoMerchantId === "string" && p.momoMerchantId.length <= 50 && Array.isArray(p.acceptedMethods) && p.acceptedMethods.length > 0 && p.acceptedMethods.length <= 4 && new Set(p.acceptedMethods).size === p.acceptedMethods.length && p.acceptedMethods.every((m) => paymentMethods.includes(m));
}
export function normalizeCheckoutPreferences(value) { const p=checkoutPreferences(value); return validCheckoutPreferences(p) ? p : {...checkoutDefaults}; }
export function addWorkingHours(at,hours,p) {
  let date=new Date(at), remaining=Math.round(hours*60), guard=0;
  const minutes=(time)=>Number(time.slice(0,2))*60+Number(time.slice(3)); const open=minutes(p.openTime),close=minutes(p.closeTime);
  while(remaining>0&&guard++<5000){ let minute=date.getUTCHours()*60+date.getUTCMinutes(); if(minute>=close){date.setUTCDate(date.getUTCDate()+1);date.setUTCHours(0,0,0,0);minute=0;} if(minute<open){date.setUTCHours(Math.floor(open/60),open%60,0,0);minute=open;} const usable=Math.min(remaining,close-minute);date=new Date(date.getTime()+usable*60000);remaining-=usable; }
  return date.toISOString();
}
export function fulfilmentEstimate(at,method,preferences) {
  const p=normalizeCheckoutPreferences(preferences),pickup=method!=="delivery-shop";
  return { method, feeMode: pickup?"none":p.feeMode, feeAmount: !pickup&&p.feeMode==="fixed"?p.feeAmount:null, feeCollector:"courier", earliestAt:addWorkingHours(at,pickup?p.pickupMinHours:p.deliveryHours,p),latestAt:addWorkingHours(at,pickup?p.pickupMaxHours:p.deliveryHours,p),windowText:pickup?`${p.pickupMinHours}–${p.pickupMaxHours} working hours after your request`:`About ${p.deliveryHours} working hours after your request`,openTime:p.openTime,closeTime:p.closeTime };
}
export function courierFeeLabel(details) { return details.feeMode==="quote"?"Delivery fee to be confirmed":details.feeMode==="fixed"?`Delivery fee: GH₵${Number(details.feeAmount).toFixed(2)} · pay the courier separately`:details.feeMode==="free"?"No delivery charge":"No shop delivery charge"; }
