"use client";
import {useEffect,useState} from "react";
export default function useSearchPrompt(terms,enabled){
 const [text,setText]=useState("products or categories");
 const key=terms.filter(Boolean).slice(0,12).join("|");
 useEffect(()=>{
  const media=matchMedia("(prefers-reduced-motion: reduce)");
  if(!enabled||media.matches){setText("products or categories");return;}
  const words=key.split("|").filter(Boolean);if(!words.length)return;
  let timer,index=0,length=0,erasing=false,disposed=false;
  function next(){
   if(disposed)return;
   if(document.hidden){timer=setTimeout(next,1000);return;}
   const word=words[index];setText(word.slice(0,length));
   let delay=erasing?65:110;
   if(!erasing&&length===word.length){erasing=true;delay=1700;}
   else if(erasing&&length===0){erasing=false;index=(index+1)%words.length;delay=280;}
   else length+=erasing?-1:1;
   timer=setTimeout(next,delay);
  }
  const changed=()=>{if(media.matches){clearTimeout(timer);setText("products or categories");}else{clearTimeout(timer);next();}};
  next();media.addEventListener("change",changed);
  return()=>{disposed=true;clearTimeout(timer);media.removeEventListener("change",changed);};
 },[key,enabled]);
 return "Search for "+text;
}
