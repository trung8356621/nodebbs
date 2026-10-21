import fs from 'node:fs';
import path from 'node:path';
import {config,connect,root,readJson,runtime,Client,quote,migrate,privateDirectory} from './forum.mjs';
const c=config('forums/forum-b.json'), target='pbn_phase22_empty_'+Date.now().toString(36);
const url=new URL(runtime(c).DATABASE_URL);url.pathname='/postgres';const admin=new Client({connectionString:url.toString()});await admin.connect();
try{await admin.query(`CREATE DATABASE ${quote(target)}`);}finally{await admin.end();}
const dir=path.join(root,'.local/forums',target);privateDirectory(dir);
const s=readJson(path.join(root,'.local/forums',c.id,'secrets.json'));const dbUrl=new URL(s.databaseUrl);dbUrl.pathname='/'+target;s.databaseUrl=dbUrl.toString();fs.writeFileSync(path.join(dir,'secrets.json'),JSON.stringify(s));
const fresh={...c,id:target,database:target};await migrate(fresh);await migrate(fresh);
const db=await connect(fresh);try{const row=(await db.query('SELECT (SELECT count(*) FROM users)::int AS users,(SELECT count(*) FROM policy_rules)::int AS policy_rules')).rows[0];if(row.users||row.policy_rules)throw new Error('Fresh database not empty');fs.writeFileSync('docs/audit/PHASE2.2-bootstrap-results.json',JSON.stringify({status:'PASS',database:target,rows:row,versions:(await db.query('SELECT version,checksum FROM pbn_meta.schema_versions ORDER BY version')).rows},null,2)+'\n');}finally{await db.end();}
console.log('PASS: genuinely empty database v1+v2 bootstrap and no-op rerun; retained for diagnosis');
