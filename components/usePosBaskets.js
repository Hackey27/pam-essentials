"use client";
import {useEffect,useRef,useState} from "react";
import {basketDraft,restoreBasket,validateDraft} from "@/lib/posOperations.mjs";
export default function usePosBaskets({user,shift,cart,purchaseMode="retail",orderChannel,orderReference,customerName,customerPhone,request,attempt,onRestore,onFoundSale}){
  const [recovery,setRecovery]=useState(null),[held,setHeld]=useState([]),[status,setStatus]=useState(""),[error,setError]=useState(""),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState("");const action=useRef(false),owner=useRef("");
  const key=user?`pam-pos-baskets-v1:${user.uid}`:"";
  function read(){const value=JSON.parse(localStorage.getItem(key)||"{}");return {active:value.active||null,held:Array.isArray(value.held)?value.held:[]};}
  function write(value){localStorage.setItem(key,JSON.stringify(value));const reread=read();if(JSON.stringify(reread)!==JSON.stringify(value))throw new Error("Basket could not be safely stored.");}
  function snapshot(){return basketDraft({cart,shift,purchaseMode,staffId:user.uid,orderChannel,orderReference,customerName,customerPhone,attemptId:attempt.current?.transactionId||""});}
  useEffect(()=>{if(!user||owner.current===user.uid)return;owner.current=user.uid;setReady(false);try{const value=read();setRecovery(validateDraft(value.active,user.uid)?value.active:null);setHeld(value.held.filter(d=>validateDraft(d,user.uid)));setReady(true);}catch{setError("Saved baskets could not be read. Keep browser data and ask a manager for help.");}},[user?.uid]);
  useEffect(()=>{if(!ready||!shift||recovery)return;try{const value=read();write({...value,active:cart.length?snapshot():null});setStatus(cart.length?"Basket saved on this device":"");setError("");}catch(e){setError(e.message);setStatus("Basket save failed");}},[ready,shift?.shiftId,cart,purchaseMode,orderChannel,orderReference,customerName,customerPhone,recovery]);
  function captureAttempt(){if(!ready)throw new Error("Basket recovery storage is not ready.");const value=read();write({...value,active:snapshot()});}
  function finish(){try{const value=read();write({...value,active:null});setRecovery(null);}catch(e){setError(`Sale saved, but local draft cleanup failed: ${e.message}`);}}
  function hold(name){if(!cart.length||action.current)return false;if(attempt.current?.uncertain){setError("This basket has an unconfirmed sale attempt. Retry or check its receipt before holding it.");return false;}try{const value=read();if(value.held.length>=30)throw new Error("Resume or remove a held basket before adding more (30 maximum).");const draft={...snapshot(),name:String(name||customerName||`Basket ${value.held.length+1}`).trim().slice(0,100)};write({active:null,held:[...value.held,draft]});setHeld([...value.held,draft]);setRecovery(null);setNotice("Sale held; stock is not reserved.");return true;}catch(e){setError(e.message);return false;}}
  async function resume(draft){if(action.current||cart.length)return;action.current=true;setBusy(true);setError("");try{
    if(!navigator.onLine)throw new Error("Reconnect before restoring a basket so current stock and pricing can be checked.");
    if(!validateDraft(draft,user.uid))throw new Error("This saved basket belongs to another staff member or needs review.");
    if(draft.attemptId){const response=await request(`/api/pos/sales?transactionId=${encodeURIComponent(draft.attemptId)}`),result=await response.json();if(!response.ok)throw new Error(result.error);if(result.found){finish();onFoundSale(result.receipt);setNotice("The sale was already saved. Its receipt has been recovered.");return;}}
    const response=await request("/api/pos/products"),data=await response.json();if(!response.ok)throw new Error(data.error||"Current catalogue could not be checked.");
    const restored=restoreBasket(draft,data.products||[]),value=read(),nextHeld=value.held.filter(d=>d.draftId!==draft.draftId);
    // Persist first; never replace an unsaved basket if device storage failed.
    write({active:restored.cart.length?{...draft,items:restored.cart.map(({id,name,price,quantity})=>({id,name,price,quantity}))}:null,held:nextHeld});setHeld(nextHeld);setRecovery(null);
    onRestore(draft,restored.cart,data);setNotice(`Basket restored with current prices and promotions. Payment details must be entered again.${restored.issues.length?" "+restored.issues.join(" "):""}`);
  }catch(e){setError(e.message);}finally{action.current=false;setBusy(false);}}
  function discard(draft){if(draft.attemptId){setError("Recover this draft to check whether its sale was saved before discarding it.");return;}try{const value=read(),next={active:value.active?.draftId===draft.draftId?null:value.active,held:value.held.filter(d=>d.draftId!==draft.draftId)};write(next);setHeld(next.held);if(recovery?.draftId===draft.draftId)setRecovery(null);}catch(e){setError(e.message);}}
  return {recovery,held,status,error,busy,notice,dismissNotice:()=>setNotice(""),hold,resume,discard,captureAttempt,finish};
}
