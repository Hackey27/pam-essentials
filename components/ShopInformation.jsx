"use client";
import {createContext,useContext,useEffect,useState} from "react";
import {usePathname} from "next/navigation";
import {checkoutDefaults,normalizeCheckoutPreferences} from "@/lib/shopPreferences.mjs";
const defaults={checkout:checkoutDefaults,synonyms:[]};const Context=createContext(defaults);
export function ShopInformationProvider({children}) {const path=usePathname(),[info,setInfo]=useState(defaults);useEffect(()=>{if(/^\/(admin|pos|login)(?:\/|$)/.test(path))return;let active=true;const refresh=()=>{if(document.hidden)return;fetch("/api/shop-info",{cache:"no-store"}).then(async(r)=>{if(!r.ok)return;const data=await r.json();if(active)setInfo({checkout:normalizeCheckoutPreferences(data.checkout),synonyms:data.synonyms||[]});}).catch(()=>{});};refresh();window.addEventListener("focus",refresh);const timer=setInterval(refresh,60000);return()=>{active=false;clearInterval(timer);window.removeEventListener("focus",refresh);};},[path]);return <Context.Provider value={info}>{children}</Context.Provider>;}
export const useShopInformation=()=>useContext(Context);
