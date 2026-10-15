import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb, requireRole } from "@/lib/admin";
import { auditPayload, text } from "@/lib/serverData";
import { serializeDoc } from "@/lib/productData";
import { accountingContext, postSource } from "@/lib/accountingServer";
import { cashJournal, today } from "@/lib/accounting.mjs";
import { cashCents, cashPosition, posRoles } from "@/lib/posOperations.mjs";
export const dynamic = "force-dynamic";
export async function GET(request) {
  const access = await requireRole(request, posRoles);
  if (access.error) return NextResponse.json({error:access.error},{status:access.status});
  const store=adminDb(), id=text(new URL(request.url).searchParams.get("shiftId"),120), snap=id?await store.collection("shifts").doc(id).get():null;
  if (!snap?.exists || snap.data().staffId!==access.user.uid) return NextResponse.json({error:"Your shift is required."},{status:403});
  const [expenses,movements]=await Promise.all([store.collection("expenses").where("shiftId","==",id).get(),store.collection("cash_movements").where("shiftId","==",id).get()]);
  let shift=snap.data();
  if(shift.aggregationVersion!==1){const sales=await store.collection("sales").where("shiftId","==",id).get();shift={...shift,paymentMix:{cash:sales.docs.filter(d=>d.data().paymentMethod==="cash").reduce((n,d)=>n+Number(d.data().total||0),0)}};}
  return NextResponse.json({position:cashPosition(shift,expenses.docs.map(d=>d.data())),movements:movements.docs.map(serializeDoc).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))),updatedAt:new Date().toISOString()},{headers:{"Cache-Control":"private, no-store"}});
}
export async function POST(request) {
  const access=await requireRole(request,posRoles);
  if(access.error)return NextResponse.json({error:access.error},{status:access.status});
  const b=await request.json().catch(()=>({})), reason=text(b.reason,500), id=text(b.shiftId,120), movementId=text(b.movementId,120);
  let cents;
  try {cents=cashCents(b.amount);}catch(e){return NextResponse.json({error:e.message},{status:400});}
  if(!reason||!id||!/^[-a-zA-Z0-9]{8,120}$/.test(movementId)||!["in","out","opening"].includes(b.type)||(b.type!=="opening"&&cents<=0))return NextResponse.json({error:"Choose a movement, amount and reason."},{status:400});
  const store=adminDb(),ref=store.collection("cash_movements").doc(movementId),shiftRef=store.collection("shifts").doc(id);
  try{
    const result=await store.runTransaction(async tx=>{
      const [shift,old]=await tx.getAll(shiftRef,ref);
      if(!shift.exists||shift.data().staffId!==access.user.uid||shift.data().status!=="open")throw new Error("Your open shift is required.");
      if(old.exists){if(old.data().shiftId!==id||old.data().staffId!==access.user.uid||old.data().type!==b.type||old.data().amount!==cents/100||old.data().reason!==reason)throw new Error("Movement reference is already in use for different details.");return {duplicate:true};}
      if(b.type==="opening"&&shift.data().openingCash!=null)throw new Error("Opening cash has already been recorded.");
      const net=cents*(b.type==="out"?-1:1)/100;
      const value={movementId,shiftId:id,type:b.type,amount:cents/100,reason,staffId:access.user.uid,staffName:access.user.displayName,createdAt:FieldValue.serverTimestamp()};
      const accounting=await accountingContext(tx,store,today(),{type:"cash",id:movementId});
      tx.create(ref,value);
      postSource(tx,accounting,cashJournal({...value,id:movementId},today()),access.user);
      tx.update(shiftRef,b.type==="opening"?{openingCash:cents/100}:{cashMovementNet:Math.round((Number(shift.data().cashMovementNet||0)+net)*100)/100});
      tx.create(store.collection("admin_audit").doc(),auditPayload(access.user,"POS_CASH_MOVEMENT","shift",id,reason,null,value));return {ok:true};
    });return NextResponse.json(result);
  }catch(e){return NextResponse.json({error:e.message},{status:409});}
}
