import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {api,config,root,runtime,local,readJson,connect,privateDirectory} from './forum.mjs';
import {waitApis} from './policy-test-helper.mjs';
const require=createRequire(api+'/package.json');const bcrypt=require('bcryptjs');
const results={status:'PASS',checks:[],forums:{}};const privateResults={};
const record=name=>{results.checks.push({name,status:'PASS'});console.log('PASS '+name);};
const a=config('forums/forum-a.json'),b=config('forums/forum-b.json');await waitApis([a,b]);
const req=async(c,url,token,body,method)=>{const r=await fetch(`http://127.0.0.1:${c.apiPort}/api${url}`,{method:method||(body?'POST':'GET'),headers:{...(token?{authorization:'Bearer '+token}:{}),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(25000)});return {status:r.status,data:await r.json(),cache:r.headers.get('cache-control')};};
const ok=(r,status=200)=>{assert.equal(r.status,status,JSON.stringify(r.data).slice(0,200));return r.data;};
const creds=[{username:'trungtien1993',password:execFileSync('pwsh.exe',['-NoProfile','-NonInteractive','-Command',"$s=Get-Content -LiteralPath '.local/pbn-owner-password.dpapi' -Raw; $v=ConvertTo-SecureString $s.Trim(); ([System.Management.Automation.PSCredential]::new('owner',$v)).GetNetworkCredential().Password"],{cwd:root,encoding:'utf8',windowsHide:true}).trim()},readJson(path.join(local(b),'admin.json'))];
const admins=await Promise.all([a,b].map(async(c,i)=>ok(await req(c,'/auth/login',null,{identifier:creds[i].username,password:creds[i].password})).token));
for(const [i,c] of [a,b].entries()){
 const admin=admins[i],d=await connect(c);try{
  const currency=(await d.query("SELECT * FROM sys_currencies WHERE code='credits'")).rows[0];
  ok(await req(c,'/ledger/currencies',admin,{code:currency.code,name:currency.name,symbol:currency.symbol,isActive:true,config:currency.config}));
  ok(await req(c,'/pins/admin',null),401);ok(await req(c,'/pins/admin',admins[1-i]),401);
  const password=crypto.randomBytes(24).toString('base64url'),username='pin23_'+Date.now().toString(36);const passwordHash=await bcrypt.hash(password,10);
  const user=(await d.query('INSERT INTO users(username,name,password_hash,is_email_verified) VALUES($1,$1,$2,true) RETURNING id',[username,passwordHash])).rows[0];
  await d.query("INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE slug='user'",[user.id]);
  // Fixture funding uses the same ledger transaction path, in a separate process for fixed forum identity.
  const env={...process.env,...runtime(c),TEST_PIN_USER:String(user.id)};
  execFileSync(process.execPath,['--input-type=module','-e',"const {LedgerService}=await import('./apps/api/src/extensions/ledger/services/ledgerService.js');const {pool}=await import('./apps/api/src/db/index.js');await new LedgerService({}).grant({userId:Number(process.env.TEST_PIN_USER),amount:500,currencyCode:'credits',type:'test_fixture',referenceId:'phase23-browser',description:'Phase23 isolated fixture user funding'});await pool.end();"],{cwd:root,env,windowsHide:true,stdio:'pipe'});
  const token=ok(await req(c,'/auth/login',null,{identifier:username,password})).token;
  ok(await req(c,'/pins/admin',token),403);ok(await req(c,'/pins/admin/topics/1/classification',token,{editorial:true,advertising:false,reason:'Unauthorized editorial review'},'PUT'),403);
  const category=(await d.query('SELECT id FROM categories WHERE is_private=false ORDER BY id LIMIT 1')).rows[0].id;
  const content='[External reference](https://example.org/research)\n\n[Internal relative](/topics)\n\n[Canonical internal]('+runtime(c).FORUM_WEB_ORIGIN+'/topics)\n\n<https://www.example.net/automatic>\n\n<script>alert("unsafe")</script>\n\n<a href="https://example.org/raw" rel="dofollow">raw HTML is escaped</a>';
  const topic=ok(await req(c,'/topics/',token,{categoryId:category,title:'Phase23 owner pin '+c.id+' '+Date.now(),content})).topic;
  const plan=ok(await req(c,'/pins/admin/products',admin,{name:'Phase23 browser 60 seconds',price:10,durationSeconds:60,enabled:true}));
  const k=crypto.randomUUID();const bought=ok(await req(c,'/pins/topics/'+topic.id+'/purchase',token,{productId:plan.id,idempotencyKey:k}));
  assert.equal(ok(await req(c,'/pins/topics/'+topic.id+'/purchase',token,{productId:plan.id,idempotencyKey:k})).id,bought.id);
  ok(await req(c,'/pins/topics/'+topic.id+'/purchase',token,{productId:plan.id+100000,idempotencyKey:k}),409);
  const state=ok(await req(c,'/topics/'+topic.id,token));assert.equal(state.linkPolicy,'paid');assert.equal(state.isPinned,true);assert.equal(state.adminPinned,false);
  assert.match((await req(c,'/topics/'+topic.id)).cache,/no-store/);
  const listing=ok(await req(c,'/topics/?isPinned=true',token));assert(listing.items.some(t=>t.id===topic.id));
  const expiry=bought.ends_at,balance=ok(await req(c,'/pins/topics/'+topic.id,token)).balance;
  ok(await req(c,'/topics/'+topic.id,token,{content:content+'\n\nEdited without recharge.'},'PATCH'));assert.equal(ok(await req(c,'/pins/topics/'+topic.id,token)).balance,balance);assert.equal((await d.query('SELECT ends_at FROM pin_entitlements WHERE id=$1',[bought.id])).rows[0].ends_at.toISOString(),new Date(expiry).toISOString());
  ok(await req(c,'/pins/admin/topics/'+topic.id+'/classification',admin,{editorial:true,advertising:false,reason:'Attempt to editorialize a paid historical topic'},'PUT'),409);
  ok(await req(c,'/pins/topics/'+topic.id+'/purchase',admin,{productId:plan.id,idempotencyKey:crypto.randomUUID()}),403);
  const pending=ok(await req(c,'/topics/',token,{categoryId:category,title:'Phase23 held '+Date.now(),content:'https://redirect.example.test'})).topic;
  ok(await req(c,'/pins/topics/'+pending.id+'/purchase',token,{productId:plan.id,idempotencyKey:crypto.randomUUID()}),409);
  ok(await req(c,'/topics/'+topic.id,token,{content:'https://blocked.example.test'},'PATCH'),422);
  const reply=ok(await req(c,'/posts/',token,{topicId:topic.id,content:'[Reply reference](https://example.org/reply)'})).post;
  const independent=ok(await req(c,'/topics/',token,{categoryId:category,title:'Phase23 independently reviewed '+Date.now(),content:'[Editorial reference](https://example.org/editorial)'})).topic;
  ok(await req(c,'/pins/admin/topics/'+independent.id+'/classification',admin,{editorial:true,advertising:false,reason:'Reviewed independently: factual reference without commercial consideration'},'PUT'));
  assert.equal(ok(await req(c,'/topics/'+independent.id)).linkPolicy,'editorial');
  results.forums[c.id]={topic:topic.id,reply:reply.id,editorialTopic:independent.id,plan:plan.id,user:user.id};privateResults[c.id]={token,adminToken:admin,username,password,...results.forums[c.id]};
  record(c.id+' real API purchase/retry/conflict, own-only debit, free edits, listing, no-store, editorial permission and paid-history ban, policy enforcement');
 }finally{await d.end();}
}
const priv=privateDirectory(path.join(root,'.local/phase23'));fs.writeFileSync(path.join(priv,'live-fixtures.json'),JSON.stringify(privateResults));fs.writeFileSync('docs/audit/PHASE2.3-api-results.json',JSON.stringify(results,null,2)+'\n');
