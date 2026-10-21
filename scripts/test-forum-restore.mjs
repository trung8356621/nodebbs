import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { root,config,connect,local,readJson,writeJson,runtime } from './forum.mjs';

const b=config('forums/forum-b.json'),r=config('forums/forum-b-restore.json'),a=config('forums/forum-a.json');
assert.equal(b.database,'pbn_forum_b');assert.equal(r.database,'pbn_forum_b_restore');
const results={date:new Date().toISOString(),checks:[]};
const pass=(name,detail={})=>{results.checks.push({name,pass:true,...detail});console.log('PASS '+name);};
const clients=[];
async function request(c,route,token){const response=await fetch(`http://127.0.0.1:${c.apiPort}${route}`,{headers:token?{authorization:`Bearer ${token}`}:{},signal:AbortSignal.timeout(15000)});return{status:response.status,text:await response.text()};}
try{
  for(const c of [a,b,r])clients.push(await connect(c));
  const [dbA,dbB,dbR]=clients;
  const verification=readJson(path.join(local(r),'restore-verification.json'));
  assert(verification.pass);pass('Dump checksum, all row contents/counts, schema constraints/indexes, sequences, schema version and media match exactly',{
    tables:Object.keys(verification.state.rows).length,schemaSha256:verification.state.schemaSha256,versions:verification.state.versions,mediaFiles:verification.media.length,
  });
  for(const [name,query] of Object.entries({
    users:'SELECT id,username,email,password_hash,role FROM users ORDER BY id',
    roles:'SELECT * FROM roles ORDER BY id',
    userRoles:'SELECT * FROM user_roles ORDER BY id',
    topics:'SELECT id,title,slug,category_id,user_id,is_pinned FROM topics ORDER BY id',
    comments:'SELECT id,topic_id,user_id,raw_content,post_number FROM posts ORDER BY id',
    wallets:'SELECT * FROM sys_accounts ORDER BY id',
    walletTransactions:'SELECT * FROM sys_transactions ORDER BY id',
    banners:'SELECT * FROM ads ORDER BY id',
    settings:'SELECT * FROM system_settings ORDER BY id',
    files:'SELECT * FROM files ORDER BY id',
  })){
    const source=(await dbB.query(query)).rows,target=(await dbR.query(query)).rows;assert.deepEqual(target,source);
    assert(source.length>0,'Nonempty fixture '+name);pass('Restored '+name+' intact',{rows:target.length});
  }
  assert((await dbR.query('SELECT 1 FROM topics WHERE is_pinned=true')).rowCount>0);pass('Pinned topic preserved');
  assert((await dbR.query('SELECT 1 FROM posts WHERE post_number>1')).rowCount>0);pass('Comment reply preserved');
  for(const db of [dbB,dbR]){
    assert.equal((await db.query('SELECT 1 FROM pg_foreign_server')).rowCount,0);
    assert.equal((await db.query("SELECT 1 FROM pg_extension WHERE extname IN ('dblink','postgres_fdw')")).rowCount,0);
  }pass('Source and restored forum have no foreign servers/dblink/postgres_fdw');
  const credentials=readJson(path.join(local(b),'admin.json'));
  let login;
  const end=Date.now()+180000;
  while(Date.now()<end){try{const response=await fetch(`http://127.0.0.1:${r.apiPort}/api/auth/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identifier:credentials.username,password:credentials.password}),signal:AbortSignal.timeout(10000)});if(response.status===200){login=await response.json();break;}}catch{}await new Promise(resolve=>setTimeout(resolve,1000));}
  assert(login?.token,'Restored normal login failed');
  for(const route of ['/api/auth/me','/api/dashboard/stats','/api/topics/','/api/ledger/accounts','/api/ads'])assert.equal((await request(r,route,login.token)).status,200,route);
  pass('Restored Admin uses unchanged password and normal RBAC/API routes');
  assert.equal((await request(b,'/api/dashboard/stats',login.token)).status,401);
  assert.equal((await request(a,'/api/dashboard/stats',login.token)).status,401);
  pass('Fresh restore JWT identity cannot authenticate against either source forum');
  const image=verification.media.find(file=>!file.path.startsWith('.tmp/'));
  assert(image);const mediaResponse=await fetch(`http://127.0.0.1:${r.webPort}/uploads/${image.path}`,{signal:AbortSignal.timeout(120000)});assert.equal(mediaResponse.status,200);
  const response=await fetch(`http://127.0.0.1:${r.webPort}/`,{signal:AbortSignal.timeout(120000)});assert.equal(response.status,200);const html=await response.text();assert(html.includes('PBN Forum B'));assert(html.includes('--primary:#9333ea'));assert(html.includes('lang="en-US"'));
  pass('Restored Web homepage/media/name/theme/locale operate without Central API');
  assert.notEqual(runtime(b).UPLOAD_ROOT,runtime(r).UPLOAD_ROOT);pass('Source and restored media roots remain separate');
  const before=readJson(path.join(local(a),'pre-phase21b.json')).counts;
  for(const table of ['users','topics','posts','categories','sys_accounts','sys_transactions','ads','files','user_roles'])assert.equal(Number((await dbA.query(`SELECT count(*) FROM ${table}`)).rows[0].count),before[table],table);
  pass('Forum A business row counts unchanged after export/restore');
  results.pass=true;
}catch(e){results.pass=false;results.failure=e.message;console.error('FAIL '+e.message);process.exitCode=1;}
finally{await Promise.all(clients.map(db=>db.end()));}
writeJson(path.join(root,'docs/audit/PHASE2.1B-restore-results.json'),results);
