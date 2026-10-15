import { NextResponse } from "next/server";
import { adminDb, requireRole } from "@/lib/admin";
import { loadAccounting } from "@/lib/accountingServer";
import { day, today } from "@/lib/accounting.mjs";
import { accountingSheets, sheetsCsv, sheetsXlsx, sheetsPdf } from "@/lib/accountingExport.mjs";
export const dynamic="force-dynamic";
export async function GET(request){
  const access=await requireRole(request,["owner","admin"]);if(access.error)return NextResponse.json({error:access.error},{status:access.status});
  try{
    const url=new URL(request.url),data=await loadAccounting(adminDb()),start=day(url.searchParams.get("start")||data.settings.startDate||today()),end=day(url.searchParams.get("end")||today()),format=url.searchParams.get("format")||"xlsx",report=url.searchParams.get("report")||"all";
    if(!["xlsx","pdf","csv"].includes(format))throw new Error("Choose Excel, PDF or CSV.");
    const sheets=accountingSheets(data,start,end),selected=report==="all"?sheets:[sheets[0],...sheets.filter(s=>s.name===report)];
    if(selected.length<2&&report!=="all")throw new Error("Unknown report.");
    const body=format==="xlsx"?sheetsXlsx(selected):format==="pdf"?sheetsPdf(selected):sheetsCsv(selected);
    return new Response(body,{headers:{"Content-Type":format==="xlsx"?"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":format==="pdf"?"application/pdf":"text/csv;charset=utf-8","Content-Disposition":`attachment; filename="pam-accounting-${start}-${end}.${format}"`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
  }catch(e){return NextResponse.json({error:e.message||"Report could not be generated."},{status:400,headers:{"Cache-Control":"private, no-store"}});}
}
