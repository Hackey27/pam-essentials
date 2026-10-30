import {NextResponse} from "next/server";
import {Storage} from "@google-cloud/storage";
import {isProductImagePath} from "@/lib/productImages.mjs";
import {isHeroImagePath} from "@/lib/heroImages.mjs";
import {imageRequestOptions} from "@/lib/imageVariants.mjs";
import {createStoredImageService} from "@/lib/storedImages.mjs";
export const runtime="nodejs";
const images=createStoredImageService(new Storage().bucket(process.env.STORAGE_BUCKET_NAME||"pam-essentials-2d7fb.firebasestorage.app"));
export async function GET(request,{params}){
 const path=(await params).path.join("/"),options=imageRequestOptions(new URL(request.url).searchParams);
 if(!(isProductImagePath(path)||isHeroImagePath(path))||!options)return NextResponse.json({error:"Invalid image request."},{status:400,headers:{"cache-control":"no-store"}});
 try{
  const result=await images.read(path,options);
  return new Response(result.bytes,{headers:{"content-type":result.type,"cache-control":result.variant?"public, max-age=31536000, s-maxage=31536000, immutable":"public, max-age=60, s-maxage=60","x-content-type-options":"nosniff","x-image-source":result.variant?"stored-variant":"legacy-original"}});
 }catch(error){
  if(error?.code==="IMAGE_BUSY")return NextResponse.json({error:error.message},{status:503,headers:{"cache-control":"no-store","retry-after":"1"}});
  if(error?.code===404)return NextResponse.json({error:"Image not found."},{status:404,headers:{"cache-control":"public, max-age=30"}});
  console.error("Stored image read failed",{path,code:error?.code});
  return NextResponse.json({error:"Image unavailable."},{status:503,headers:{"cache-control":"no-store","retry-after":"2"}});
 }
}
