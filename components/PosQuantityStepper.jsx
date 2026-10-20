"use client";
import {wholesaleAvailableUnits,wholesaleSize,wholesaleUnitName,wholesaleMinimumUnits,wholesaleStepUnits,displayQuantity} from "@/lib/wholesaleUnits.mjs";
import {useEffect,useState} from "react";
export default function PosQuantityStepper({item,onChange}) {
 const whole=item.purchaseType==="wholesale",size=whole?wholesaleSize(item):1,minimum=whole?wholesaleMinimumUnits(item):1,step=whole?wholesaleStepUnits(item):1,available=whole?wholesaleAvailableUnits(item):item.stock;
 const [draft,setDraft]=useState(String(displayQuantity(item)));
 useEffect(()=>setDraft(String(displayQuantity(item))),[item.quantity,size]);
 const commit=()=>{const parsed=Number(draft);if(Number.isInteger(parsed)&&parsed>=1){const next=Math.max(minimum,Math.min(Math.floor(Number(available)/size)*size,parsed*size));onChange(item.id,next);setDraft(String(next/size))}else setDraft(String(displayQuantity(item)))};
 return <div><div className="stepper pos-quantity-stepper"><button type="button" aria-label={"Remove one "+item.name} onClick={()=>onChange(item.id,Math.max(minimum,item.quantity-step))} disabled={item.quantity<=minimum}>−</button><input type="number" min={minimum/size} max={Math.floor(available/size)} step={step/size} inputMode="numeric" aria-label={"Quantity for "+item.name} value={draft} onChange={e=>setDraft(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur()}}/><button type="button" aria-label={"Add one "+item.name} onClick={()=>onChange(item.id,item.quantity+step)} disabled={item.quantity+step>available}>+</button></div>{size>1&&<small className="pos-pack-unit">{wholesaleUnitName(item,true)}</small>}</div>;
}
