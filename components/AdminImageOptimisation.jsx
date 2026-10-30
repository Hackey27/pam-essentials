"use client";
import {useEffect,useRef,useState} from "react";
import {auth} from "@/lib/firebase";
export default function AdminImageOptimisation(){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");const stop=useRef(false),mounted=useRef(true),lock=useRef(false);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;stop.current=true;};},[]);
 async function request(path,options={}){const token=await auth.currentUser?.getIdToken();if(!token)throw Error("Sign in as Owner/Admin.");const response=await fetch(path,{...options,headers:{authorization:"Bearer "+token,"content-type":"application/json"},cache:"no-store"});const data=await response.json();if(!response.ok)throw Error(data.error||"Image optimisation failed.");return data;}
 async function run(){
  if(lock.current)return;lock.current=true;stop.current=false;setBusy(true);setError("");let cursor="",count=0;const seen=new Set();
  try{do{
   if(stop.current)break;
   const batch=await request("/api/admin/image-variants"+(cursor?"?cursor="+encodeURIComponent(cursor):""));
   for(const path of batch.paths){
    if(stop.current)break;if(seen.has(path))continue;seen.add(path);
    if(mounted.current)setMessage("Checking / generating stored sizes · "+count+" images finished");
    await request("/api/admin/image-variants",{method:"POST",body:JSON.stringify({path})});count++;
   }
   cursor=batch.nextCursor;
  }while(cursor&&!stop.current);
  if(mounted.current)setMessage((stop.current?"Stopped after current image. ":"Complete. ")+count+" images checked. Run again safely to resume; completed images are skipped.");
  }catch(reason){if(mounted.current)setError(reason.message+" Run again to resume safely.");}
  finally{lock.current=false;if(mounted.current)setBusy(false);}
 }
 return <section className="panel image-optimisation"><h3>Stored image sizes</h3><p>New uploads generate five widths in two qualities automatically. Generate the same stored sizes for existing product and hero photos. Originals, assignments and SKUs stay unchanged.</p><div className="accounting-actions"><button type="button" className="button secondary" disabled={busy} onClick={run}>{busy?"Generating image sizes…":"Generate sizes for existing images"}</button>{busy&&<button type="button" className="table-action" onClick={()=>{stop.current=true;setMessage("Stopping after the current image…");}}>Stop after current image</button>}</div>{message&&<p role="status">{message}</p>}{error&&<p role="alert" className="notice error-notice">{error}</p>}</section>;
}
