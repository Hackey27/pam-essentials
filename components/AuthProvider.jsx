"use client";
import {createContext,useContext,useEffect,useRef,useState} from "react";
import {onAuthStateChanged,signOut as fbSignOut} from "firebase/auth";
import {doc,onSnapshot} from "firebase/firestore";
import {auth,db} from "@/lib/firebase";
import {clearStaffSession} from "@/lib/staffSession.mjs";

const AuthContext=createContext({user:null,role:null,loading:true,roleError:"",retryRole:()=>{}});
export function AuthProvider({children}) {
 const [user,setUser]=useState(null),[role,setRole]=useState(null),[loading,setLoading]=useState(true),[roleError,setRoleError]=useState("");
 const refreshRef=useRef(()=>{});
 useEffect(()=>onAuthStateChanged(auth,u=>{
  setUser(u);setRole(null);setRoleError("");setLoading(Boolean(u));
 }),[]);
 useEffect(()=>{
  if(!user)return;
  let live=true,running=false,controller;
  // Verify against the same server database used by Admin/POS APIs.
  // A denied/offline Firestore browser listener is not proof of a missing role.
  async function refresh() {
   if(!live||running)return;running=true;
   controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),10000);
   try {
    const token=await user.getIdToken();
    const response=await fetch("/api/staff/session",{headers:{authorization:"Bearer "+token},cache:"no-store",signal:controller.signal});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||"Staff access could not be checked.");
    if(result.uid!==user.uid)throw new Error("The account changed. Sign in again.");
    if(live){setRole(result.role||null);setRoleError(result.active===false?"This staff account is inactive. Ask the owner to review it.":"");}
   } catch(error) {
    if(live){setRole(null);setRoleError(error.name==="AbortError"||error instanceof TypeError?"Staff access could not be checked. Check your connection and retry.":error.message||"Staff access could not be checked. Please retry.");}
   } finally {clearTimeout(timeout);running=false;if(live)setLoading(false);}
  }
  refreshRef.current=refresh;refresh();
  const unsubscribe=onSnapshot(doc(db,"users",user.uid),snapshot=>{if(!snapshot.metadata.fromCache)refresh();},()=>refresh());
  const focus=()=>{if(!document.hidden)refresh();};
  window.addEventListener("focus",focus);
  const timer=setInterval(focus,60000);
  return()=>{live=false;controller?.abort();unsubscribe();clearInterval(timer);window.removeEventListener("focus",focus);refreshRef.current=()=>{};};
 },[user]);
 const retryRole=()=>refreshRef.current();
 return <AuthContext.Provider value={{user,role,loading,roleError,retryRole}}>{children}</AuthContext.Provider>;
}
export const useAuth=()=>useContext(AuthContext);
export const signOut=async()=>{
 const uid=auth.currentUser?.uid;await fbSignOut(auth);
 if(uid){let store;try{store=window.sessionStorage;}catch{}clearStaffSession(store,uid);}
};
