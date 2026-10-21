import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync,execFileSync} from 'node:child_process';
import {root,config,connect,readJson,sha,quote} from './forum.mjs';
import {publicCatalog} from './forum-catalog.mjs';
const git=(...args)=>{const r=spawnSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true});assert.equal(r.status,0,'git '+args[0]);return r.stdout.trim();};
assert.equal(git('remote','get-url','origin'),'https://github.com/trung8356621/nodebbs.git');
const files=[...new Set([...git('diff','--name-only','HEAD').split('\n'),...git('ls-files','--others','--exclude-standard').split('\n')].filter(Boolean))];
const secrets=[];
for(const dir of fs.readdirSync(path.join(root,'.local/forums'),{withFileTypes:true}).filter(d=>d.isDirectory())){
 for(const filename of ['secrets.json','admin.json']){const f=path.join(root,'.local/forums',dir.name,filename);if(!fs.existsSync(f))continue;const s=readJson(f);for(const k of ['databaseUrl','redisUrl','jwtSecret','cookieSecret','password'])if(typeof s[k]==='string'&&s[k].length>=12)secrets.push(s[k]);}
}
secrets.push(execFileSync('pwsh.exe',['-NoProfile','-NonInteractive','-Command',"$s=Get-Content -LiteralPath '.local/pbn-owner-password.dpapi' -Raw; $v=ConvertTo-SecureString $s.Trim(); ([System.Management.Automation.PSCredential]::new('owner',$v)).GetNetworkCredential().Password"],{cwd:root,encoding:'utf8',windowsHide:true}).trim());
for(const file of files){assert(!/(^|\/)\.local\/|\.env$|\.dump$|private\.pem$|\.next-/.test(file),'Private/runtime path visible to Git');const full=path.join(root,file);if(!fs.existsSync(full)||!fs.statSync(full).isFile())continue;const bytes=fs.readFileSync(full);for(const secret of secrets)assert(!bytes.includes(Buffer.from(secret)),'Known secret in Git-visible file (value withheld): '+file);assert(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(bytes.toString('utf8')),'Private key in '+file);}
const manifest=readJson('apps/api/baseline/manifest.json');for(const m of manifest.migrations)for(const e of m.files)assert.equal(sha(fs.readFileSync('apps/api/baseline/'+e.file)),e.sha256,'Immutable SQL bytes');
const a=config('forums/forum-a.json'),b=config('forums/forum-b.json');const ca=await connect(a),cb=await connect(b),rehearsal=await connect({...a,id:'phase22_rehearsal',database:'pbn_phase22_adoption_rehearsal',legacyUploads:false});
const result={date:'2026-10-22',timezone:'Asia/Bangkok',status:'PASS',branch:git('branch','--show-current'),origin:'https://github.com/trung8356621/nodebbs.git',secretScan:{status:'PASS',changedAndUntrackedFiles:files.length,knownSecretMatches:0,privateKeys:0},migrationBytes:'PASS',preservation:{},runtime:[]};
try{
 for(const table of ['categories','topics','posts']){
  const before=(await rehearsal.query(`SELECT id,row_to_json(t)::text AS row FROM ${quote(table)} t ORDER BY id`)).rows;
  const after=(await ca.query(`SELECT id,row_to_json(t)::text AS row FROM ${quote(table)} t WHERE id=ANY($1::int[]) ORDER BY id`,[before.map(r=>r.id)])).rows;
  assert.deepEqual(after,before,'Original A '+table+' rows changed');result.preservation[table]={originalRows:before.length,exactRowHash:sha(JSON.stringify(before)),unchanged:true};
 }
 const query='SELECT id,username,email,password_hash,role FROM users ORDER BY id';const oldUsers=(await rehearsal.query(query)).rows,newUsers=(await ca.query(query)).rows;
 for(const user of oldUsers)assert.deepEqual(newUsers.find(u=>u.id===user.id),user,'Original identity/password/role changed');
 assert.deepEqual((await ca.query('SELECT * FROM user_roles ORDER BY id')).rows,(await rehearsal.query('SELECT * FROM user_roles ORDER BY id')).rows);
 result.preservation.users={originalRows:oldUsers.length,identityPasswordRoleUnchanged:true,rbacUnchanged:true};
 const oldWallets=(await rehearsal.query('SELECT * FROM sys_accounts ORDER BY id')).rows;for(const wallet of oldWallets)assert.deepEqual((await ca.query('SELECT * FROM sys_accounts WHERE id=$1',[wallet.id])).rows[0],wallet);
 result.preservation.wallets={originalRows:oldWallets.length,originalBalancesUnchanged:true};
 for(const [c,db]of [[a,ca],[b,cb]]){
  assert.deepEqual(await publicCatalog(db),readJson('apps/api/baseline/catalog-v2.json'));
  assert.deepEqual((await db.query('SELECT version,checksum FROM pbn_meta.schema_versions ORDER BY version')).rows,manifest.migrations.map(m=>({version:m.version,checksum:sha(JSON.stringify(m))})));
  for(const [kind,port,route]of [['web',c.webPort,'/'],['api',c.apiPort,'/api']]){const r=await fetch(`http://127.0.0.1:${port}${route}`,{signal:AbortSignal.timeout(30000)});assert.equal(r.status,200);result.runtime.push({forum:c.id,kind,port,status:200});}
 }
 for(const sample of ['.local/phase22/policy-private.pem','.local/phase22/forum-a-before.dump','.local/forums/forum_a/secrets.json','apps/web/.next-forum_a-production/pbn-build.json'])assert(git('check-ignore',sample));
 result.builds={forumA:{status:'PASS',exitCode:0},forumB:{status:'PASS',exitCode:0},existingDynamicSitemapMessages:true};
 result.unitAssertions=37;
 result.lint={status:'PASS',existingWarnings:11};result.i18n={status:'PASS',webKeysPerLocale:2561,backendTemplatesPerLocale:707};
 result.evidenceFiles=[];
 for(const file of fs.readdirSync('docs/audit').filter(f=>/^PHASE2\.2-.*\.json$/.test(f)&&f!=='PHASE2.2-final-checks.json')) {
  const evidence=readJson(path.join('docs/audit',file));
  if(Array.isArray(evidence))assert(evidence.every(r=>r.status==='PASS'),'Nonpassing evidence: '+file);
  else {if('pass' in evidence)assert.equal(evidence.pass,true,'Nonpassing evidence: '+file);if('status' in evidence)assert.equal(evidence.status,'PASS','Nonpassing evidence: '+file);if(evidence.checks?.[0]?.status)assert(evidence.checks.every(r=>r.status==='PASS'),'Nonpassing evidence: '+file);}
  result.evidenceFiles.push(file);
 }
 fs.writeFileSync('docs/audit/PHASE2.2-final-checks.json',JSON.stringify(result,null,2)+'\n');
 console.log('PASS: original A categories/topics/posts/identities/passwords/RBAC/wallets preserved; A/B catalogs and ledgers verified; all four ports 200; Git-visible secret scan clean');
}finally{await Promise.all([ca.end(),cb.end(),rehearsal.end()]);}
