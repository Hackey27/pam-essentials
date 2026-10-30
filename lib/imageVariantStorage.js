import sharp from "sharp";
import {IMAGE_WIDTHS,IMAGE_QUALITIES,imageVariantPath} from "./imageVariants.mjs";
// Authenticated uploads only. Public image serving never invokes Sharp.
let uploads=0;
export async function writeImageVariants(bucket,path,bytes){
 if(uploads>=1){const error=Error("Image processing is busy. Try uploading again shortly.");error.code="IMAGE_BUSY";throw error;}
 uploads++;
 try{
  const marker=bucket.file(`image-variants/v1/${path}/ready.json`);
  const [ready]=await marker.exists();if(ready)return {alreadyReady:true};
  for(const width of IMAGE_WIDTHS)for(const quality of IMAGE_QUALITIES){
   const image=await sharp(bytes,{limitInputPixels:40_000_000,failOn:"error"}).rotate().resize({width,withoutEnlargement:true}).webp({quality,effort:3}).toBuffer();
   try{await bucket.file(imageVariantPath(path,{width,quality})).save(image,{resumable:false,preconditionOpts:{ifGenerationMatch:0},metadata:{contentType:"image/webp",cacheControl:"public,max-age=31536000,immutable"}});}
   catch(error){if(error?.code!==412)throw error;}
  }
  await marker.save(JSON.stringify({version:1,widths:IMAGE_WIDTHS,qualities:IMAGE_QUALITIES}),{resumable:false,preconditionOpts:{ifGenerationMatch:0},metadata:{contentType:"application/json",cacheControl:"private,no-store"}});
  return {alreadyReady:false};
 }finally{uploads--;}
}
