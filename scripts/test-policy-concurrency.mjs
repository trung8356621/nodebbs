import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {config,local,readJson,connect} from './forum.mjs';
import {waitApis} from './policy-test-helper.mjs';
import {evaluate} from '../apps/api/src/services/policy/engine.js';
const c=config('forums/forum-b.json');await waitApis([c]);
const base=`http://127.0.0.1:${c.apiPort}/api`;
async function req(route,token,body,method){const r=await fetch(base+route,{method:method||(body?'POST':'GET'),headers:{...(token?{authorization:'Bearer '+token}:{}),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});return {status:r.status,data:await r.json()};}
const credentials=readJson(path.join(local(c),'admin.json'));const login=await req('/auth/login',null,{identifier:credentials.username,password:credentials.password});assert.equal(login.status,200);const token=login.data.token;
const db=await connect(c),results=[];
try {
 const category=(await db.query('SELECT id FROM categories ORDER BY id LIMIT 1')).rows[0].id;
 const original=await req('/topics/',token,{title:'Concurrent safe fixture '+Date.now(),categoryId:category,content:'ordinary initial body'});assert.equal(original.status,200);const id=original.data.topic.id;
 const edits=await Promise.all([req('/topics/'+id,token,{title:'example casino offer'},'PATCH'),req('/topics/'+id,token,{content:'join with referral'},'PATCH')]);assert.deepEqual(edits.map(r=>r.status).sort(),[200,422],JSON.stringify(edits));
 const current=(await db.query('SELECT t.title,p.content FROM topics t JOIN posts p ON p.topic_id=t.id AND p.post_number=1 WHERE t.id=$1',[id])).rows[0];const rules=(await db.query('SELECT * FROM policy_rules')).rows;assert.notEqual(evaluate(current.title+'\n'+current.content,rules).action,'BLOCK');
 results.push({name:'Concurrent disjoint title/body edits serialize, exactly one prohibited combination is rejected',status:'PASS'});
 const titled=await req('/topics/',token,{title:'example casino offer',categoryId:category,content:'ordinary discussion'});assert.equal(titled.status,200);const first=(await db.query('SELECT id FROM posts WHERE topic_id=$1 AND post_number=1',[titled.data.topic.id])).rows[0].id;
 assert.equal((await req('/posts/'+first,token,{content:'join with referral'},'PATCH')).status,422);
 results.push({name:'Editing first-post API includes existing topic title in mandatory policy evaluation',status:'PASS'});
 const member={username:'p22c_'+Date.now().toString(36),password:crypto.randomBytes(24).toString('base64url')};assert.equal((await req('/users/',token,{...member,email:member.username+'@example.test',name:'example casino offer'})).status,200);
 const memberLogin=await req('/auth/login',null,{identifier:member.username,password:member.password});assert.equal(memberLogin.status,200);
 assert.equal((await req('/users/me',memberLogin.data.token,{bio:'join with referral'},'PATCH')).status,422);
 results.push({name:'Profile edits evaluate unchanged public fields and cannot assemble a prohibited promotion across fields',status:'PASS'});
 fs.writeFileSync('docs/audit/PHASE2.2-concurrency-results.json',JSON.stringify(results,null,2)+'\n');for(const r of results)console.log('PASS '+r.name);
}finally{await db.end();}
