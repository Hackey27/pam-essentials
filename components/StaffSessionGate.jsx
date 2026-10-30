"use client";
import {createContext,useContext,useEffect,useRef,useState} from "react";
import {EmailAuthProvider,reauthenticateWithCredential} from "firebase/auth";
import {signOut} from "./AuthProvider";
import BrandLogo from "./BrandLogo";
import {STAFF_IDLE_MS,readStaffSession,verifyStaffSession,touchStaffSession} from "@/lib/staffSession.mjs";
const SessionContext=createContext({locked:true});
export const useStaffSession=()=>useContext(SessionContext);
const storage=()=>{try{return window.sessionStorage;}catch{return null;}};

export default function StaffSessionGate({user,children}) {
 const [ready,setReady]=useState(false),[locked,setLocked]=useState(true),[opened,setOpened]=useState(false);
 const [email,setEmail]=useState(user.email||""),[password,setPassword]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false),[expired,setExpired]=useState(false);
 const timer=useRef(null),lastActivity=useRef(0),paused=useRef(true),pending=useRef(false),lockDialog=useRef(null);
 useEffect(()=>{
  const saved=readStaffSession(storage(),user.uid);
  if(saved){lastActivity.current=saved.lastActivity;paused.current=false;setOpened(true);setLocked(false);}
  setReady(true);
 },[user.uid]);
 useEffect(()=>{if(ready&&locked&&lockDialog.current&&!lockDialog.current.open)lockDialog.current.showModal();},[ready,locked]);
 useEffect(()=>{
  if(!ready||locked)return;
  const pause=()=>{paused.current=true;clearTimeout(timer.current);setExpired(true);setPassword("");setLocked(true);window.dispatchEvent(new Event("pam-staff-session-paused"));};
  const arm=()=>{clearTimeout(timer.current);timer.current=setTimeout(pause,Math.max(0,STAFF_IDLE_MS-(Date.now()-lastActivity.current)));};
  const check=()=>{
   if(Date.now()<lastActivity.current||Date.now()-lastActivity.current>=STAFF_IDLE_MS){pause();return false;}
   arm();return true;
  };
  const activity=event=>{
   if(paused.current)return;
   if(!check()){if(event.cancelable)event.preventDefault();event.stopImmediatePropagation();return;}
   const now=Date.now();
   if(now-lastActivity.current<500)return;
   if(!touchStaffSession(storage(),user.uid,now)){pause();return;}
   lastActivity.current=now;arm();
  };
  const visible=()=>{if(!document.hidden)check();};
  const events=["pointerdown","pointermove","keydown","scroll","touchstart"];
  const options={capture:true,passive:false};
  events.forEach(name=>window.addEventListener(name,activity,options));
  window.addEventListener("focus",check);document.addEventListener("visibilitychange",visible);
  check();
  return()=>{clearTimeout(timer.current);events.forEach(name=>window.removeEventListener(name,activity,options));window.removeEventListener("focus",check);document.removeEventListener("visibilitychange",visible);};
 },[ready,locked,user.uid]);

 async function resume(event) {
  event.preventDefault();if(pending.current)return;
  pending.current=true;setBusy(true);setError("");
  try {
   if(email.trim().toLowerCase()!==String(user.email||"").toLowerCase())throw new Error("account-mismatch");
   await reauthenticateWithCredential(user,EmailAuthProvider.credential(email.trim(),password));
   const record=verifyStaffSession(storage(),user.uid);
   lastActivity.current=record.lastActivity;paused.current=false;
   setPassword("");setOpened(true);setLocked(false);setExpired(false);
  } catch(err) {
   setError(err.message==="account-mismatch"?"Use the current staff email, or sign out to change account.":err.code==="auth/network-request-failed"?"Internet is required to resume. Your shift and saved basket are kept.":"The email and password could not be verified. Please try again.");
  } finally {pending.current=false;setBusy(false);}
 }
 async function leave() {
  if(pending.current)return;pending.current=true;setBusy(true);setError("");
  try{await signOut();}catch{setError("Sign out failed. Please try again.");}finally{pending.current=false;setBusy(false);}
 }
 if(!ready)return <main className="pos-entry"><p>Checking staff session…</p></main>;
 return <SessionContext.Provider value={{locked}}>
  {opened&&<div hidden={locked} inert={locked?true:undefined} style={locked?{display:"none"}:undefined}>{children}</div>}
  {locked&&<dialog ref={lockDialog} aria-label="Staff session locked" onCancel={event=>event.preventDefault()} style={{border:0,padding:0,width:"100vw",height:"100dvh",maxWidth:"100vw",maxHeight:"100dvh",background:"#eaf1f7"}}><main className="pos-entry"><section className="pos-entry-card" aria-label="Staff sign in">
   <BrandLogo symbol/><h1>{expired?"Session paused":"Staff sign in"}</h1>
   <p>{expired?"Your session paused after 10 minutes of inactivity. Enter your password to resume.":"Enter your staff email and password to open Admin or POS."}</p>
   <p>Your open shift is kept. Resuming does not start a new shift.</p>
   <form onSubmit={resume}><label htmlFor="staff-resume-email">Staff email<input id="staff-resume-email" required type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)}/></label>
   <label htmlFor="staff-resume-password">Password<input id="staff-resume-password" required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
   {error&&<p className="notice error-notice" role="alert">{error}</p>}
   <button className="button primary full" disabled={busy}>{busy?"Verifying…":expired?"Resume session":"Sign in"}</button></form>
   <button type="button" className="text-button" onClick={leave} disabled={busy}>Sign out / Use another account</button>
   <a className="back-link" href="/">Back to storefront</a>
  </section></main></dialog>}
 </SessionContext.Provider>;
}
