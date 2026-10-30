import {imageVariantPath} from "./imageVariants.mjs";
const maxBytes=20*1024*1024;
export function createStoredImageService(bucket,{concurrency=4,maxCacheBytes=32*1024*1024,maxCacheEntries=256,now=Date.now}={}){
 const pending=new Map(),cache=new Map();let active=0,cacheBytes=0;
 const busy=()=>{const e=Error("Image service is busy. Please retry.");e.code="IMAGE_BUSY";return e;};
 async function download(path,options){
  try{const [bytes]=await bucket.file(imageVariantPath(path,options)).download();if(bytes.length>maxBytes)throw Error("Stored image too large.");return {bytes,type:"image/webp",variant:true};}
  catch(error){if(error?.code!==404)throw error;}
  const original=bucket.file(path),[metadata]=await original.getMetadata(),size=Number(metadata.size);
  if(!/^image\/(jpeg|png|webp|avif)$/.test(metadata.contentType||"")||!Number.isFinite(size)||size<=0||size>maxBytes){const e=Error("Image unavailable");e.code=404;throw e;}
  const [bytes]=await original.download();if(bytes.length>maxBytes)throw Error("Stored image too large.");
  return {bytes,type:metadata.contentType,variant:false};
 }
 return {async read(path,options){
  const key=imageVariantPath(path,options),saved=cache.get(key);
  if(saved&&now()-saved.at<300000){cache.delete(key);cache.set(key,saved);return saved.result;}
  if(saved){cache.delete(key);cacheBytes-=saved.result.bytes.length;}
  if(pending.has(key))return pending.get(key);
  if(active>=concurrency)throw busy();
  active++;
  const work=download(path,options).then(result=>{
   if(result.variant&&result.bytes.length<=4*1024*1024){
    while(cache.size&&(cacheBytes+result.bytes.length>maxCacheBytes||cache.size>=maxCacheEntries)){const oldest=cache.keys().next().value;cacheBytes-=cache.get(oldest).result.bytes.length;cache.delete(oldest);}
    if(result.bytes.length<=maxCacheBytes){cache.set(key,{at:now(),result});cacheBytes+=result.bytes.length;}
   }
   return result;
  }).finally(()=>{active--;pending.delete(key);});
  pending.set(key,work);return work;
 }};
}
