// Shift instants stay in UTC in storage; all POS header times use the shop's timezone.
export function shiftTimestamp(value) {
 try {
  let date;
  if(value instanceof Date)date=value;
  else if(typeof value?.toDate==="function")date=value.toDate();
  else if(typeof value==="string"&&value.trim())date=new Date(value);
  else if(value&&typeof value==="object"&&Number.isFinite(value.seconds??value._seconds)){
   date=new Date((value.seconds??value._seconds)*1000+Number(value.nanoseconds??value._nanoseconds??0)/1e6);
  }
  return date instanceof Date&&Number.isFinite(date.getTime())?date.toISOString():null;
 } catch { return null; }
}
const formatter=new Intl.DateTimeFormat("en-GH",{
 timeZone:"Africa/Accra",day:"numeric",month:"short",year:"numeric",
 hour:"numeric",minute:"2-digit",hour12:true
});
export function formatPosDateTime(value) {
 const instant=shiftTimestamp(value);
 return instant?formatter.format(new Date(instant)):"Not recorded";
}
