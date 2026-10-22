import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {waitApis} from './policy-test-helper.mjs';
import {api,config,runtime,connect,readJson} from './forum.mjs';
const require=createRequire(api+'/package.json'),Redis=require('ioredis');const a=config('forums/forum-a.json'),b=config('forums/forum-b.json'),f=readJson('.local/phase23/live-fixtures.json');const checks=[];await waitApis([a,b]);
const req=async(c,route,token,body,extra={})=>fetch(`http://127.0.0.1:${c.apiPort}/api${route}`,{method:body?'POST':'GET',headers:{...(token?{authorization:'Bearer '+token}:{}),...(body?{'content-type':'application/json'}:{}),...extra},body:body?JSON.stringify(body):undefined});
for(const [source,target] of [[a,b],[b,a]]){
 const token=f[source.id].token,topic=f[target.id].topic;
 for(const route of ['/auth/me','/pins/me','/pins/admin','/ledger/accounts'])assert.equal((await req(target,route,token)).status,401);
 assert.equal((await req(target,'/pins/topics/'+topic+'/purchase',token,{productId:f[target.id].plan,idempotencyKey:crypto.randomUUID()})).status,401);
 assert.equal((await req(target,'/pins/me',null,null,{cookie:`pbn_${source.id}_auth=${token}`})).status,401);
 assert.equal((await req(target,'/pins/me',null,null,{cookie:`pbn_${target.id}_auth=${token}`})).status,401);
 assert.equal((await req(target,'/pins/products',null,null,{origin:`http://127.0.0.1:${source.webPort}`})).status,403);
 const d=await connect(target);try{assert.equal((await d.query('SELECT count(*)::int AS n FROM users WHERE username=$1',[f[source.id].username])).rows[0].n,0);}finally{await d.end();}
}
checks.push('Both directions: foreign bearer, own-name/renamed foreign cookies, owner purchase, wallet/admin routes and foreign Origin rejected; fixture users isolated');
const raw=new Redis(runtime(a).REDIS_URL);try{
 const k='phase23-isolation-'+Date.now();await raw.set(runtime(a).REDIS_KEY_PREFIX+k,'A','EX',60);await raw.set(runtime(b).REDIS_KEY_PREFIX+k,'B','EX',60);assert.equal(await raw.get(runtime(a).REDIS_KEY_PREFIX+k),'A');assert.equal(await raw.get(runtime(b).REDIS_KEY_PREFIX+k),'B');await raw.del(runtime(a).REDIS_KEY_PREFIX+k,runtime(b).REDIS_KEY_PREFIX+k);
}finally{await raw.quit();}
checks.push('Redis namespaces remain independent and fixture keys cleaned');
for(const c of [a,b]){const r=await fetch(`http://127.0.0.1:${c.webPort}`);assert.equal(r.status,200);const html=await r.text();assert(html.includes(`lang="${c.locale}"`));assert(html.includes(`--primary:${c.primaryColor}`));}
checks.push('A/B homepage default locale and configured theme remain operational');fs.writeFileSync('docs/audit/PHASE2.3-isolation-results.json',JSON.stringify({status:'PASS',checks},null,2)+'\n');console.log('PASS A/B auth, purchase, wallet, cookie, Origin, users, Redis and homepage isolation');
