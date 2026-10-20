"use client";
import {useEffect,useState} from "react";
import TradePerformancePanel from "@/components/TradePerformancePanel";
export default function AdminTradePerformance({authorizedFetch,period,range}) {
  const [data,setData]=useState(null),[error,setError]=useState(""),[refresh,setRefresh]=useState(0);
  useEffect(()=>{let live=true;setData(null);setError("");authorizedFetch("/api/admin/trade-report?"+new URLSearchParams({period,start:range?.start||"",end:range?.end||""})).then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error||"Report unavailable");if(live)setData(j)}).catch(e=>{if(live)setError(e.message)});return()=>{live=false};},[period,range?.start,range?.end,refresh]);
  return <>{error?<p className="notice error-notice" role="alert">{error}<button type="button" onClick={()=>setRefresh(n=>n+1)}>Retry</button></p>:!data?<p role="status">Loading retail and wholesale performance…</p>:<><TradePerformancePanel report={data.report} label={data.label}/><p className="muted">{data.coverage} · Updated {new Date(data.updatedAt).toLocaleString("en-GH")}</p></>}</>;
}
