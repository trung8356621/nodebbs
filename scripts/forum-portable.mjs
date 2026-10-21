import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { publicCatalog } from './forum-catalog.mjs';
import { root, config, local, runtime, connect, createDatabase, sha, quote, readJson, writeJson, privateDirectory } from './forum.mjs';

function pgTool(tool, url, args) {
  const connection = new URL(url);
  const bin = process.env.PBN_PG_BIN || 'D:/laragon/bin/postgresql/postgresql/bin';
  const result = spawnSync(path.join(bin, tool + (process.platform === 'win32' ? '.exe' : '')), args, {
    env: { ...process.env, PGHOST:connection.hostname, PGPORT:connection.port || '5432',
      PGUSER:decodeURIComponent(connection.username), PGPASSWORD:decodeURIComponent(connection.password),
      PGDATABASE:decodeURIComponent(connection.pathname.slice(1)) },
    encoding:'utf8', windowsHide:true,
  });
  if (result.status !== 0) throw new Error(`${tool} failed: ${result.stderr?.replace(/postgres(?:ql)?:\/\/[^\s]+/g,'[redacted]')}`);
}
export async function fingerprint(client) {
  const tables = (await client.query("SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','pbn_meta','drizzle') ORDER BY schemaname,tablename")).rows;
  const rows = {};
  for (const t of tables) {
    const name = `${t.schemaname}.${t.tablename}`;
    const values = (await client.query(`SELECT row_to_json(t)::text AS value FROM ${quote(t.schemaname)}.${quote(t.tablename)} t ORDER BY row_to_json(t)::text COLLATE "C"`)).rows;
    rows[name] = { count:values.length, sha256:sha(values.map(r=>r.value).join('\n')) };
  }
  const schema = (await client.query(`SELECT table_schema,table_name,column_name,ordinal_position,data_type,udt_name,is_nullable,column_default,is_identity,identity_generation
    FROM information_schema.columns WHERE table_schema IN ('public','pbn_meta','drizzle') ORDER BY table_schema,table_name,ordinal_position`)).rows;
  const constraints = (await client.query(`SELECT n.nspname AS schema,t.relname AS name,c.conname,pg_get_constraintdef(c.oid) AS definition
    FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE n.nspname IN ('public','pbn_meta','drizzle') ORDER BY n.nspname,t.relname,c.conname`)).rows;
  const indexes = (await client.query("SELECT schemaname,tablename,indexname,indexdef FROM pg_indexes WHERE schemaname IN ('public','pbn_meta','drizzle') ORDER BY schemaname,tablename,indexname")).rows;
  const sequences = (await client.query("SELECT schemaname,sequencename,start_value,min_value,max_value,increment_by,cycle,last_value FROM pg_sequences WHERE schemaname IN ('public','pbn_meta','drizzle') ORDER BY schemaname,sequencename")).rows;
  let versions;
  const ledger = (await client.query("SELECT to_regclass('pbn_meta.schema_versions') AS t")).rows[0].t;
  if (ledger) versions = (await client.query('SELECT version,checksum FROM pbn_meta.schema_versions ORDER BY version')).rows;
  else {
    const expected=readJson(path.join(root,'apps/api/baseline/catalog.json'));
    const equivalent=JSON.stringify(await publicCatalog(client))===JSON.stringify(expected);
    if(!equivalent) throw new Error('Legacy forum schema differs from versioned baseline; reconcile on a restore first');
    versions=[{version:1,adoption:'catalog-equivalent; no live migration ledger adopted'}];
  }
  return { rows, schemaSha256:sha(JSON.stringify({schema,constraints,indexes})), sequences, versions };
}
function mediaFiles(dir, rel = '') {
  const result=[];
  if (!fs.existsSync(dir)) return result;
  for (const item of fs.readdirSync(dir,{withFileTypes:true})) {
    const next = path.join(rel,item.name), file=path.join(dir,item.name);
    if (item.isSymbolicLink()) throw new Error('Media symlinks are not portable');
    if (item.isDirectory()) result.push(...mediaFiles(file,next));
    else if (item.isFile()) result.push({ path:next.replaceAll('\\','/'), bytes:fs.statSync(file).size, sha256:sha(fs.readFileSync(file)) });
    else throw new Error('Unsupported media entry');
  }
  return result.sort((a,b)=>a.path.localeCompare(b.path));
}
function safeFile(base, relative) {
  if (path.isAbsolute(relative) || relative.includes('\\') || relative.split('/').some(v=>v==='..' || v==='')) throw new Error('Unsafe manifest media path');
  const target=path.resolve(base,relative);
  if (!target.startsWith(path.resolve(base)+path.sep)) throw new Error('Media path escapes bundle');
  return target;
}
async function exportForum(c, destination) {
  if (!destination) throw new Error('Specify new export directory');
  const target=path.resolve(destination);
  if (fs.existsSync(target)) throw new Error('Export destination already exists');
  if (fs.existsSync(path.join(local(c),'processes.json'))) throw new Error('Stop this forum before consistent DB/media export');
  privateDirectory(target);
  const client=await connect(c);
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    if ((await client.query('SELECT 1 FROM pg_foreign_server LIMIT 1')).rowCount) throw new Error('Foreign database servers are not supported');
    const snapshot=(await client.query('SELECT pg_export_snapshot() AS id')).rows[0].id;
    const state=await fingerprint(client);
    const dump=path.join(target,'forum.dump');
    pgTool('pg_dump',runtime(c).DATABASE_URL,['--format=custom','--no-owner','--no-privileges','--snapshot='+snapshot,'--file='+dump]);
    const source=runtime(c).UPLOAD_ROOT, media=mediaFiles(source);
    for(const file of media) {
      const dest=safeFile(path.join(target,'media'),file.path);
      fs.mkdirSync(path.dirname(dest),{recursive:true}); fs.copyFileSync(safeFile(source,file.path),dest);
      if(sha(fs.readFileSync(dest))!==file.sha256) throw new Error('Media changed during export');
    }
    const portable={ ...(c.publicOrigin ? {publicOrigin:c.publicOrigin} : {}), id:c.id, database:c.database, hostname:c.hostname, webPort:c.webPort, apiPort:c.apiPort, name:c.name, locale:c.locale, primaryColor:c.primaryColor, logo:c.logo,description:c.description,status:c.status };
    writeJson(path.join(target,'forum-public.json'),portable);
    writeJson(path.join(target,'manifest.json'),{format:1,sourceDatabase:c.database,created:new Date().toISOString(),
      databaseSha256:sha(fs.readFileSync(dump)),configSha256:sha(fs.readFileSync(path.join(target,'forum-public.json'))),state,media});
    await client.query('COMMIT');
    console.log(`Exported ${c.id}; dump and media checksummed. Bundle contains private forum data; keep offline/protected.`);
  } catch(e) {await client.query('ROLLBACK');throw e;} finally {await client.end();}
}
async function restoreForum(c, source) {
  if (c.database==='pbn_dev') throw new Error('Cannot restore over forum A');
  const dir=path.resolve(source), manifest=readJson(path.join(dir,'manifest.json'));
  if(manifest.format!==1) throw new Error('Unsupported bundle');
  if(sha(fs.readFileSync(path.join(dir,'forum.dump')))!==manifest.databaseSha256 || sha(fs.readFileSync(path.join(dir,'forum-public.json')))!==manifest.configSha256) throw new Error('Bundle checksum mismatch');
  for(const file of manifest.media) if(sha(fs.readFileSync(safeFile(path.join(dir,'media'),file.path)))!==file.sha256) throw new Error('Media checksum mismatch');
  const uploads=runtime(c).UPLOAD_ROOT;
  if(mediaFiles(uploads).length) throw new Error('Restore target media must be empty');
  // createDatabase refuses every existing target, including failed/partial restores.
  await createDatabase(c);
  pgTool('pg_restore',runtime(c).DATABASE_URL,['--exit-on-error','--single-transaction','--no-owner','--no-privileges','--dbname='+c.database,path.join(dir,'forum.dump')]);
  const client=await connect(c);
  try {
    const actual=await fingerprint(client);
    if(JSON.stringify(actual)!==JSON.stringify(manifest.state)) throw new Error('Restored row/schema/sequence/version fingerprint mismatch; target retained for diagnosis');
    for(const file of manifest.media) {
      const target=safeFile(uploads,file.path);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(safeFile(path.join(dir,'media'),file.path),target);
    }
    if(JSON.stringify(mediaFiles(uploads))!==JSON.stringify(manifest.media)) throw new Error('Restored media fingerprint mismatch');
    writeJson(path.join(local(c),'restore-verification.json'),{pass:true,sourceDatabase:manifest.sourceDatabase,targetDatabase:c.database,state:actual,media:manifest.media});
    console.log(`Restore verified: ${c.database}; row contents/counts, schema, sequences, version, media match`);
  } finally {await client.end();}
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
const [command,file,directory]=process.argv.slice(2);
try {
  const c=config(file);
  if(command==='export') await exportForum(c,directory);
  else if(command==='restore') await restoreForum(c,directory);
  else throw new Error('Usage: node scripts/forum-portable.mjs export|restore <config> <bundle-dir>');
} catch(e) {console.error(e.message.replace(/postgres(?:ql)?:\/\/[^\s]+/g,'[redacted]'));process.exitCode=1;}

}
