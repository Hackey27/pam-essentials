import { matchesSearch } from "./catalogueBrowse.mjs";
import { normalizeSearchText, productSearchKeywords } from "./productSearch.mjs";
export function validSynonyms(value) {return Array.isArray(value)&&value.length<=100&&value.every((g)=>g&&typeof g==="object"&&!Array.isArray(g)&&Array.isArray(g.terms)&&g.terms.length>=2&&g.terms.length<=12&&g.terms.every((v)=>typeof v==="string"&&v.trim().length>=2&&v.length<=80&&!/[\x00-\x1f\x7f]/.test(v))&&(g.active===undefined||typeof g.active==="boolean"));}
export function normalizedSynonyms(value) {return validSynonyms(value)?value.filter((g)=>g.active!==false).map((g)=>({terms:[...new Set(g.terms.map(normalizeSearchText))]})):[];}
export function spellingDistance(a,b) {
 if(Math.abs(a.length-b.length)>2)return 3;let previous=Array.from({length:b.length+1},(_,i)=>i),before=previous;
 for(let i=1;i<=a.length;i++){const row=[i];for(let j=1;j<=b.length;j++){row[j]=Math.min(row[j-1]+1,previous[j]+1,previous[j-1]+(a[i-1]===b[j-1]?0:1));if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])row[j]=Math.min(row[j],before[j-2]+1);}before=previous;previous=row;}return previous[b.length];
}
export function searchCatalogue(products,query,synonyms=[],exactOnly=false) {
 const term=normalizeSearchText(query),exact=products.filter((p)=>matchesSearch(p,query));if(!term||exactOnly)return {products:exact,exactCount:exact.length,correction:"",synonym:false};
 const alternatives=new Set();for(const group of normalizedSynonyms(synonyms))for(const alias of group.terms)if(` ${term} `.includes(` ${alias} `))for(const other of group.terms)if(other!==alias)alternatives.add(` ${term} `.replace(` ${alias} `,` ${other} `).trim());
 const bySynonym=products.filter((p)=>[...alternatives].some((alias)=>matchesSearch(p,alias))),merged=[...new Map([...exact,...bySynonym].map((p)=>[p.id,p])).values()];
 if(merged.length)return {products:merged,exactCount:exact.length,correction:"",synonym:bySynonym.some((p)=>!exact.includes(p))};
 if(term.length>100)return {products:[],exactCount:0,correction:"",synonym:false};
 const vocab=[...new Set(products.flatMap((p)=>normalizeSearchText([p.name,p.category,p.subcategory,...productSearchKeywords(p)].join(" ")).split(" ")).filter((w)=>/^[\p{L}]{4,28}$/u.test(w)))];
 const corrected=term.split(" ").map((word)=>{if(!/^[\p{L}]{4,28}$/u.test(word)||vocab.includes(word))return word;const threshold=word.length>=7?2:1;const candidates=vocab.map((v)=>({word:v,d:spellingDistance(word,v)})).filter((v)=>v.d<=threshold).sort((a,b)=>a.d-b.d||a.word.localeCompare(b.word));return candidates[0]?.word||word;}).join(" ");
 const results=corrected!==term?products.filter((p)=>matchesSearch(p,corrected)):[];return {products:results,exactCount:0,correction:results.length?corrected:"",synonym:false};
}
