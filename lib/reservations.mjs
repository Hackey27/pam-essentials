export const holdTime=value=>value?.toDate?.()?.getTime?.()??Date.parse(value||'');
export function activeHolds(product,now=Date.now(),exclude=''){return Object.entries(product?.stockHolds||{}).filter(([id,h])=>id!==exclude&&Number.isSafeInteger(h.quantity)&&h.quantity>0&&holdTime(h.expiresAt)>now);}
export const heldQuantity=(p,now=Date.now(),exclude='')=>activeHolds(p,now,exclude).reduce((n,[,h])=>n+h.quantity,0);
export const availableStock=(p,now=Date.now(),exclude='')=>Math.max(0,Number(p?.stock||0)-heldQuantity(p,now,exclude));
export function assertAvailable(p,quantity,exclude='',now=Date.now()){if(!Number.isSafeInteger(quantity)||quantity<0||quantity>availableStock(p,now,exclude))throw new Error((p.name||'Product')+': insufficient unreserved stock. '+availableStock(p,now,exclude)+' available.');}
export function putHold(p,id,quantity,expiresAt,now=Date.now()){assertAvailable(p,quantity,id,now);const holds=Object.fromEntries(activeHolds(p,now));if(!holds[id]&&Object.keys(holds).length>=100)throw new Error('Too many active reservations for this SKU. Fulfil or release orders first.');if(quantity)holds[id]={quantity,expiresAt};else delete holds[id];return holds;}
export function releaseHold(p,id){const holds={...(p.stockHolds||{})};delete holds[id];return holds;}
export function reservationHours(value=24){const n=Number(value);if(!Number.isInteger(n)||n<1||n>720)throw new Error('Reservation expiry must be 1–720 hours.');return n;}
