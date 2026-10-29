import { matchesSearch } from "./catalogueBrowse.mjs";
import { normalizeSearchText, productSearchKeywords } from "./productSearch.mjs";
export function validSynonyms(value) {return Array.isArray(value)&&value.length<=100&&value.every((g)=>g&&typeof g==="object"&&!Array.isArray(g)&&Array.isArray(g.terms)&&g.terms.length>=2&&g.terms.length<=12&&g.terms.every((v)=>typeof v==="string"&&v.trim().length>=2&&v.length<=80&&!/[\x00-\x1f\x7f]/.test(v))&&(g.active===undefined||typeof g.active==="boolean"));}
export function normalizedSynonyms(value) {return validSynonyms(value)?value.filter((g)=>g.active!==false).map((g)=>({terms:[...new Set(g.terms.map(normalizeSearchText))]})):[];}
export function spellingDistance(a,b) {
 if(Math.abs(a.length-b.length)>2)return 3;let previous=Array.from({length:b.length+1},(_,i)=>i),before=previous;
 for(let i=1;i<=a.length;i++){const row=[i];for(let j=1;j<=b.length;j++){row[j]=Math.min(row[j-1]+1,previous[j]+1,previous[j-1]+(a[i-1]===b[j-1]?0:1));if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])row[j]=Math.min(row[j],before[j-2]+1);}before=previous;previous=row;}return previous[b.length];
}
// Normalise words for matching only; never change saved names, SKUs or tags.
function singular(word) {
 if(word.length>4&&word.endsWith("ies"))return word.slice(0,-3)+"y";
 if(/(?:boxes|brushes|watches|classes)$/u.test(word))return word.slice(0,-2);
 if(word.length>3&&word.endsWith("s")&&!/(?:ss|us|is)$/u.test(word))return word.slice(0,-1);
 return word;
}
const words=value=>normalizeSearchText(value).split(" ").filter(Boolean).map(singular);
const indexCache=new WeakMap();
function searchIndex(products) {
 if(indexCache.has(products))return indexCache.get(products);
 const index=products.map(product=>{
  const name=words(product.name);
  const fields=[product.name,product.category,product.subcategory,product.subSubcategory,...Object.values(product.variantOptions||{}),...productSearchKeywords(product)].filter(Boolean).map(words);
  return {product,name,fields,tokens:[...new Set(fields.flat())]};
 });
 indexCache.set(products,index);return index;
}
function directScore(entry,query,term) {
 const name=entry.name.join(" "),phrase=term.join(" ");
 if(name===phrase)return 0;
 if(name.startsWith(phrase))return 1;
 if(term.every(word=>entry.name.includes(word)))return 2;
 if(term.every(word=>entry.name.some(token=>token.includes(word))))return 3;
 if(entry.fields.some(field=>field.join("").includes(term.join(""))))return 4;
 if(matchesSearch(entry.product,query)||term.every(word=>entry.tokens.some(token=>token.includes(word))))return 5;
 return null;
}
function closeMatch(entry,terms) {
 let distance=0;const corrected=[];
 for(const word of terms) {
  if(entry.tokens.includes(word)){corrected.push(word);continue;}
  // Short words and numeric identifiers must match exactly, never be guessed.
  if(!/^[\p{L}]{4,28}$/u.test(word))return null;
  const limit=word.length>=7?2:1;
  const candidates=entry.tokens.filter(token=>/^[\p{L}]{3,28}$/u.test(token)&&Math.abs(token.length-word.length)<=limit)
   .map(token=>({word:token,d:spellingDistance(word,token),name:entry.name.includes(token)}))
   .filter(candidate=>candidate.d<=limit).sort((a,b)=>a.d-b.d||Number(b.name)-Number(a.name)||a.word.localeCompare(b.word));
  if(!candidates.length)return null;
  distance+=candidates[0].d;corrected.push(candidates[0].word);
 }
 return distance?{distance,correction:corrected.join(" ")}:null;
}
export function searchCatalogue(products,query,synonyms=[],exactOnly=false) {
 const normal=normalizeSearchText(query),terms=words(query);
 const result={products:[],exactCount:0,correction:"",synonym:false,fuzzyCount:0};
 if(!normal)return {...result,products:[...products],exactCount:products.length};
 const index=searchIndex(products),ranked=[],alternatives=new Set();
 const identifier=/\d/u.test(normal)&&!/[\s]/u.test(String(query).trim());
 if(!exactOnly&&!identifier&&normal.length<=100)for(const group of normalizedSynonyms(synonyms))for(const alias of group.terms)
  if((" "+normal+" ").includes(" "+alias+" "))for(const other of group.terms)if(other!==alias)alternatives.add((" "+normal+" ").replace(" "+alias+" "," "+other+" ").trim());
 for(const entry of index) {
  // SKU/ID queries are literal, including their punctuation.
  const score=identifier?(matchesSearch(entry.product,query)?0:null):directScore(entry,query,terms);
  if(score!==null){result.exactCount++;ranked.push({entry,score});continue;}
  if(exactOnly||identifier||normal.length>100)continue;
  if([...alternatives].some(alias=>directScore(entry,alias,words(alias))!==null)){
   ranked.push({entry,score:6});result.synonym=true;continue;
  }
  const close=closeMatch(entry,terms);
  if(close){ranked.push({entry,score:10+close.distance,correction:close.correction});result.fuzzyCount++;}
 }
 ranked.sort((a,b)=>a.score-b.score||String(a.entry.product.name||"").localeCompare(String(b.entry.product.name||""))||String(a.entry.product.id||"").localeCompare(String(b.entry.product.id||"")));
 result.products=ranked.map(match=>match.entry.product);
 if(!result.exactCount&&!result.synonym)result.correction=ranked.find(match=>match.correction)?.correction||"";
 return result;
}
