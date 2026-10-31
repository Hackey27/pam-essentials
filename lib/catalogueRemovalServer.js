import {createHash} from 'node:crypto';
import {FieldValue} from 'firebase-admin/firestore';
import {NextResponse} from 'next/server';
import {parseCatalogueCsv} from './catalogueImport.mjs';
import {heldQuantity,holdTime} from './reservations.mjs';
import {auditPayload} from './serverData.js';
const linkedCollections=['sales','orders','stock_movements','stock_use_records','packing_recipes','packing_records','marketplace_listings','marketplace_orders','accounting_documents','accounting_journals','accounting_assets','accounting_payments','product_reviews','pricing_inquiries','product_requests','restock_alerts','barcode_registry'];
const stamp=v=>v?.toJSON?.()??v;
const digest=v=>createHash('sha256').update(JSON.stringify(v,(_,x)=>stamp(x))).digest('hex');
function refers(v,ids){if(typeof v==='string')return ids.has(v);if(!v||typeof v!=='object')return false;return Object.values(v).some(x=>refers(x,ids));}
export async function removeReintroducedCatalogue(body,store,user){
 const skus=body.removeSkus;if(typeof body.csv!=='string'||Buffer.byteLength(body.csv)>2*1024*1024||!Array.isArray(skus)||!skus.length||skus.length>20||skus.some(s=>typeof s!=='string'||!s.trim())||new Set(skus).size!==skus.length)throw new Error('Choose the current source CSV and up to 20 distinct unlisted SKUs.');
 const rows=parseCatalogueCsv(body.csv),source=new Set(rows.map(r=>r.sku));if(source.size!==rows.length||source.has('')||skus.some(s=>source.has(s)))throw new Error('Only SKUs absent from the source CSV can be removed.');
 const jobId=digest({csv:body.csv,skus:[...skus].sort(),kind:'remove-reintroduced-v1'}),job=store.collection('catalogue_cleanup_jobs').doc(jobId);
 async function review(reader){
  const products=await reader.get(store.collection('products')),settings=await reader.get(store.collection('accounting_settings').doc('config'));
  if(settings.data()?.active)throw new Error('Accounting is active. Review an accounting inventory correction instead of deleting stock.');
  const selected=products.docs.filter(d=>skus.includes(d.data().sku||d.id));if(selected.length!==skus.length)throw new Error('One or more SKUs are missing or duplicated. Refresh before removal.');
  const ids=new Set(selected.flatMap(d=>[d.id,decodeURIComponent(d.id),d.data().id,d.data().sku].filter(Boolean)));
  if(selected.some(d=>heldQuantity(d.data())>0))throw new Error('Release active reservations before removing a product.');
  const relations=await Promise.all(linkedCollections.map(c=>reader.get(store.collection(c))));const proofs=new Set();
  for(let i=0;i<relations.length;i++){if(relations[i].size>50000)throw new Error('Reference data exceeds the safe review limit.');for(const d of relations[i].docs){const value=d.data();if(!refers(value,ids))continue;
   const priorRemoval=linkedCollections[i]==='stock_movements'&&value.type==='catalogue-migration'&&Number(value.newStock)===0&&value.sourceCatalogueImportId&&selected.some(p=>[p.id,p.data().id,p.data().sku].includes(value.productId)&&holdTime(p.data().createdAt)>holdTime(value.createdAt));
   if(priorRemoval){proofs.add(value.productId);continue;}
   throw new Error('Removal blocked by '+linkedCollections[i]+'/'+d.id+'. No products changed.');
  }}
  if(selected.some(d=>![d.id,d.data().id,d.data().sku].some(id=>proofs.has(id))))throw new Error('This tool only removes products recreated after a recorded source-catalogue removal.');
  const entries=selected.map(d=>({docId:d.id,data:d.data(),updateTime:d.updateTime}));
  return {entries,previewHash:digest({jobId,versions:entries.map(e=>[e.docId,e.updateTime]),settingsVersion:settings.updateTime,relations:relations.map(s=>s.docs.map(d=>[d.id,d.updateTime]))})};
 }
 const previous=await job.get();if(previous.exists)return NextResponse.json({alreadyApplied:true,result:previous.data().result});
 if(body.mode==='preview-removal'){const plan=await review({get:q=>q.get()});return NextResponse.json({removalOnly:true,previewHash:plan.previewHash,summary:{products:0,created:0,updated:0,retired:0,removed:plan.entries.length,looseComponents:0,beforeValue:plan.entries.reduce((s,e)=>s+Number(e.data.stock||0)*Number(e.data.costPrice||0),0),afterValue:0,valueAdjustment:-plan.entries.reduce((s,e)=>s+Number(e.data.stock||0)*Number(e.data.costPrice||0),0)},warnings:['Only the selected recreated products are removed. Listed CSV products, prices, stock, images and historical records are unchanged. Accounting must remain inactive.'],nodeChanges:[],entries:plan.entries.map(e=>({id:e.docId,sku:e.data.sku||e.docId,name:e.data.name,kind:'delete',changes:[{field:'product record',before:{name:e.data.name,stock:e.data.stock},after:null}]}))});}
 if(body.mode!=='apply-removal'||body.confirmReplacement!==true||!String(body.reason||'').trim()||!body.previewHash)throw new Error('Review the removal preview, confirm it and enter a reason.');
 const result=await store.runTransaction(async tx=>{const prior=await tx.get(job);if(prior.exists)return prior.data().result;const plan=await review(tx);if(plan.previewHash!==body.previewHash)throw new Error('Records changed since preview. Review removal again.');
  const now=FieldValue.serverTimestamp(),result={ok:true,removalOnly:true,products:0,removed:plan.entries.length,importId:jobId,imageReset:[]};
  tx.create(store.collection('catalogue_cleanup_snapshots').doc(jobId),{products:plan.entries.map(e=>({docId:e.docId,before:e.data})),createdAt:now,reason:String(body.reason).slice(0,500)});
  for(const e of plan.entries)tx.delete(store.collection('products').doc(e.docId));
  tx.create(job,{createdAt:now,admin:user.uid,result});tx.create(store.collection('admin_audit').doc(),auditPayload(user,'REMOVE_REINTRODUCED_CATALOGUE','catalogue',jobId,String(body.reason).slice(0,500),plan.entries.map(e=>({sku:e.data.sku,stock:e.data.stock,name:e.data.name})),{removed:plan.entries.length,snapshot:jobId}));return result;
 });return NextResponse.json(result);
}
