"use client";
import {useEffect,useState} from "react";
const money = new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS", minimumFractionDigits: 0, maximumFractionDigits: 2 });
export default function MobilePriceRange({ minimum, maximum, upperLimit, onChange, showLabel = true }) {
 const low=minimum===""?0:Number(minimum),high=maximum===""?upperLimit:Number(maximum);
 const [typedLow,setTypedLow]=useState(minimum),[typedHigh,setTypedHigh]=useState(maximum);
 useEffect(()=>setTypedLow(minimum),[minimum]);useEffect(()=>setTypedHigh(maximum),[maximum]);
 function commit(which){
  const raw=which==="low"?typedLow:typedHigh;
  if(raw===""){onChange(which==="low"?"":minimum,which==="high"?"":maximum);return;}
  const value=Number(raw);if(!Number.isFinite(value))return;
  const bounded=Math.round(Math.max(which==="low"?0:low,Math.min(which==="low"?high:upperLimit,value))*100)/100;
  if(which==="low"){setTypedLow(String(bounded));onChange(bounded===0?"":String(bounded),maximum);}
  else {setTypedHigh(String(bounded));onChange(minimum,bounded===upperLimit?"":String(bounded));}
 }
 return <div className="mobile-price-range" role="group" aria-label="Price range">
  {showLabel&&<strong>Price range</strong>}
  <div className="price-number-fields"><label>Min (GH₵)<input type="number" inputMode="decimal" aria-label="Minimum price amount" min="0" max={high} step="0.01" value={typedLow} placeholder="0" onChange={e=>setTypedLow(e.target.value)} onBlur={()=>commit("low")} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();commit("low");}}}/></label><span aria-hidden="true">–</span><label>Max (GH₵)<input type="number" inputMode="decimal" aria-label="Maximum price amount" min={low} max={upperLimit} step="0.01" value={typedHigh} placeholder={String(upperLimit)} onChange={e=>setTypedHigh(e.target.value)} onBlur={()=>commit("high")} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();commit("high");}}}/></label></div>
  <div className="mobile-price-track" style={{"--range-start":`${low/upperLimit*100}%`,"--range-end":`${high/upperLimit*100}%`}}>
   <span className="mobile-price-fill" aria-hidden="true"/>
   <input type="range" aria-label="Minimum price" aria-valuetext={money.format(low)} min="0" max={upperLimit} step="1" value={low} onChange={e=>{const value=Math.min(Number(e.target.value),high);onChange(value===0?"":String(value),maximum);}}/>
   <input type="range" aria-label="Maximum price" aria-valuetext={money.format(high)} min="0" max={upperLimit} step="1" value={high} onChange={e=>{const value=Math.max(Number(e.target.value),low);onChange(minimum,value===upperLimit?"":String(value));}}/>
  </div>
 </div>;
}
