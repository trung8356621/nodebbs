import {waitApis} from './policy-test-helper.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {config,root,local,readJson,connect} from './forum.mjs';
const results={checks:[],created:new Date().toISOString()};
const record=name=>{results.checks.push({name,status:'PASS'});console.log('PASS '+name);};
const a=config('forums/forum-a.json'),b=config('forums/forum-b.json');
await waitApis([a,b]);
async function req(c,url,token,body,method) {const r=await fetch(`http://127.0.0.1:${c.apiPort}/api${url}`,{method:method || (body?'POST':'GET'),headers:{...(token?{authorization:'Bearer '+token}:{}),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});const data=await r.json();return {status:r.status,data};}
function expect(r,status,name){assert.equal(r.status,status,name+': '+JSON.stringify(r.data).slice(0,200));return r.data;}
const ca={username:'trungtien1993',password:execFileSync('pwsh.exe',['-NoProfile','-NonInteractive','-Command',"$s=Get-Content -LiteralPath '.local/pbn-owner-password.dpapi' -Raw; $v=ConvertTo-SecureString $s.Trim(); ([System.Management.Automation.PSCredential]::new('owner',$v)).GetNetworkCredential().Password"],{cwd:root,encoding:'utf8',windowsHide:true}).trim()};
const cb=readJson(path.join(local(b),'admin.json'));
const ta=expect(await req(a,'/auth/login',null,{identifier:ca.username,password:ca.password}),200,'A login').token;
const tb=expect(await req(b,'/auth/login',null,{identifier:cb.username,password:cb.password}),200,'B login').token;
record('Real A/B administrator login');
for(const [c,token,foreign] of [[a,ta,tb],[b,tb,ta]]) {
  expect(await req(c,'/policy/',null),401,'anonymous policy read');
  expect(await req(c,'/policy/',foreign),401,'foreign policy read');
  expect(await req(c,'/policy/rules',foreign,{category:'spam',type:'domain_exact',value:'cross.example.test',action:'BLOCK',reason:'fixture'}),401,'foreign policy write');
  const state=expect(await req(c,'/policy/',token),200,'policy admin read');
  assert(state.versions.find(v=>v.scope==='global').version >= 1);
  const db=await connect(c);
  try {
    const category=(await db.query('SELECT id FROM categories ORDER BY id LIMIT 1')).rows[0].id;
    const counts=async()=> (await db.query('SELECT (SELECT count(*) FROM topics)::int AS topics,(SELECT count(*) FROM posts)::int AS posts,(SELECT count(*) FROM sys_transactions)::int AS transactions')).rows[0];
    const before=await counts();
    for(const content of ['https://blocked.example.test','<a href="https://blocked&#46;example.test">rich link</a>']) expect(await req(c,'/topics/',token,{categoryId:category,title:'Phase22 blocked fixture',content}),422,'Admin mandatory block');
    assert.deepEqual(await counts(),before);
    record(c.id+' global block, HTML bypass denied, no partial content/credit writes');
    const topic=expect(await req(c,'/topics/',token,{categoryId:category,title:'Phase22 allowed '+Date.now(),content:'Ordinary educational discussion.'}),200,'create allowed topic').topic;
    assert.equal(topic.approvalStatus,'approved');
    expect(await req(c,'/topics/'+topic.id,token,{content:'Ordinary edited body.'},'PATCH'),200,'allowed content-only topic edit');
    expect(await req(c,'/topics/'+topic.id,token,{title:'Phase22 edited '+c.id+' '+Date.now()},'PATCH'),200,'allowed title-only topic edit');
    expect(await req(c,'/topics/'+topic.id,token,{content:'https://blocked.example.test'},'PATCH'),422,'edit blocked topic');
    const post=expect(await req(c,'/posts/',token,{topicId:topic.id,content:'Ordinary reply.'}),200,'create allowed reply').post;
    expect(await req(c,'/posts/'+post.id,token,{content:'Ordinary edited reply.'},'PATCH'),200,'allowed reply edit');
    expect(await req(c,'/posts/'+post.id,token,{content:'https://blocked.example.test'},'PATCH'),422,'edit blocked reply');
    expect(await req(c,'/posts/',token,{topicId:topic.id,content:'https://blocked.example.test'}),422,'create blocked reply');
    expect(await req(c,'/users/me',token,{bio:'https://blocked.example.test'},'PATCH'),422,'profile bio blocked');
    record(c.id+' topic/reply create/edit and profile enforcement');
    const held=expect(await req(c,'/topics/',token,{categoryId:category,title:'Phase22 review '+Date.now(),content:'https://redirect.example.test'}),200,'review topic').topic;
    assert.equal(held.approvalStatus,'pending');
    assert.equal((await db.query('SELECT approval_status FROM posts WHERE topic_id=$1 AND post_number=1',[held.id])).rows[0].approval_status,'pending');
    record(c.id+' unverified redirect held from first insertion');
    const globalId='g:blocked-fixture';
    expect(await req(c,'/policy/rules/'+encodeURIComponent(globalId),token,{...state.rules.find(r=>r.id===globalId),enabled:false},'PUT'),404,'global modification denied');
    expect(await req(c,'/policy/rules/'+encodeURIComponent(globalId),token,null,'DELETE'),404,'global deletion denied');
    record(c.id+' global policy immutable through local admin API');
    results[c.id]={topic:topic.id,post:post.id,reviewTopic:held.id};
  } finally {await db.end();}
}
fs.writeFileSync('docs/audit/PHASE2.2-api-results.json',JSON.stringify(results,null,2)+'\n');
