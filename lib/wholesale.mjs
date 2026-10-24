import {automaticOrderDiscount} from "./orderDiscounts.mjs";
import {stockUnit,retailEnabled,unitSnapshot} from "./stockUnits.mjs";
import { wholesaleSize, wholesaleUnitName, wholesaleMinimumUnits, wholesaleStepUnits, wholesaleAvailableUnits } from "./wholesaleUnits.mjs";
import { priceCart } from "./cartPricing.mjs";
const amount = value => value === "" || value == null ? null : Number(value);
export function purchaseType(value) {
  if (value == null || value === "") return "retail";
  if (!["retail","wholesale"].includes(value)) throw new Error("Choose retail or wholesale pricing.");
  return value;
}
export function validateWholesale(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Wholesale settings are invalid.");
  if (value.enabled !== undefined && typeof value.enabled !== "boolean") throw new Error("Choose a valid wholesale availability setting.");
  const enabled = value.enabled === true, unitPrice = amount(value.unitPrice);
  const sellingUnit=value.sellingUnit??"unit", unitsPerPack=sellingUnit==="unit"?1:Number(value.unitsPerPack);
  if(!["unit","pack","box"].includes(sellingUnit)||!Number.isInteger(unitsPerPack)||unitsPerPack<1||unitsPerPack>999||sellingUnit!=="unit"&&unitsPerPack<1)throw new Error("Choose piece, pack or box and a whole pack size from 1 to 999 stock units.");
  if(sellingUnit==="unit"&&value.unitsPerPack!=null&&Number(value.unitsPerPack)!==1)throw new Error("Individual pieces use a pack size of 1. Choose Pack or Box to set pieces per pack.");
  const retailReserve=Number(value.retailReserve??0);
  if(!Number.isSafeInteger(retailReserve)||retailReserve<0||retailReserve>1000000000)throw new Error("Retail reserve must be a whole number of retail stock units from 0 to 1,000,000,000.");
  const minQty = Number(value.minQty ?? 1), increment = Number(value.increment ?? 1);
  const validPrice = n => Number.isFinite(n) && n > 0 && n <= 10000000 && Math.abs(n*100-Math.round(n*100)) < .00001;
  if (unitPrice != null && !validPrice(unitPrice) || enabled && !validPrice(unitPrice)) throw new Error("Wholesale price must be a positive GHS amount with at most two decimals.");
  if (![minQty,increment].every(n=>Number.isInteger(n)&&n>=1&&n<=999)) throw new Error("Wholesale minimum and increment must be whole units from 1 to 999.");
  if(minQty*unitsPerPack>999||increment*unitsPerPack>999)throw new Error("The minimum and increment cannot exceed 999 retail stock units. Use a bulk quote for larger quantities.");
  if (!Array.isArray(value.tiers ?? []) || (value.tiers || []).length > 10) throw new Error("Use at most 10 wholesale quantity tiers.");
  const tiers = (value.tiers || []).map(t=>({minQty:Number(t.minQty),unitPrice:amount(t.unitPrice)})).sort((a,b)=>a.minQty-b.minQty);
  let previousQty=minQty, previousPrice=unitPrice;
  for (const tier of tiers) {
    if (!Number.isInteger(tier.minQty) || tier.minQty<minQty || tier.minQty*unitsPerPack>999 || tier.minQty<=previousQty || !validPrice(tier.unitPrice) || previousPrice==null || tier.unitPrice>previousPrice) throw new Error("Tiers need unique increasing quantities and prices no higher than the preceding tier.");
    previousQty=tier.minQty; previousPrice=tier.unitPrice;
  }
  return {enabled,unitPrice,minQty,increment,tiers,sellingUnit,unitsPerPack,retailReserve};
}
export function wholesaleSettings(product) {
  try { return validateWholesale(product?.wholesale || {enabled:false}); } catch { return {enabled:false,unitPrice:null,minQty:1,increment:1,tiers:[]}; }
}
export function wholesaleEnabled(product) {
  const config=wholesaleSettings(product);
  return stockUnit(product).role!=="component" && config.enabled && config.unitPrice>0;
}
export function wholesaleSellingPrice(product,quantity) {
  const config=wholesaleSettings(product);
  return config.tiers.reduce((price,tier)=>quantity/wholesaleSize(product)>=tier.minQty?tier.unitPrice:price,config.unitPrice);
}
export function wholesaleUnitPrice(product, quantity) {
  return wholesaleSellingPrice(product,quantity)/wholesaleSize(product);
}
export function wholesaleQuantityIssue(product, quantity) {
  if (!wholesaleEnabled(product)) return "This product is not available for wholesale.";
  const config=wholesaleSettings(product), qty=Number(quantity);
  const size=wholesaleSize(product),minimum=wholesaleMinimumUnits(product),step=wholesaleStepUnits(product),unit=wholesaleUnitName(product,config.minQty!==1);
  if (!Number.isInteger(qty) || qty<minimum) return `Minimum ${config.minQty} ${unit}${size>1?" ("+minimum+" pcs)":""} of this exact SKU/variant.`;
  if(qty%size)return `Choose complete ${wholesaleUnitName(product,true)} of ${size} pieces.`;
  if (qty>999) return "For more than 999 individual pieces, request a bulk quote.";
  if ((qty-minimum)%step) return `Use increments of ${config.increment} ${wholesaleUnitName(product,config.increment!==1)} above the minimum of ${config.minQty}.`;
  if(Number.isFinite(Number(product.stock))&&qty>wholesaleAvailableUnits(product)&&config.retailReserve>0)return "This quantity is unavailable for wholesale. Retail stock is protected.";
  if (Number.isFinite(Number(product.stock)) && qty>wholesaleAvailableUnits(product)) return size>1?"This quantity is unavailable for wholesale. Reduce the quantity or check retail availability.":`Only ${product.stock} units are currently available.`;
  return "";
}
export function purchaseProduct(product, mode, quantity, strict=true) {
  mode=purchaseType(mode);
  if (mode==="retail") {if(strict&&!retailEnabled(product))throw new Error(product.name+": retail sales are disabled."); return {...product,...unitSnapshot(product),purchaseType:mode};}
  const issue=wholesaleQuantityIssue(product,quantity);
  if (strict && issue) throw new Error(`${product.name}: ${issue}`);
  const config=wholesaleSettings(product), unitPrice=wholesaleUnitPrice(product,quantity);
  return {...product,...unitSnapshot(product),quantity,retailPrice:product.retailPrice??product.price,price:unitPrice??0,purchaseType:mode,wholesale:config,
    wholesaleSnapshot:{unitPrice,retailReserve:config.retailReserve,sellingUnit:config.sellingUnit||"unit",unitsPerPack:wholesaleSize(product),sellingQuantity:quantity/wholesaleSize(product),sellingUnitPrice:wholesaleSellingPrice(product,quantity),minQty:config.minQty,increment:config.increment,tierMinimum:config.tiers.filter(t=>quantity/wholesaleSize(product)>=t.minQty).at(-1)?.minQty||config.minQty}};
}
export function pricePurchaseCart(products, rules=[], deals=[], mode="retail", strict=true, options={}) {
  mode=purchaseType(mode);
  const resolved=products.map(product=>purchaseProduct(product,mode,product.quantity,strict));
  if(mode==="retail")return {...priceCart(resolved,rules,deals,new Date(),{...options,mode}),purchaseType:mode};
  // Multiply exact pack cents by complete packs; never round a per-piece equivalent first.
  const lines=resolved.map(p=>{const subtotalCents=Math.round(Math.round(p.wholesaleSnapshot.sellingUnitPrice*100)*p.quantity/wholesaleSize(p));return {...p,subtotalCents,ruleDiscountCents:0,dealDiscountCents:0,rule:null,dealIds:[],lineTotal:subtotalCents/100};});
  const subtotal=lines.reduce((n,p)=>n+p.subtotalCents,0)/100;
  return automaticOrderDiscount({subtotal,discount:0,total:subtotal,lines,purchaseType:mode},rules,{...options,mode});
}
