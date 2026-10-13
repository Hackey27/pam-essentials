import {variantKey} from "./adminVariants.mjs";
import { productOptions } from "./variantDisplay.mjs";
const text = (value) => typeof value === "string" || typeof value === "number" && Number.isFinite(value) ? String(value).trim().slice(0,120) : "";
const equal=(a,b)=>typeof a==="string"&&typeof b==="string"&&a.toLowerCase()===b.toLowerCase();
const canonical = (key) => {const k=variantKey(key);return ({colors:"colour",colours:"colour",sizes:"size",shapes:"shape",materials:"material",capacities:"capacity"}[k] || k);};
export function normalizedAttributeSelection(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([key,v]) => key.trim().length>0 && key.length<=60 && !/[\x00-\x1f\x7f]/.test(key) && !["constructor","prototype","__proto__"].includes(key) && Array.isArray(v)).slice(0,30).map(([key,v]) => [canonical(key),[...new Set(v.map(text).filter(Boolean))].slice(0,40)]).filter(([,v])=>v.length));
}
export function productAttributes(product) {
  const attributes = Object.fromEntries(Object.entries(productOptions(product)).map(([key,value])=>[canonical(key),text(value)]).filter(([,value])=>value));
  for (const key of ["material","capacity"]) if (!attributes[key] && text(product[key])) attributes[key]=text(product[key]);
  if (product.randomColours) delete attributes.colour;
  if (product.randomSizes) { delete attributes.size; delete attributes.capacity; }
  if (product.randomShapes) delete attributes.shape;
  return attributes;
}
export function matchesAttributes(product,selection,except="") {
  const values=productAttributes(product);
  return Object.entries(selection).every(([key,options]) => key===except || !options.length || options.some(option=>equal(option,values[key])));
}
const labels={colour:"Colour",size:"Size / capacity",capacity:"Capacity",material:"Material",shape:"Shape"};
export function attributeFacets(products,selection={}) {
  const keys=[...new Set([...products.flatMap(p=>Object.keys(productAttributes(p))),...Object.keys(selection)])];
  const order=["colour","size","capacity","material","shape"];
  return keys.sort((a,b)=>(order.includes(a)?order.indexOf(a):99)-(order.includes(b)?order.indexOf(b):99)||a.localeCompare(b)).map(key=>{
    const values=[...new Map([...products.map(p=>productAttributes(p)[key]).filter(Boolean),...(selection[key]||[])].map(value=>[value.toLowerCase(),value])).values()].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
    const title=products.flatMap(p=>p.variantTitles||[]).find(v=>canonical(v.title)===key)?.title;
    return {key,label:labels[key]||title||key.replaceAll("_"," ").replace(/^./,v=>v.toUpperCase()),options:values.map(value=>({value,count:products.filter(p=>matchesAttributes(p,selection,key)&&equal(productAttributes(p)[key],value)).length,selected:(selection[key]||[]).some(option=>equal(option,value))}))};
  }).filter(f=>f.options.length);
}
