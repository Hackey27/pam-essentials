import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
import {memoryFirestore} from './fixtures/memoryFirestore.mjs';
register(new URL('./fixtures/seed-loader.mjs',import.meta.url));
const {POST}=await import('../app/api/admin/seed/route.js');
function setup(){globalThis.__pamTestUsers=new Map([['owner',{uid:'owner',role:'owner'}],['cashier',{uid:'cashier',role:'cashier'}]]);return globalThis.__pamTestStore=memoryFirestore({users:{owner:{role:'owner'},cashier:{role:'cashier'}},products:{P:{id:'P',sku:'P',name:'Owner CSV name',stock:9,price:12,cardPreviewImagePath:'products/kept.jpg'}},admin_audit:{}});}
const request=role=>new Request('https://pam.local/api/admin/seed',{method:'POST',headers:role?{authorization:'Bearer '+role}:{}});
test('bundled catalogue cannot overwrite a populated catalogue or resurrect removed records',async()=>{const store=setup();const before=await store.collection('products').get();const response=await POST(request('owner'));assert.equal(response.status,409);assert.match((await response.json()).error,/Import \/ update file/);const after=await store.collection('products').get();assert.deepEqual(after.docs.map(d=>d.data()),before.docs.map(d=>d.data()));assert.equal((await store.collection('admin_audit').get()).size,0);});
test('bundled setup retains authentication and role restrictions',async()=>{setup();assert.equal((await POST(request())).status,401);assert.equal((await POST(request('cashier'))).status,403);});
