import {NextResponse} from "next/server";
import {adminDb,requireRole} from "@/lib/admin";
import {serializeDoc} from "@/lib/productData";
import {selectReportingPeriod} from "@/lib/adminReporting.mjs";
import {tradePerformance} from "@/lib/tradePerformance.mjs";
export const dynamic="force-dynamic";
export async function GET(request){
 const access=await requireRole(request,["owner","admin"]);if(access.error)return NextResponse.json({error:access.error},{status:access.status});
 const url=new URL(request.url),period=url.searchParams.get("period")||"today";
 if(!["today","week","month","custom","all"].includes(period))return NextResponse.json({error:"Choose a valid reporting period."},{status:400});
 try{const snap=await adminDb().collection("sales").limit(50001).get();if(snap.docs.length>50000)return NextResponse.json({error:"This report exceeds 50,000 records. Ask for an indexed reporting expansion; a partial total has not been shown."},{status:422});
 const records=snap.docs.map(serializeDoc),missingDates=records.filter(row=>!row.createdAt||!Number.isFinite(new Date(row.createdAt).getTime())).length;
 const selected=selectReportingPeriod(records,[],period,{start:url.searchParams.get("start"),end:url.searchParams.get("end")});
 if(!selected.valid)return NextResponse.json({error:"Choose valid start/end dates."},{status:400});
 return NextResponse.json({report:tradePerformance(selected.sales),label:selected.label,coverage:"All retained POS sales and corrections in this period. Standalone invoices remain in Accounting."+(missingDates?` ${missingDates} records have no valid date; they appear only under All time.`:""),updatedAt:new Date().toISOString()},{headers:{"cache-control":"private, no-store"}});
 }catch{return NextResponse.json({error:"Performance could not be loaded. No partial totals are shown."},{status:503});}
}
