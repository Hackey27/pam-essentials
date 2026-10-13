export const restockStatuses=["waiting","notified","fulfilled","cancelled"];
export const restockAcknowledgement="You’re on the waiting list for this exact product selection. PAM will contact you when availability is confirmed.";
const field=(v,max,label,required=false)=>{if(v==null)v="";if(typeof v!=="string"||v.length>max||/[\x00-\x1f\x7f]/.test(v))throw new Error(`Check ${label}.`);const s=v.trim();if(required&&!s)throw new Error(`${label} is required.`);return s;};
export function validateRestockRequest(body) {
  if(!body||typeof body!=="object"||Array.isArray(body))throw new Error("Check your restock request.");
  const requestId=field(body.requestId,36,"Request reference",true).toLowerCase();
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(requestId))throw new Error("Reopen the restock form and try again.");
  const productId=field(body.productId,160,"Product",true),name=field(body.name,120,"Name"),method=field(body.method,20,"Contact method",true);
  if(!["whatsapp","email","phone"].includes(method))throw new Error("Choose a contact method.");
  let contact=field(body.contact,254,"Contact details",true);
  if(method==="email"){contact=contact.toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact))throw new Error("Enter a valid email address.");}
  else {if(!/^\+?[\d ()-]{7,25}$/.test(contact))throw new Error("Enter a valid phone number.");contact=contact.replace(/\D/g,"").replace(/^0(?=\d{9}$)/,"233");if(contact.length<7||contact.length>15)throw new Error("Enter a valid phone number.");}
  if(body.consent!==true||body.website)throw new Error("Confirm that PAM may contact you about this product.");
  return {requestId,productId,name,method,contact};
}
export const restockReference=(id)=>`PAM-RST-${id.slice(0,12).toUpperCase()}`;
export const restockIdentity=(value)=>`${value.productId}|${value.method==="email"?"email":"phone"}:${value.contact}`;
export function restockContactLink(record){if(record.method==="email")return `mailto:${record.contact}?subject=${encodeURIComponent(`PAM restock: ${record.productName}`)}`;if(record.method==="phone")return `tel:+${record.contact}`;return `https://wa.me/${record.contact}?text=${encodeURIComponent(`Hello${record.name?` ${record.name}`:""}, regarding your PAM restock request ${record.reference} for ${record.productName} (${record.sku}):`)}`;}
