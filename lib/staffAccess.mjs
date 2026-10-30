export const STAFF_ROLES=["owner","admin","supervisor","cashier"];
export function staffAccess(profile={},claims={}) {
 const role=profile.role||claims.role||null;
 return {role:profile.active===false?null:STAFF_ROLES.includes(role)?role:null,active:profile.active!==false};
}
export function loginDestination(search="") {
 const next=new URLSearchParams(search).get("next");
 return next==="/admin"||next==="/pos"?next:"";
}
export function staffLoginUrl(pathname) {
 return "/login?next="+encodeURIComponent(pathname==="/pos"?"/pos":"/admin");
}
export function afterStaffLogin(destination,role) {
 return destination==="/admin"||destination==="/pos"?destination:role==="cashier"?"/pos":"/admin";
}
