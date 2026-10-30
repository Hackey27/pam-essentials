"use client";
import {useEffect,useLayoutEffect,useRef,useState} from "react";
import {usePathname} from "next/navigation";
import {useAuth} from "./AuthProvider";
import {readNavigation,saveNavigation,navigationSlot} from "@/lib/customerNavigation.mjs";
export default function CustomerNavigationState(){
 const path=usePathname(),{user,loading}=useAuth(),scope=user?.uid||"guest";
 const [locationVersion,setLocationVersion]=useState(0);
 const lastLocation=useRef({path,scope,route:null});
 const staff=/^\/(admin|pos|login|api)(?:\/|$)/.test(path);
 useEffect(()=>{
  if(staff||loading)return;
  const previous=history.scrollRestoration;history.scrollRestoration="manual";
  const save=()=>{
   const route=location.pathname+location.search+location.hash;
   if(path==="/")window.dispatchEvent(new Event("pam-save-listing"));
   const details=[...document.querySelectorAll("details[data-record-key][open]")].map(el=>el.dataset.recordKey);
   saveNavigation(sessionStorage,scope,route,{y:window.scrollY,details},navigationSlot(path,location.hash));
  };
  const click=event=>{
   const link=event.target.closest?.("a[href]");if(!link)return;
   const target=new URL(link.href,location.href);if(target.origin===location.origin)save();
  };
  const changed=()=>setLocationVersion(v=>v+1);
  document.addEventListener("click",click,true);window.addEventListener("pagehide",save);window.addEventListener("pam-save-customer-position",save);window.addEventListener("popstate",changed);window.addEventListener("hashchange",changed);
  return()=>{document.removeEventListener("click",click,true);window.removeEventListener("pagehide",save);window.removeEventListener("pam-save-customer-position",save);window.removeEventListener("popstate",changed);window.removeEventListener("hashchange",changed);history.scrollRestoration=previous;};
 },[path,scope,staff,loading]);
 useLayoutEffect(()=>{
  if(staff||loading)return;
  const route=location.pathname+location.search+location.hash;
  const previous=lastLocation.current;const changed=previous.path!==path||previous.scope!==scope||(previous.route!==null&&previous.route!==route);lastLocation.current={path,scope,route};
  const params=new URLSearchParams(location.search);
  if(params.get("from")==="footer"||params.has("returnToFooter")||location.hash==="#store-footer")return;
  let saved;try{const state=readNavigation(sessionStorage,scope);saved=state.positions[route];if(!saved&&path==="/account"&&!location.hash&&user){saved=state.positions[state.slots.account];}}catch{return;}
  if(!saved){if(changed&&(!location.hash||path==="/account"))window.scrollTo({top:0,behavior:"instant"});return;}
  document.documentElement.dataset.customerRestoring="true";
  let disposed=false,frame=0,settle;
  const apply=()=>{
   if(disposed)return;
   for(const element of document.querySelectorAll("details[data-record-key]"))if(saved.details.includes(element.dataset.recordKey))element.open=true;
   if([...document.querySelectorAll('[data-page-loading="true"]')].some(element=>element.getClientRects().length))return;
   window.scrollTo({top:saved.y,behavior:"instant"});
   clearTimeout(settle);settle=setTimeout(stop,300);
  };
  const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(apply);};
  const observer=new MutationObserver(schedule),resize=new ResizeObserver(schedule);
  const cancel=event=>{if(event.isTrusted)stop();};
  function stop(){if(disposed)return;disposed=true;delete document.documentElement.dataset.customerRestoring;observer.disconnect();resize.disconnect();cancelAnimationFrame(frame);clearTimeout(settle);clearTimeout(deadline);["wheel","touchstart","pointerdown","keydown"].forEach(name=>window.removeEventListener(name,cancel,true));}
  const deadline=setTimeout(stop,15000);
  observer.observe(document.body,{childList:true,subtree:true});resize.observe(document.body);
  ["wheel","touchstart","pointerdown","keydown"].forEach(name=>window.addEventListener(name,cancel,true));
  schedule();return stop;
 },[path,scope,staff,loading,locationVersion]);
 return null;
}
