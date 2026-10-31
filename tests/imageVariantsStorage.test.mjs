import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {writeImageVariants} from "../lib/imageVariantStorage.js";
import {IMAGE_WIDTHS,IMAGE_QUALITIES,imageVariantPath} from "../lib/imageVariants.mjs";
test("authenticated variant generation creates fixed immutable files once and leaves the original untouched",async()=>{
 const objects=new Map(),path="products/a/gallery/a.png",original=await sharp({create:{width:24,height:12,channels:3,background:"red"}}).png().toBuffer();objects.set(path,{bytes:original});
 const bucket={file:key=>({exists:async()=>[objects.has(key)],save:async(bytes,options)=>{if(objects.has(key)&&options.preconditionOpts?.ifGenerationMatch===0){const e=Error("exists");e.code=412;throw e;}objects.set(key,{bytes,options});}})};
 assert.deepEqual(await writeImageVariants(bucket,path,original),{alreadyReady:false});
 for(const width of IMAGE_WIDTHS)for(const quality of IMAGE_QUALITIES){const saved=objects.get(imageVariantPath(path,{width,quality}));assert.equal(saved.options.metadata.contentType,"image/webp");assert.match(saved.options.metadata.cacheControl,/immutable/);assert.equal((await sharp(saved.bytes).metadata()).format,"webp");}
 assert.equal(objects.size,12);assert.equal(objects.get(path).bytes,original);
 assert.deepEqual(await writeImageVariants(bucket,path,original),{alreadyReady:true});assert.equal(objects.size,12);
});

test("stored variants retain transparency and respect EXIF orientation without upscaling", async () => {
 const sources = [
  { bytes: await sharp({create:{width:20,height:10,channels:4,background:{r:20,g:80,b:120,alpha:0.5}}}).png().toBuffer(), width:20, height:10, alpha:true },
  { bytes: await sharp({create:{width:20,height:10,channels:3,background:"red"}}).jpeg().withMetadata({orientation:6}).toBuffer(), width:10, height:20, alpha:false },
 ];
 for (const [index, source] of sources.entries()) {
  const saved = new Map();
  const bucket = {file:key=>({exists:async()=>[false],save:async bytes=>{saved.set(key,bytes);}})};
  const path = `products/test/gallery/source-${index}.png`;
  await writeImageVariants(bucket,path,source.bytes);
  for (const width of IMAGE_WIDTHS) {
   const metadata=await sharp(saved.get(imageVariantPath(path,{width,quality:85}))).metadata();
   assert.equal(metadata.width,source.width);assert.equal(metadata.height,source.height);assert.equal(metadata.hasAlpha,source.alpha);
  }
 }
});

test("a failed storage write leaves no ready marker and allows a retry", async () => {
 const bytes=await sharp({create:{width:20,height:20,channels:3,background:"blue"}}).png().toBuffer();
 const saved=new Map();let fail=true;
 const bucket={file:key=>({exists:async()=>[saved.has(key)],save:async image=>{if(fail){fail=false;throw Error("Storage unavailable");}saved.set(key,image);}})};
 const path="products/test/gallery/retry.png";
 await assert.rejects(writeImageVariants(bucket,path,bytes),/Storage unavailable/);
 assert.equal(saved.has(`image-variants/v1/${path}/ready.json`),false);
 await writeImageVariants(bucket,path,bytes);
 assert.equal(saved.has(`image-variants/v1/${path}/ready.json`),true);
});

test("failed writes retain the processing slot until their sibling upload finishes", async () => {
 const bytes=await sharp({create:{width:20,height:20,channels:3,background:"blue"}}).png().toBuffer();
 let calls=0,releaseSecond,secondStarted;
 const started=new Promise(resolve=>{secondStarted=resolve;});
 const bucket={file:()=>({exists:async()=>[false],save:async()=>{calls++;if(calls===1)throw Error("Storage unavailable");if(calls===2)await new Promise(resolve=>{releaseSecond=resolve;secondStarted();});}})};
 const failed=assert.rejects(writeImageVariants(bucket,"products/test/gallery/one.png",bytes),/Storage unavailable/);
 await started;await Promise.resolve();await Promise.resolve();
 await assert.rejects(writeImageVariants(bucket,"products/test/gallery/two.png",bytes),error=>error.code==="IMAGE_BUSY");
 releaseSecond();await failed;
 await writeImageVariants(bucket,"products/test/gallery/two.png",bytes);
});
