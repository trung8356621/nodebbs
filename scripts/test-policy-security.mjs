import {waitApis} from './policy-test-helper.mjs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {config,root,local,readJson,connect} from './forum.mjs';
const results={checks:[],created:new Date().toISOString()};
const record=name=>{results.checks.push({name,status:'PASS'});console.log('PASS '+name);};
const a=config('forums/forum-a.json'),b=config('forums/forum-b.json');
await waitApis([a,b]);
async function req(c,url,token,body,method) {const r=await fetch(`http://127.0.0.1:${c.apiPort}/api${url}`,{method:method || (body?'POST':'GET'),headers:{...(token?{authorization:'Bearer '+token}:{}),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});return {status:r.status,data:await r.json()};}
function expect(r,status,name){assert.equal(r.status,status,name+': '+JSON.stringify(r.data).slice(0,180));return r.data;}
const ca={username:'trungtien1993',password:execFileSync('pwsh.exe',['-NoProfile','-NonInteractive','-Command',"$s=Get-Content -LiteralPath '.local/pbn-owner-password.dpapi' -Raw; $v=ConvertTo-SecureString $s.Trim(); ([System.Management.Automation.PSCredential]::new('owner',$v)).GetNetworkCredential().Password"],{cwd:root,encoding:'utf8',windowsHide:true}).trim()};
const cb=readJson(path.join(local(b),'admin.json'));
const ta=expect(await req(a,'/auth/login',null,{identifier:ca.username,password:ca.password}),200,'A login').token;
const tb=expect(await req(b,'/auth/login',null,{identifier:cb.username,password:cb.password}),200,'B login').token;
const tokens=[ta,tb], configs=[a,b];
const dbs=await Promise.all(configs.map(c=>connect(c)));
const suffix=Date.now().toString(36);
try {
  const localRules=[];
  for(let i=0;i<2;i++) {
    const c=configs[i], token=tokens[i], other=configs[1-i], otherToken=tokens[1-i],db=dbs[i];
    const rule={category:'custom_domain',type:'domain_subdomains',value:`local-${c.id}-${suffix}.example.test`,action:'BLOCK',enabled:true,reason:'Phase22 local isolation fixture'};
    const saved=expect(await req(c,'/policy/rules',token,rule),200,'local rule create').rule;
    localRules.push(saved);
    expect(await req(c,'/policy/rules',token,rule),409,'duplicate rule rejected');
    assert(!(await req(other,'/policy/',otherToken)).data.rules.some(r=>r.value===rule.value));
    const category=(await db.query('SELECT id FROM categories ORDER BY id LIMIT 1')).rows[0].id;
    expect(await req(c,'/topics/',token,{categoryId:category,title:'Phase22 local blocked',content:'https://'+rule.value}),422,'own local rule blocks');
    const otherCategory=(await dbs[1-i].query('SELECT id FROM categories ORDER BY id LIMIT 1')).rows[0].id;
    expect(await req(other,'/topics/',otherToken,{categoryId:otherCategory,title:'Phase22 other local unaffected '+suffix,content:'https://'+rule.value}),200,'other forum unaffected');
    expect(await req(other,'/policy/rules/'+encodeURIComponent(saved.id),token,{...saved,enabled:false},'PUT'),401,'foreign modification denied');
    expect(await req(c,'/policy/rules/'+encodeURIComponent(saved.id),token,{...saved,enabled:false},'PUT'),200,'disable local rule');
    expect(await req(c,'/topics/',token,{categoryId:category,title:'Phase22 disabled rule '+suffix,content:'https://'+rule.value}),200,'disabled allows');
    const allow=expect(await req(c,'/policy/rules',token,{category:'phishing',type:'domain_exact',value:'blocked.example.test',action:'ALLOW',reason:'Phase22 precedence fixture'}),200,'local allow fixture').rule;
    expect(await req(c,'/topics/',token,{categoryId:category,title:'Phase22 global precedence',content:'https://blocked.example.test'}),422,'local allow cannot weaken global block');
    expect(await req(c,'/policy/rules/'+encodeURIComponent(allow.id),token,null,'DELETE'),200,'delete allow fixture');
    record(c.id+' local create/duplicate/update/disable, global precedence and bidirectional isolation');
  }
  // An ordinary account must not obtain policy administration, even with a colliding user ID.
  const member={username:'p22_'+suffix,password:crypto.randomBytes(24).toString('base64url')};
  expect(await req(b,'/users/',tb,{...member,email:member.username+'@example.test'}),200,'create separate member fixture');
  const mt=expect(await req(b,'/auth/login',null,{identifier:member.username,password:member.password}),200,'member login').token;
  for(const [url,body,method] of [['/policy/',null],['/policy/rules',{category:'spam',type:'domain_exact',value:'denied.example.test',action:'BLOCK',reason:'fixture'}],['/policy/sync',{}],['/policy/scans',{dryRun:true}]]) expect(await req(b,url,mt,body,method),403,'member admin denied');
  const bc=(await dbs[1].query('SELECT id FROM categories ORDER BY id LIMIT 1')).rows[0].id;
  expect(await req(b,'/topics/',mt,{categoryId:bc,title:'Phase22 member blocked',content:'https://blocked.example.test'}),422,'member publishing block');
  record('Ordinary member cannot administer rules/sync/scans and cannot bypass global block');
  // Prepare content that is legal under v1 and newly denied under a signed v2 policy.
  const affected=[];
  for(let i=0;i<2;i++) {
    const category=(await dbs[i].query('SELECT id FROM categories ORDER BY id LIMIT 1')).rows[0].id;
    const topic=expect(await req(configs[i],'/topics/',tokens[i],{categoryId:category,title:'Phase22 retrospective '+suffix,content:'https://retro-'+suffix+'.example.test'}),200,'retro topic').topic;
    affected.push(topic.id);
  }
  const file=path.join(root,'.local/phase22/global-policy.json'), old=readJson(file), key=fs.readFileSync(path.join(root,'.local/phase22/policy-private.pem'));
  const payload=JSON.parse(Buffer.from(old.payload,'base64'));payload.version++;
  payload.rules.push({id:'g:retro-'+suffix,category:'malware',type:'domain_exact',value:'retro-'+suffix+'.example.test',action:'BLOCK',reason:'FIXTURE_NEW_GLOBAL_BLOCK',enabled:true});
  const bytes=Buffer.from(JSON.stringify(payload)), envelope={payload:bytes.toString('base64'),checksum:crypto.createHash('sha256').update(bytes).digest('hex'),signature:crypto.sign(null,bytes,key).toString('base64')};
  fs.writeFileSync(file,JSON.stringify(envelope));
  for(let i=0;i<2;i++) {
    const synced=await Promise.all([req(configs[i],'/policy/sync',tokens[i],{}),req(configs[i],'/policy/sync',tokens[i],{})]);
    for(const s of synced) expect(s,200,'concurrent sync');
  }
  record('Authenticated signed increasing-version global sync and concurrent identical snapshots');
  // Authentication failure and replay must preserve last verified mandatory restrictions.
  fs.writeFileSync(file,JSON.stringify({...envelope,signature:Buffer.alloc(64).toString('base64')}));
  for(let i=0;i<2;i++) assert.notEqual((await req(configs[i],'/policy/sync',tokens[i],{})).status,200);
  fs.writeFileSync(file,JSON.stringify(old));
  for(let i=0;i<2;i++) assert.notEqual((await req(configs[i],'/policy/sync',tokens[i],{})).status,200);
  fs.writeFileSync(file,JSON.stringify(envelope));
  for(let i=0;i<2;i++) {
    const state=expect(await req(configs[i],'/policy/',tokens[i]),200,'policy state');
    assert.equal(state.versions.find(v=>v.scope==='global').version,payload.version);
    assert(state.syncs.some(s=>!s.success));
    const category=(await dbs[i].query('SELECT id FROM categories ORDER BY id LIMIT 1')).rows[0].id;
    expect(await req(configs[i],'/topics/',tokens[i],{categoryId:category,title:'Phase22 offline block',content:'https://retro-'+suffix+'.example.test'}),422,'last valid snapshot enforced');
  }
  record('Invalid signature/replay rejected, failures audited, last verified policy still enforced');
  const end=Date.now()+180000;
  for(let i=0;i<2;i++) {
    while(Date.now()<end) {
      const row=(await dbs[i].query('SELECT approval_status FROM topics WHERE id=$1',[affected[i]])).rows[0];
      if(row.approval_status==='pending')break;
      await new Promise(r=>setTimeout(r,1000));
    }
    assert.equal((await dbs[i].query('SELECT approval_status FROM topics WHERE id=$1',[affected[i]])).rows[0].approval_status,'pending');
    const item=(await dbs[i].query("SELECT id FROM moderation_items WHERE target_type='topic' AND target_id=$1 AND status='pending'",[affected[i]])).rows[0];
    assert(item);
    assert.notEqual((await req(configs[i],'/moderation/queue/'+item.id+'/approve',tokens[i],{})).status,200);
    expect(await req(configs[i],'/moderation/approve/topic/'+affected[i],tokens[i],{}),422,'legacy approval blocked');
    assert.equal((await dbs[i].query('SELECT approval_status FROM topics WHERE id=$1',[affected[i]])).rows[0].approval_status,'pending');
  }
  record('New global deny triggers bounded retrospective hiding; both moderation approval paths reject bypass');
  for(let i=0;i<2;i++) expect(await req(configs[i],'/policy/rules/'+encodeURIComponent(localRules[i].id),tokens[i],null,'DELETE'),200,'delete local test rule');
  record('Local rule deletion audited');
  fs.writeFileSync('docs/audit/PHASE2.2-security-results.json',JSON.stringify(results,null,2)+'\n');
} finally {for(const db of dbs)await db.end();}
