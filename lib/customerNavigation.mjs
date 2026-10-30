const KEY="pam-customer-navigation-v1:";
const MAX_AGE=8*60*60*1000;
export function customerRoute(value) {
 if(typeof value!=="string"||!value.startsWith("/")||value.startsWith("//")||value.includes("\\"))return null;
 try{const url=new URL(value,"https://pam.local");if(url.origin!=="https://pam.local"||/^\/(admin|pos|login|api)(?:\/|$)/.test(url.pathname))return null;return url.pathname+url.search+url.hash;}catch{return null;}
}
export function navigationSlot(path,hash="") {
 if(path==="/account")return hash==="#orders"?"orders":"account";
 if(path==="/info/delivery"||path==="/info/contact")return "delivery";
 if(path.startsWith("/services")||path==="/request-product")return "services";
 return "home";
}
export function readNavigation(storage,scope="guest",now=Date.now()) {
 try{const value=JSON.parse(storage.getItem(KEY+scope)||"null");return value&&value.version===1&&value.positions&&typeof value.positions==="object"&&!Array.isArray(value.positions)&&value.slots&&typeof value.slots==="object"&&!Array.isArray(value.slots)&&now-value.at<MAX_AGE&&now>=value.at?value:{version:1,at:now,positions:{},slots:{}};}catch{return {version:1,at:now,positions:{},slots:{}};}
}
export function saveNavigation(storage,scope,route,position,slot,now=Date.now()) {
 const safe=customerRoute(route);if(!safe)return;
 const state=readNavigation(storage,scope,now);
 state.at=now;state.positions[safe]={y:Number.isFinite(Number(position.y))?Math.max(0,Number(position.y)):0,details:Array.isArray(position.details)?position.details.filter(v=>typeof v==="string").slice(0,100):[]};
 state.slots[slot]=safe;
 try{storage.setItem(KEY+scope,JSON.stringify(state));}catch{}
 return state;
}
export function navigationTarget(storage,scope,slot,fallback) {
 const target=readNavigation(storage,scope).slots[slot];return customerRoute(target)||fallback;
}
