import {normalizeSearchText} from "./productSearch.mjs";
export const CATALOGUE_CACHE_CONTROL="public, s-maxage=60, stale-while-revalidate=300";
export const PUBLIC_CATALOGUE_FIELDS=[
"id","name","description","productType","category","categoryId","subcategory","subcategoryId","subSubcategory","subSubcategoryId",
"productGroupId","variantOptions","variantTitles","colour","size","sku","material","capacity","storage","version","duration","platform","keywords","tags","collections",
"newArrival","clickCount","purchaseCount","rating","price","wholesale","contactForPrice","taxExempt","stock","stockHolds","retailUnit","retailEnabled","catalogueRetirement","active","archived",
"lowStockLevel","imageUrl","images","cardPreviewImagePath","galleryImagePaths","masterImagePath","variantImages","createdAt","pinned","randomColours","randomShapes","randomSizes"
];
export function catalogueQuery(params){
 const keys=["q","categoryId","subcategoryId","subSubcategoryId","page","limit","mode","sort"];
 if([...params.keys()].some(k=>!keys.includes(k))||keys.some(k=>params.getAll(k).length>1))throw Error("Invalid catalogue query.");
 const page=Number(params.get("page")||1),limit=Number(params.get("limit")||60),mode=params.get("mode")||"retail",sort=params.get("sort")||"default",q=(params.get("q")||"").trim();
 if(!Number.isSafeInteger(page)||page<1||page>100000||!Number.isSafeInteger(limit)||limit<1||limit>120||!["retail","wholesale"].includes(mode)||!["default","name","price-asc","price-desc"].includes(sort)||q.length>160)throw Error("Invalid catalogue query.");
 for(const key of ["categoryId","subcategoryId","subSubcategoryId"])if((params.get(key)||"").length>160)throw Error("Invalid category filter.");
 return {page,limit,mode,sort,q,...Object.fromEntries(["categoryId","subcategoryId","subSubcategoryId"].map(k=>[k,params.get(k)||""]))};
}
export function cataloguePage(snapshot,query){
 if(!query)return snapshot;
 const terms=normalizeSearchText(query.q).split(" ").filter(Boolean);
 const items=(query.mode==="wholesale"?snapshot.wholesaleProducts:snapshot.products).filter(p=>["categoryId","subcategoryId","subSubcategoryId"].every(k=>!query[k]||p[k]===query[k])&&terms.every(t=>normalizeSearchText([p.name,p.sku,...(p.keywords||[]),p.category,p.subcategory,p.productType].join(" ")).includes(t)));
 if(query.sort==="name")items.sort((a,b)=>a.name.localeCompare(b.name));
 if(query.sort.startsWith("price-"))items.sort((a,b)=>(query.sort==="price-asc"?1:-1)*(Number(a.price)-Number(b.price))||a.name.localeCompare(b.name));
 const page=items.slice((query.page-1)*query.limit,query.page*query.limit);
 return {...snapshot,products:query.mode==="retail"?page:[],wholesaleProducts:query.mode==="wholesale"?page:[],pagination:{page:query.page,limit:query.limit,total:items.length,hasMore:query.page*query.limit<items.length,mode:query.mode}};
}
