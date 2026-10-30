// One shared build per key, regardless of request query. Never cache failures.
export function createSingleFlightCache({ttl=60000,now=Date.now}={}){
 const entries=new WeakMap();
 return {
  async get(key,load){
   let entry=entries.get(key);
   if(entry?.promise)return entry.promise;
   if(entry?.hasValue&&now()-entry.at<ttl)return entry.value;
   entry={at:0,hasValue:false};entries.set(key,entry);
   entry.promise=Promise.resolve().then(load).then(value=>{entry.value=value;entry.hasValue=true;entry.at=now();entry.promise=null;return value;},error=>{entries.delete(key);throw error;});
   return entry.promise;
  },
  invalidate(key){entries.delete(key);}
 };
}
