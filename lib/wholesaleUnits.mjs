import {stockUnit,retailDescription} from "./stockUnits.mjs";
import {availableStock} from "./reservations.mjs";
// Stock quantities count retail stock units: individual items or explicitly configured finished packs.
export function wholesaleSize(product) { const v=Number(product?.wholesale?.unitsPerPack??product?.wholesaleSnapshot?.unitsPerPack??1);return Number.isInteger(v)&&v>0?v:1; }
export function wholesaleUnitName(product,plural=false) { const unit=product?.wholesale?.sellingUnit??product?.wholesaleSnapshot?.sellingUnit??"unit";return (unit==="box"?(plural?"boxes":"box"):unit==="pack"?(plural?"packs":"pack"):(plural?"units":"unit")); }
export const wholesaleMinimumUnits=p=>Number(p?.wholesale?.minQty||1)*wholesaleSize(p);
export const wholesaleStepUnits=p=>Number(p?.wholesale?.increment||1)*wholesaleSize(p);
const packed=p=>p?.purchaseType==="wholesale"&&wholesaleSize(p)>1;
export const displayQuantity=p=>Number(p.quantity||0)/(packed(p)?wholesaleSize(p):1);
export function displayUnitPrice(p) {return packed(p)?Number(p.wholesaleSnapshot?.sellingUnitPrice??Number(p.unitPrice??p.price??0)*wholesaleSize(p)):Number(p.unitPrice??p.price??0);}
export function packDescription(p) {return packed(p)?displayQuantity(p)+" "+wholesaleUnitName(p,Math.abs(displayQuantity(p))!==1)+" × "+wholesaleSize(p)+ (stockUnit(p).unit==="pack"?" retail packs ("+(p.quantity*stockUnit(p).contents)+" pieces)":" pcs ("+p.quantity+" pieces)"):retailDescription(p);}
export function packingIssue(product,expected) { const size=wholesaleSize(product),unit=wholesaleUnitName(product);if(size>1||expected?.expectedPackSize>1){if(Number(expected?.expectedPackSize)!==size||expected?.expectedSellingUnit!==unit)return "Pack size or selling unit changed. Refresh the basket and confirm the new pack details.";}return ""; }

export function wholesaleAvailableUnits(product) { const stock=availableStock(product),reserve=Number(product?.wholesale?.retailReserve??0);return Number.isFinite(stock)&&Number.isInteger(reserve)&&reserve>=0?Math.max(0,Math.floor(stock-reserve)):0; }
