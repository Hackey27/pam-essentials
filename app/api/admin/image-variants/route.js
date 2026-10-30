import {NextResponse} from "next/server";
import {Storage} from "@google-cloud/storage";
import {FieldPath} from "firebase-admin/firestore";
import {adminDb,requireRole} from "@/lib/admin";
import {isProductImagePath} from "@/lib/productImages.mjs";
import {isHeroImagePath} from "@/lib/heroImages.mjs";
import {writeImageVariants} from "@/lib/imageVariantStorage";
const bucket=new Storage().bucket(process.env.STORAGE_BUCKET_NAME||"pam-essentials-2d7fb.firebasestorage.app");
const headers={"cache-control":"private,no-store"};
const valid=path=>isProductImagePath(path)||isHeroImagePath(path);
function collect(value,paths){if(typeof value==="string"&&valid(value))paths.add(value);else if(Array.isArray(value))value.forEach(v=>collect(v,paths));else if(value&&typeof value==="object")Object.values(value).forEach(v=>collect(v,paths));}
export async function GET(request){
 const access=await requireRole(request,["owner","admin"]);if(access.error)return NextResponse.json({error:access.error},{status:access.status,headers});
 try{
  const cursor=new URL(request.url).searchParams.get("cursor")||"";if(cursor.length>500||cursor.includes("/"))return NextResponse.json({error:"Invalid cursor."},{status:400,headers});
  const store=adminDb();let query=store.collection("products").select("cardPreviewImagePath","galleryImagePaths","masterImagePath","variantImages").orderBy(FieldPath.documentId()).limit(25);
  if(cursor)query=query.startAfter(cursor);
  const docs=await query.get(),paths=new Set();docs.docs.forEach(doc=>collect(doc.data(),paths));
  if(!cursor){const hero=await store.getAll(...["HERO_WEB_IMAGE_PATH","HERO_MOBILE_IMAGE_PATH","HERO_WEB_IMAGES","HERO_MOBILE_IMAGES"].map(key=>store.collection("settings").doc(key)));hero.forEach(doc=>collect(doc.data(),paths));}
  return NextResponse.json({paths:[...paths],nextCursor:docs.size===25?docs.docs.at(-1).id:null},{headers});
 }catch{return NextResponse.json({error:"Image inventory could not be loaded."},{status:503,headers});}
}
export async function POST(request){
 const access=await requireRole(request,["owner","admin"]);if(access.error)return NextResponse.json({error:access.error},{status:access.status,headers});
 const body=await request.json().catch(()=>null),path=body?.path;
 if(!valid(path))return NextResponse.json({error:"Choose a valid product or hero image."},{status:400,headers});
 try{
  const [ready]=await bucket.file(`image-variants/v1/${path}/ready.json`).exists();if(ready)return NextResponse.json({path,alreadyReady:true},{headers});
  const original=bucket.file(path),[metadata]=await original.getMetadata(),size=Number(metadata.size);
  if(!/^image\/(jpeg|png|webp|avif)$/.test(metadata.contentType||"")||!size||size>20*1024*1024)return NextResponse.json({error:"Unsupported or oversized original image."},{status:400,headers});
  const [bytes]=await original.download();const result=await writeImageVariants(bucket,path,bytes);
  return NextResponse.json({path,...result},{headers});
 }catch(error){
  return NextResponse.json({error:error?.code==="IMAGE_BUSY"?error.message:"Stored image sizes could not be generated. The original is unchanged."},{status:error?.code==="IMAGE_BUSY"?429:503,headers:{...headers,"retry-after":"3"}});
 }
}
