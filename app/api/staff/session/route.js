import {NextResponse} from "next/server";
import {adminAuth,adminDb} from "@/lib/admin";
import {staffAccess} from "@/lib/staffAccess.mjs";
const headers={"Cache-Control":"private, no-store"};
const send=(body,status=200)=>NextResponse.json(body,{status,headers});
export async function GET(request) {
 const authorization=request.headers.get("authorization")||"";
 const token=authorization.startsWith("Bearer ")?authorization.slice(7):"";
 if(!token)return send({error:"Sign in is required."},401);
 let decoded;
 try {decoded=await adminAuth().verifyIdToken(token);}catch{return send({error:"Your session could not be verified. Sign in again."},401);}
 try {
  const profile=await adminDb().collection("users").doc(decoded.uid).get();
  const access=staffAccess(profile.exists?profile.data():{},decoded);
  return send({uid:decoded.uid,...access});
 } catch {return send({error:"Staff access could not be checked. Check your connection and try again."},503);}
}
