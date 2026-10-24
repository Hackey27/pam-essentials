import {activeRule} from "./discount.mjs";
export const orderDiscountKind="order-total";
export const orderDiscountKey="ORDER_DISCOUNTS";
const cents=n=>Math.round(Number(n)*100);
const amount=(n,max=10000000)=>{if(!Number.isFinite(Number(n))||Number(n)<0||Number(n)>max||Math.abs(Number(n)*100-cents(n))>.00001)throw new Error("Use a valid amount with at most two decimals.");return Number(n);};
export function validateOrderRule(v={}) {
 const name=String(v.name||"").trim(), justification=String(v.justification||"").trim(), minSpend=amount(v.minSpend),value=amount(v.value,v.discountType==="PERCENT"?100:10000000);
 if(!name||name.length>120||!justification||justification.length>500||!["PERCENT","FIXED_AMOUNT"].includes(v.discountType)||value<=0)throw new Error("Enter a name, positive discount, spending threshold and justification.");
 const modes=v.purchaseTypes||["retail"],channels=v.channels||["website","walk-in","whatsapp","phone"];
 if(!Array.isArray(modes)||!modes.length||modes.some(x=>!["retail","wholesale"].includes(x))||!Array.isArray(channels)||!channels.length||channels.some(x=>!["website","walk-in","whatsapp","phone"].includes(x)))throw new Error("Choose retail/wholesale and supported sales channels.");
 for(const k of ["startDate","endDate"])if(v[k]&&Number.isNaN(Date.parse(v[k])))throw new Error("Choose valid start and end dates.");
 if(v.startDate&&v.endDate&&Date.parse(v.startDate)>Date.parse(v.endDate))throw new Error("End date must follow start date.");
 return {kind:orderDiscountKind,scopeType:"ORDER",name,justification,minSpend,discountType:v.discountType,value,purchaseTypes:[...new Set(modes)],channels:[...new Set(channels)],active:v.active===true,archived:false,startDate:v.startDate||null,endDate:v.endDate||null};
}
export function validateAllowance(v={}) {return {enabled:v.enabled===true,maxPercent:amount(v.maxPercent??0,100),maxAmount:amount(v.maxAmount??0)};}
export function orderDiscountAmount(total,choice) {const gross=cents(total),n=amount(choice.value,choice.discountType==="PERCENT"?100:10000000);if(n<=0||!["PERCENT","FIXED_AMOUNT"].includes(choice.discountType))throw new Error("Choose a positive percentage or GHS discount.");return Math.min(gross,choice.discountType==="PERCENT"?Math.round(gross*n/100):cents(n))/100;}
export function allocateOrderDiscount(pricing,discount,snapshot) {
 const total=cents(pricing.total),cut=cents(discount);if(cut<0||cut>total)throw new Error("Discount exceeds the order total.");if(!cut)return pricing;
 const lines=pricing.lines.map(l=>({...l}));let remaining=cut;
 for(let i=0;i<lines.length;i++){const capacity=cents(lines[i].lineTotal),part=i===lines.length-1?Math.min(capacity,remaining):Math.min(capacity,Math.floor(cut*capacity/total));lines[i].orderDiscountCents=part;remaining-=part;}
 for(const l of lines){const add=Math.min(remaining,cents(l.lineTotal)-l.orderDiscountCents);l.orderDiscountCents+=add;remaining-=add;l.lineTotal=(cents(l.lineTotal)-l.orderDiscountCents)/100;}
 if(remaining)throw new Error("Discount could not be allocated.");return {...pricing,discount:(cents(pricing.discount)+cut)/100,total:(total-cut)/100,lines,orderDiscount:{...snapshot,amount:cut/100}};
}
export function automaticOrderDiscount(pricing,rules=[],{mode="retail",channel="website",now=new Date()}={}) {
 if(pricing.discount>0)return pricing;
 const choices=rules.filter(r=>r.kind===orderDiscountKind&&activeRule(r,now)&&(r.purchaseTypes||["retail"]).includes(mode)&&(r.channels||["website","walk-in","whatsapp","phone"]).includes(channel)&&cents(pricing.subtotal)>=cents(r.minSpend||0)).map(r=>({r,cut:orderDiscountAmount(pricing.total,r)})).sort((a,b)=>b.cut-a.cut||String(a.r.ruleId).localeCompare(String(b.r.ruleId)));
 const best=choices[0];return best?allocateOrderDiscount(pricing,best.cut,{type:"automatic",ruleId:best.r.ruleId,name:best.r.name,justification:best.r.justification||"Admin spending threshold",discountType:best.r.discountType,value:best.r.value,minSpend:best.r.minSpend}):pricing;
}
export function manualOrderDiscount(pricing,choice,allowance,{manager=false,approved=false}={}) {
 if(!choice||choice.value==null||choice.value==="")return pricing;
 if(pricing.discount>0)throw new Error("Order discounts do not stack. Remove the existing offer or use its price.");
 const reason=String(choice.reason||"").trim();if(reason.length<3||reason.length>500)throw new Error("Give a reason for this discount.");
 const cut=orderDiscountAmount(pricing.total,choice),policy=validateAllowance(allowance||{});
 if(!manager&&!approved&&(!policy.enabled||cut>policy.maxAmount+.001||cut>Math.round(cents(pricing.total)*policy.maxPercent/100)/100+.001))throw new Error("This discount needs Admin approval.");
 return allocateOrderDiscount(pricing,cut,{type:"manual",reason,discountType:choice.discountType,value:Number(choice.value),approvalId:choice.approvalId||null});
}
