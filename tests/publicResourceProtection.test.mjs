import test from "node:test";
import assert from "node:assert/strict";
import {createSingleFlightCache} from "../lib/singleFlightCache.mjs";
import {IMAGE_WIDTHS,IMAGE_QUALITIES,imageRequestOptions,imageWidth,imageQuality,imageVariantPath} from "../lib/imageVariants.mjs";
import {createStoredImageService} from "../lib/storedImages.mjs";
import {cataloguePage,catalogueQuery} from "../lib/publicCatalogue.mjs";
test("catalogue requests coalesce and expire; a failed build is retried",async()=>{
 let time=0,calls=0;const key={},cache=createSingleFlightCache({ttl:60000,now:()=>time}),build=async()=>({version:++calls});
 const results=await Promise.all(Array.from({length:30},()=>cache.get(key,build)));assert.equal(calls,1);assert.ok(results.every(v=>v===results[0]));
 time=59999;await cache.get(key,build);assert.equal(calls,1);time=60000;await cache.get(key,build);assert.equal(calls,2);
 cache.invalidate(key);await assert.rejects(cache.get(key,async()=>{throw Error("network");}));await cache.get(key,build);assert.equal(calls,3);
});
test("only the fixed image variants are accepted; extra query strings cannot bypass cache keys",()=>{
 for(const w of IMAGE_WIDTHS)for(const q of IMAGE_QUALITIES)assert.deepEqual(imageRequestOptions(new URLSearchParams({w:String(w),q:String(q),fmt:"webp"})),{width:w,quality:q,format:"webp"});
 for(const query of ["w=350","q=80","w=1600&q=95","fmt=avif","w=160&w=320","q=70&q=85","w=0160","w=160&cachebust=random","fmt=webp&fmt=webp"])assert.equal(imageRequestOptions(new URLSearchParams(query)),null,query);
 assert.equal(imageWidth(350),640);assert.equal(imageWidth(5000),1600);assert.equal(imageQuality(80),85);
});
test("stored image reads never transform originals; duplicates coalesce and memory cache avoids repeated storage downloads",async()=>{
 let reads=0;const bucket={file:()=>({download:async()=>{reads++;await Promise.resolve();return [Buffer.from("stored webp")];}})};
 const images=createStoredImageService(bucket),options={width:320,quality:85};
 const results=await Promise.all(Array.from({length:20},()=>images.read("products/a/gallery/a.jpg",options)));assert.equal(reads,1);assert.ok(results.every(v=>v.variant));await images.read("products/a/gallery/a.jpg",options);assert.equal(reads,1);
});
test("legacy originals remain visible and uncached locally; oversized or non-image originals are refused",async()=>{
 let type="image/jpeg",size=3;const bucket={file:path=>path.startsWith("image-variants/")?{download:async()=>{const e=Error("missing");e.code=404;throw e;}}:{getMetadata:async()=>[{contentType:type,size}],download:async()=>[Buffer.from("old")]}};
 const images=createStoredImageService(bucket),options={width:320,quality:85};
 assert.equal((await images.read("products/a/gallery/a.jpg",options)).variant,false);
 type="text/html";await assert.rejects(images.read("products/a/gallery/b.jpg",options));type="image/jpeg";size=30*1024*1024;await assert.rejects(images.read("products/a/gallery/c.jpg",options));
});
test("image read admission caps independent concurrent storage work and returns capacity after completion",async()=>{
 const releases=[];const bucket={file:()=>({download:()=>new Promise(resolve=>releases.push(()=>resolve([Buffer.from("v")])) )})},images=createStoredImageService(bucket,{concurrency:4}),options={width:320,quality:85};
 const work=Array.from({length:4},(_,i)=>images.read("image"+i,options));await assert.rejects(images.read("fifth",options),e=>e.code==="IMAGE_BUSY");assert.equal(releases.length,4);releases.forEach(done=>done());await Promise.all(work);const retry=images.read("fifth",options);releases.at(-1)();await retry;
});
test("server-side catalogue pagination filters without dropping the legacy default payload",()=>{
 const products=[{id:"1",name:"Blue pen",sku:"P1",categoryId:"writing",keywords:["biro"],price:5},{id:"2",name:"Red pen",sku:"P2",categoryId:"writing",keywords:[],price:8},{id:"3",name:"Bottle",categoryId:"bottles",keywords:[],price:20}];
 const snapshot={products,wholesaleProducts:products,announcements:[]};assert.equal(cataloguePage(snapshot,null),snapshot);
 const result=cataloguePage(snapshot,catalogueQuery(new URLSearchParams("q=pen&categoryId=writing&limit=1&page=2&sort=name")));assert.equal(result.products[0].id,"2");assert.equal(result.pagination.total,2);assert.equal(result.pagination.hasMore,false);assert.equal(result.wholesaleProducts.length,0);
 for(const query of ["limit=10000","page=-1","mode=admin","q=a&q=b","token=private"])assert.throws(()=>catalogueQuery(new URLSearchParams(query)));
});

test("image memory cache evicts old entries within both byte and entry budgets",async()=>{
 let reads=0;const bucket={file:()=>({download:async()=>{reads++;return [Buffer.from("abc")];}})},options={width:160,quality:70};
 const images=createStoredImageService(bucket,{maxCacheBytes:4,maxCacheEntries:1});
 await images.read("one",options);await images.read("two",options);await images.read("one",options);assert.equal(reads,3);
});
