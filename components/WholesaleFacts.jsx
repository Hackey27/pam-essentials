import {stockUnit} from "@/lib/stockUnits.mjs";
import {wholesaleSettings,wholesaleUnitPrice,wholesaleSellingPrice} from "@/lib/wholesale.mjs";
import {wholesaleMinimumUnits} from "@/lib/wholesaleUnits.mjs";
const money=n=>new Intl.NumberFormat("en-GH",{style:"currency",currency:"GHS"}).format(n||0);
export default function WholesaleFacts({product}){const c=wholesaleSettings(product),u=stockUnit(product),n=wholesaleMinimumUnits(product),unit=u.unit==="pack"?"pack ("+u.contents+" pieces)":"item",price=wholesaleUnitPrice(product,n),value=wholesaleSellingPrice(product,n)*c.minQty;return <dl className="wholesale-facts"><div><dt>Wholesale unit price</dt><dd>{money(price)} per {unit}</dd></div>{u.unit==="pack"&&<div><dt>Per individual piece</dt><dd>{money(price/u.contents)}</dd></div>}<div><dt>Minimum order quantity</dt><dd>{n} {u.unit==="pack"?"packs ("+n*u.contents+" pieces)":"items"}</dd></div><div><dt>Minimum order value</dt><dd>{money(value)}</dd></div></dl>;}
