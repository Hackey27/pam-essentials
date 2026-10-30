export const STAFF_IDLE_MS=10*60*1000;
const PREFIX="pam-staff-session-v1:";
const fallback=new Map();
export function staffSessionActive(record,uid,now=Date.now()) {
 return Boolean(record&&record.uid===uid&&Number.isFinite(record.verifiedAt)&&Number.isFinite(record.lastActivity)&&record.verifiedAt<=record.lastActivity&&record.lastActivity<=now&&now-record.lastActivity<STAFF_IDLE_MS);
}
export function readStaffSession(storage,uid,now=Date.now()) {
 let record;
 try { const saved=storage?.getItem(PREFIX+uid);record=saved?JSON.parse(saved):fallback.get(uid); } catch {record=fallback.get(uid);}
 return staffSessionActive(record,uid,now)?record:null;
}
function save(storage,record) {
 fallback.set(record.uid,record);
 try{storage?.setItem(PREFIX+record.uid,JSON.stringify(record));}catch{}
 return record;
}
// Call only after Firebase has verified an email/password sign-in or reauthentication.
export function verifyStaffSession(storage,uid,now=Date.now()) {
 return save(storage,{uid,verifiedAt:now,lastActivity:now});
}
export function touchStaffSession(storage,uid,now=Date.now()) {
 const record=readStaffSession(storage,uid,now);
 return record?save(storage,{...record,lastActivity:now}):null;
}
export function clearStaffSession(storage,uid) {
 fallback.delete(uid);try{storage?.removeItem(PREFIX+uid);}catch{}
}
