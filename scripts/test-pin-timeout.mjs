import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import fs from 'node:fs';
import {config,readJson,connect} from './forum.mjs';
const fixtures=readJson('.local/phase23/live-fixtures.json'),checks=[];
for(const n of ['a','b']){
 const c=config('forums/forum-'+n+'.json'),f=fixtures[c.id],base='http://127.0.0.1:'+c.apiPort+'/api',d=await connect(c);const key=crypto.randomUUID();let resolveCommitted,rejectCommitted;const committed=new Promise((resolve,reject)=>{resolveCommitted=resolve;rejectCommitted=reject;});
 const proxy=http.createServer(async(request,response)=>{try{for await(const ignored of request)void ignored;const r=await fetch(base+'/pins/topics/'+f.topic+'/purchase',{method:'POST',headers:{authorization:'Bearer '+f.token,'content-type':'application/json'},body:JSON.stringify({productId:f.plan,idempotencyKey:key})});const data=await r.json();assert.equal(r.status,200);resolveCommitted(data);/* Intentionally withhold the committed response from the caller. */}catch(e){rejectCommitted(e);response.destroy();}});
 try{
  await new Promise(resolve=>proxy.listen(0,'127.0.0.1',resolve));const address=proxy.address();await assert.rejects(fetch('http://127.0.0.1:'+address.port,{method:'POST',body:'purchase',signal:AbortSignal.timeout(500)}));const first=await committed;
  const r=await fetch(base+'/pins/topics/'+f.topic+'/purchase',{method:'POST',headers:{authorization:'Bearer '+f.token,'content-type':'application/json'},body:JSON.stringify({productId:f.plan,idempotencyKey:key})});assert.equal(r.status,200);assert.equal((await r.json()).id,first.id);
  assert.equal((await d.query('SELECT count(*)::int AS n FROM pin_entitlements WHERE user_id=$1 AND idempotency_key=$2',[f.user,key])).rows[0].n,1);assert.equal((await d.query("SELECT count(*)::int AS n FROM sys_transactions WHERE type='pin_purchase' AND reference_id=$1",[first.id])).rows[0].n,1);
  checks.push(c.id+': real HTTP caller timeout after upstream processing; retry returned one committed entitlement and exactly one debit');console.log('PASS '+checks.at(-1));
 }finally{proxy.closeAllConnections();await new Promise(resolve=>proxy.close(resolve));await d.end();}
}
fs.writeFileSync('docs/audit/PHASE2.3-timeout-results.json',JSON.stringify({status:'PASS',checks},null,2)+'\n');
