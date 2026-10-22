import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',windowsHide:true}).trim();
const files=git('diff','--cached','--name-only').split('\n').filter(Boolean);
assert(files.length>0,'Stage implementation files before review');
assert(!files.some(f=>f.startsWith('apps/api/baseline/')),'No schema or historical baseline changes in this UX task');
const privatePath=/(?:^|\/)(?:\.local|node_modules|virtual-store|\.next[^/]*|uploads)(?:\/|$)|(?:^|\/)(?:\.env(?:\..*)?|secrets\.json|admin\.json)$|\.(?:dump|dpapi|pem|key)$/i;
const patterns=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/,/postgres(?:ql)?:\/\/[^/\s'"]+:[^@\s'"]+@/];
for(const file of files){assert(!privatePath.test(file),'Private/runtime artifact staged: '+file);if(!file.endsWith('.png')){const data=git('show',':'+file);assert(!patterns.some(p=>p.test(data)),'Potential secret staged in '+file);}}
for(const file of ['0000_simple_guardsmen.sql','extra.sql','0001_keen_bulldozer.sql','catalog.json','catalog-v2.json','0002_right_malice.sql','0003_pin_currency.sql','catalog-v3.json','catalog-v4.json'])assert(!files.includes('apps/api/baseline/'+file),'Immutable historical baseline changed');
const manifest=JSON.parse(git('show',':apps/api/baseline/manifest.json'));
const historical=JSON.parse(git('show','HEAD:apps/api/baseline/manifest.json'));assert.deepEqual(manifest.migrations.slice(0,historical.migrations.length),historical.migrations,'Historical manifest entries immutable');
const oldJournal=JSON.parse(git('show','HEAD:apps/api/baseline/meta/_journal.json'));const newJournal=JSON.parse(git('show',':apps/api/baseline/meta/_journal.json'));assert.deepEqual(newJournal.entries.slice(0,oldJournal.entries.length),oldJournal.entries,'Historical migration journal entries immutable');
assert.equal(git('branch','--show-current'),'chore/pbn-phase1-5-i18n');
for(const m of manifest.migrations)for(const entry of m.files){const bytes=execFileSync('git',['show',':apps/api/baseline/'+entry.file],{windowsHide:true});assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),entry.sha256,'Staged migration checksum: '+entry.file);}
assert.equal(git('remote','get-url','origin'),'https://github.com/trung8356621/nodebbs.git');
const result={status:'PASS',stagedFiles:files.length,checks:['Changed paths reviewed; no private credentials, DB dumps, runtime caches or upload artifacts staged','No private-key/JWT/credential-bearing database URL found in staged text','Immutable historical baseline SQL/catalogs preserved','All staged migration SQL checksums match the manifest','Personal origin and existing branch verified'],branch:git('branch','--show-current'),origin:git('remote','get-url','origin')};
fs.writeFileSync('docs/audit/PHASE2.3B-source-review.json',JSON.stringify(result,null,2)+'\n');console.log('PASS staged source, migration checksums, private artifact/secret scan and personal origin ('+files.length+' files)');
