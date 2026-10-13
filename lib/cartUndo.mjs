export const CART_UNDO_MS=5000;
export function removeCartItem(cart,id,now=Date.now()) { const index=cart.findIndex((line)=>line.id===id);return index<0?{cart,removed:null}:{cart:cart.filter((line)=>line.id!==id),removed:{line:cart[index],index,expiresAt:now+CART_UNDO_MS}}; }
export function restoreCartItem(cart,removed,products,now=Date.now()) {
  if(!removed||now>=removed.expiresAt)return {cart,error:"Undo has expired."};
  const product=products.find((p)=>p.id===removed.line.id);
  if(!product||product.active===false||product.archived||!(Number(product.price)>0)||!(Number(product.stock)>0))return {cart,error:"This product is no longer available. Please browse its latest details."};
  const existing=cart.find((line)=>line.id===product.id),quantity=Math.min(Number(product.stock),Number(existing?.quantity||0)+Number(removed.line.quantity));
  const next=existing?cart.map((line)=>line.id===product.id?{...product,quantity}:line):[...cart.slice(0,removed.index),{...product,quantity},...cart.slice(removed.index)];
  return {cart:next,quantity,limited:quantity<Number(existing?.quantity||0)+Number(removed.line.quantity)};
}
