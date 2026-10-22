import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {config,connect,runtime,Client,quote,root,privateDirectory,readJson,migrate} from './forum.mjs';
const results=[];
for(const n of ['a','b']){
 const c=config('forums/forum-'+n+'.json'),name='pbn_phase23_before_'+n+'_'+Date.now().toString(36),u=new URL(runtime(c).DATABASE_URL);u.pathname='/postgres';const admin=new Client({connectionString:u.toString()});await admin.connect();await admin.query(`CREATE DATABASE ${quote(name)}`);await admin.end();u.pathname='/'+name;
 const r=spawnSync('D:/laragon/bin/postgresql/postgresql/bin/pg_restore.exe',['--dbname='+name,'--no-owner','--no-privileges',path.join(root,'.local/phase23/before-'+n+'.dump')],{windowsHide:true,encoding:'utf8',env:{...process.env,PGHOST:u.hostname,PGPORT:u.port||'5432',PGUSER:decodeURIComponent(u.username),PGPASSWORD:decodeURIComponent(u.password),PGDATABASE:name}});assert.equal(r.status,0,'Protected pre-change backup restore');
 const s=readJson(path.join(root,'.local/forums',c.id,'secrets.json'));s.databaseUrl=u.toString();const dir=privateDirectory(path.join(root,'.local/forums',name));fs.writeFileSync(path.join(dir,'secrets.json'),JSON.stringify(s));const clone={...c,id:name,database:name};
 const before=readJson('.local/phase23/before-'+n+'.json');await migrate(clone);await migrate(clone);
 const old=await connect(clone),live=await connect(c);const checks={};try{
  for(const [table,original] of Object.entries(before)){
   const ids=original.map(r=>r.id);const after=(await old.query(`SELECT id,md5(row_to_json(t)::text) AS hash FROM ${quote(table)} t WHERE id=ANY($1) ORDER BY id`,[ids])).rows;assert.deepEqual(after,original,'Migration preserved '+table);
   const historical=(await old.query(`SELECT to_jsonb(t) AS row FROM ${quote(table)} t WHERE id=ANY($1) ORDER BY id`,[ids])).rows.map(r=>r.row);
   const current=(await live.query(`SELECT to_jsonb(t) AS row FROM ${quote(table)} t WHERE id=ANY($1) ORDER BY id`,[ids])).rows.map(r=>r.row);
   assert.equal(current.length,historical.length,'No original row lost');
   if(table==='users')for(const row of [...historical,...current]){delete row.last_seen_at;delete row.last_login_ip;delete row.updated_at;}
   if(table==='topics')for(const row of [...historical,...current])delete row.view_count;
   assert.deepEqual(current,historical,'Live original '+table+' preserved (excluding authentication activity)');checks[table]={originalRows:ids.length,migrationIdentical:true,livePreserved:true};
  }
  results.push({forum:c.id,clone:name,checks});
 }finally{await old.end();await live.end();}
 console.log('PASS '+c.id+' pre-change restore upgrade/rerun; original accounts/credentials/roles/content/wallets/history preserved');
}
fs.writeFileSync('docs/audit/PHASE2.3-preservation-results.json',JSON.stringify({status:'PASS',results,authenticationActivityExcluded:['last_seen_at','last_login_ip','updated_at'],readCountersExcluded:['topics.view_count']},null,2)+'\n');
