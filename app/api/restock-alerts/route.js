import {createHash} from "node:crypto";
import {FieldValue} from "firebase-admin/firestore";
import {NextResponse} from "next/server";
import {adminDb} from "@/lib/admin";
import {optionalCustomerIdentity} from "@/lib/customerAuth";
import {availableForSale,catalogueContext} from "@/lib/commerce";
import {validateRestockRequest,restockIdentity,restockReference,restockAcknowledgement} from "@/lib/restockAlerts.mjs";
export const dynamic="force-dynamic";
const hash=v=>createHash("sha256").update(v).digest("hex");
const send=(v,status=200)=>NextResponse.json(v,{status,headers:{"cache-control":"no-store"}});
async function body(request){const reader=request.body?.getReader();if(!reader)throw new Error("Check your request.");let size=0;const chunks=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>8192){await reader.cancel();throw new Error("Your request is too large.");}chunks.push(Buffer.from(value));}return JSON.parse(Buffer.concat(chunks).toString("utf8"));}
export async function POST(request){
 const account=await optionalCustomerIdentity(request);if(account.error)return send({error:account.error},account.status);
 const origin=request.headers.get("origin"),host=request.headers.get("host");if(origin&&![new URL(request.url).origin,host?`https://${host}`:"",process.env.NODE_ENV!=="production"&&host?`http://${host}`:""].includes(origin))return send({error:"Send requests from the PAM website."},403);
 let details;try{details=validateRestockRequest(await body(request));}catch(e){return send({error:e instanceof SyntaxError?"Check your request details.":e.message},400);}
 try{const db=adminDb(),context=await catalogueContext(db),id=hash(restockIdentity(details)),ref=db.collection("restock_alerts").doc(id),productRef=db.collection("products").doc(encodeURIComponent(details.productId)),limitRef=db.collection("restock_limits").doc(hash(`${details.method==="email"?"email":"phone"}:${details.contact}`)),now=Date.now();
 const result=await db.runTransaction(async tx=>{const [previous,product,limit]=await tx.getAll(ref,productRef,limitRef),old=previous.data()||{},p=product.data();
  if(previous.exists&&(old.lastRequestId===details.requestId||["waiting","notified"].includes(old.status)))return {reference:old.reference,preferredMethod:old.method,duplicate:true};
  if(!product.exists||!availableForSale(p,context)||Number(p.stock)>0)return {error:"This exact selection is no longer eligible for a restock alert. Refresh the product details.",status:409};
  const counter=limit.data()||{},fresh=now-Number(counter.windowStart||0)>=3600000,count=fresh?0:Number(counter.count||0);if(count>=5)return {error:"Several requests were received recently. Please try later or contact PAM.",status:429};
  const {requestId,...fields}=details;const record={...fields,productName:p.name,sku:p.sku||p.id||details.productId,variantOptions:p.variantOptions||{},colour:p.colour||"",size:p.size||"",reference:restockReference(id),lastRequestId:requestId,status:"waiting",consent:true,consentedAt:FieldValue.serverTimestamp(),waitingSince:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp(),statusHistory:[...(old.statusHistory||[]),{status:"waiting",at:new Date().toISOString()}],...(account.uid&&!old.customerUid?{customerUid:account.uid}:{}),...(previous.exists?{}:{createdAt:FieldValue.serverTimestamp()})};
  tx.set(ref,record,{merge:true});tx.set(limitRef,{windowStart:fresh?now:counter.windowStart,count:count+1},{merge:true});return {reference:record.reference,preferredMethod:record.method};});
 if(result.error)return send({error:result.error},result.status);return send({ok:true,reference:result.reference,preferredMethod:result.preferredMethod,message:result.duplicate?"A restock request for this exact selection is already recorded. PAM will follow up using its saved contact preference.":restockAcknowledgement});
 }catch{return send({error:"Your restock request was not confirmed. Please retry."},503);}
}
