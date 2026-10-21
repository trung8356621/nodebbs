import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {config,root,local,readJson,connect,stop,start,migrate,configure,privateDirectory,writeJson} from './forum.mjs';
import {waitApis} from './policy-test-helper.mjs';
const b=config('forums/forum-b.json'),suffix=Date.now().toString(36);
const paths={config:'.local/phase22/restore-'+suffix+'.json',bundle:'.local/exports/phase22-'+suffix};
const c={...b,id:'phase22_restore_'+suffix,database:'pbn_phase22_restore_'+suffix,webPort:3400,apiPort:7400,legacyUploads:false};
privateDirectory(path.join(root,'.local/phase22'));writeJson(path.join(root,paths.config),c);await configure(c);
function portable(action,...args){const result=spawnSync(process.execPath,[path.join(root,'scripts/forum-portable.mjs'),action,...args],{cwd:root,windowsHide:true,stdio:'inherit'});assert.equal(result.status,0,'Portable '+action);}
await stop(b);try{portable('export','forums/forum-b.json',paths.bundle);}finally{await start(b);}
portable('restore',paths.config,paths.bundle);await migrate(c);await start(c);
await waitApis([c,b]);const credentials=readJson(path.join(local(b),'admin.json'));
const login=await fetch(`http://127.0.0.1:${c.apiPort}/api/auth/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identifier:credentials.username,password:credentials.password})});assert.equal(login.status,200);const {token}=await login.json();
for(const route of ['/api/policy/','/api/dashboard/stats','/api/auth/me']) {const r=await fetch(`http://127.0.0.1:${c.apiPort}${route}`,{headers:{authorization:'Bearer '+token}});assert.equal(r.status,200);}
const foreign=await fetch(`http://127.0.0.1:${b.apiPort}/api/policy/`,{headers:{authorization:'Bearer '+token}});assert.equal(foreign.status,401);
const db=await connect(c);let versions;try{versions=(await db.query('SELECT version,checksum FROM pbn_meta.schema_versions ORDER BY version')).rows;assert((await db.query('SELECT count(*)::int AS n FROM policy_decisions')).rows[0].n>0);assert((await db.query('SELECT count(*)::int AS n FROM moderation_items')).rows[0].n>0);}finally{await db.end();}
const manifest=readJson(path.join(root,paths.bundle,'manifest.json'));
fs.writeFileSync('docs/audit/PHASE2.2-restore-results.json',JSON.stringify({status:'PASS',database:c.database,tableCount:Object.keys(manifest.state.rows).length,mediaCount:manifest.media.length,versions,checks:['Source stopped during consistent export','Restore verified all row hashes/counts, schema, sequences, versions and media','Restored no-op migration passed','Real restored Admin login/dashboard/policy/me passed','Restored token rejected by source forum']},null,2)+'\n');
await stop(c);console.log('PASS: restored Admin login/policy/dashboard, own versions, foreign-token rejection; clone stopped and DB/media retained');
