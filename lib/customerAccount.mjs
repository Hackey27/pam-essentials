export const customerTabs=["orders","wishlist","requests","details"];
export function customerTab(hash,fallback="orders"){const key=String(hash||"").replace(/^#/,"");return customerTabs.includes(key)?key:customerTabs.includes(fallback)?fallback:"orders";}
export function customerFirstName(profile={},user={}){return String(profile.name||user.displayName||"").trim().split(/\s+/)[0]||"there";}
export function customerNotifications(orders=[],requests=[],seenAt=null) {
 const seen=Date.parse(seenAt||"")||0;
 return [...orders.map(order=>({key:"order:"+order.orderId,title:"Order "+order.orderId,description:String(order.status||"Update").replaceAll("-"," "),at:order.updatedAt||order.createdAt,tab:"orders"})),...requests.map(record=>({key:record.kind+":"+record.id,title:record.productName||"Your request",description:String(record.status||"Update").replaceAll("-"," "),at:record.updatedAt||record.createdAt,tab:"requests"}))]
 .filter(item=>Number.isFinite(Date.parse(item.at||""))).map(item=>({...item,unread:Date.parse(item.at)>seen})).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));
}
export function validCustomerSignup({name,phone,password,confirmation}) {
 if(!String(name||"").trim()||String(name).length>120)return "Enter your name.";
 if(!/^\+?[\d ()-]{6,40}$/.test(String(phone||"").trim()))return "Enter a valid phone number (WhatsApp preferred).";
 if(String(password||"").length<6)return "Use a password of at least six characters.";
 if(password!==confirmation)return "The passwords do not match.";
 return "";
}
