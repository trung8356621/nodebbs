import fs from 'node:fs';
import path from 'node:path';
import {config,runtime,Client,quote,root,privateDirectory,readJson,migrate,connect} from './forum.mjs';
import {publicCatalog} from './forum-catalog.mjs';
const c=config('forums/forum-b.json'),name='pbn_seo_test_'+Date.now().toString(36);
const u=new URL(runtime(c).DATABASE_URL);u.pathname='/postgres';const admin=new Client({connectionString:u.toString()});await admin.connect();await admin.query(`CREATE DATABASE ${quote(name)}`);await admin.end();
const s=readJson(path.join(root,'.local/forums',c.id,'secrets.json'));const du=new URL(s.databaseUrl);du.pathname='/'+name;s.databaseUrl=du.toString();const dir=privateDirectory(path.join(root,'.local/forums',name));fs.writeFileSync(path.join(dir,'secrets.json'),JSON.stringify(s));
const f={...c,id:name,database:name};const db=await connect(f);
try{
 for(const m of readJson('apps/api/baseline/manifest.json').migrations)for(const entry of m.files)for(const sql of fs.readFileSync('apps/api/baseline/'+entry.file,'utf8').split('--> statement-breakpoint'))if(sql.trim())await db.query(sql);
 fs.writeFileSync('apps/api/baseline/catalog-v6.json',JSON.stringify(await publicCatalog(db),null,2)+'\n');
}finally{await db.end();}
// Separate genuinely fresh database validates the maintained migration command and rerun.
const fresh=name+'_fresh';u.pathname='/postgres';const a=new Client({connectionString:u.toString()});await a.connect();await a.query(`CREATE DATABASE ${quote(fresh)}`);await a.end();const fd=privateDirectory(path.join(root,'.local/forums',fresh));du.pathname='/'+fresh;s.databaseUrl=du.toString();fs.writeFileSync(path.join(fd,'secrets.json'),JSON.stringify(s));const fc={...c,id:fresh,database:fresh};await migrate(fc);await migrate(fc);
fs.writeFileSync('docs/audit/PHASE2.3-SEO-bootstrap-results.json',JSON.stringify({status:'PASS',database:fresh,rehearsal:name,versions:[1,2,3,4,5,6],catalog:readJson('apps/api/baseline/catalog-v6.json')},null,2)+'\n');console.log('PASS fresh v1-v6 migration and no-op rerun');
