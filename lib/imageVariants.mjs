export const IMAGE_WIDTHS=Object.freeze([160,320,640,960,1600]);
export const IMAGE_QUALITIES=Object.freeze([70,85]);
export function imageWidth(value=960){const n=Number(value);return IMAGE_WIDTHS.find(w=>w>=(Number.isFinite(n)?n:960))||1600;}
export function imageQuality(value=85){return Number(value)<=70?70:85;}
export function imageRequestOptions(params){
 if([...params.keys()].some(key=>!["w","q","fmt"].includes(key))||["w","q","fmt"].some(key=>params.getAll(key).length>1))return null;
 const width=params.get("w")??"960",quality=params.get("q")??"85",format=params.get("fmt")??"webp";
 if(!IMAGE_WIDTHS.some(w=>String(w)===width)||!IMAGE_QUALITIES.some(q=>String(q)===quality)||format!=="webp")return null;
 return {width:Number(width),quality:Number(quality),format};
}
export function imageVariantPath(path,{width,quality}){return `image-variants/v1/${path}/w${width}-q${quality}.webp`;}
export function imageVariantUrl(path,width=960,quality=85){return `/images/${path}?w=${imageWidth(width)}&fmt=webp&q=${imageQuality(quality)}`;}
