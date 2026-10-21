import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import net from 'node:net';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const api = path.join(root, 'apps/api');
const require = createRequire(path.join(api, 'package.json'));
export const { Client } = require('pg');
export const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');
export const quote = (value) => '"' + value.replaceAll('"', '""') + '"';
export const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
export const writeJson = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
export function config(file) {
  const selected = path.resolve(root, file);
  const c = readJson(selected);
  if (!/^[a-z][a-z0-9_]{1,40}$/.test(c.id) || !/^pbn_[a-z0-9_]+$/.test(c.database)) throw new Error('Invalid forum identity');
  if (typeof c.hostname !== 'string' || c.hostname.length > 253 || !/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/i.test(c.hostname)) throw new Error('Invalid exact hostname');
  if (c.publicOrigin && (!['http:','https:'].includes(new URL(c.publicOrigin).protocol) || new URL(c.publicOrigin).hostname !== c.hostname || new URL(c.publicOrigin).origin !== c.publicOrigin)) throw new Error('Invalid public origin');
  if (c.status !== 'active' || !['vi-VN', 'en-US'].includes(c.locale) || !/^#[a-f0-9]{6}$/i.test(c.primaryColor)) throw new Error('Invalid forum configuration');
  if (![c.webPort, c.apiPort].every(p => Number.isInteger(p) && p > 1024 && p < 65536) || c.webPort === c.apiPort) throw new Error('Invalid ports');
  if (c.legacyUploads && c.id !== 'forum_a') throw new Error('Legacy storage reserved for forum A');
  for (const name of fs.readdirSync(path.join(root,'forums')).filter(v=>v.endsWith('.json'))) {
    const otherPath=path.join(root,'forums',name);
    if(path.resolve(otherPath)===selected) continue;
    const other=readJson(otherPath);
    if(other.id===c.id || other.database===c.database || [other.apiPort,other.webPort].some(port=>[c.apiPort,c.webPort].includes(port))) throw new Error('Forum ID, database and ports must be unique across registry configs');
  }
  return c;
}
const protectedDirs = new Set();
export function privateDirectory(dir) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  if (process.platform === 'win32' && !protectedDirs.has(dir)) {
    const owner = process.env.USERDOMAIN + '\\' + process.env.USERNAME;
    const result = spawnSync('icacls.exe', [dir, '/inheritance:r', '/grant:r', owner + ':(OI)(CI)F', '/Q'], { encoding: 'utf8', windowsHide: true });
    if (result.status !== 0) throw new Error('Cannot protect local forum directory');
    protectedDirs.add(dir);
  }
  return dir;
}
export function local(c) {
  const dir = path.join(root, '.local/forums', c.id);
  return privateDirectory(dir);
}
export function envFile(file) {
  return process.loadEnvFile ? (() => {
    // Parse without changing this operator process's environment.
    return require('node:util').parseEnv(fs.readFileSync(file, 'utf8'));
  })() : {};
}
export function runtime(c) {
  const dir = local(c);
  const secrets = path.join(dir, 'secrets.json');
  if (!fs.existsSync(secrets)) throw new Error('Run configure first');
  const s = readJson(secrets);
  if (decodeURIComponent(new URL(s.databaseUrl).pathname.slice(1)) !== c.database) throw new Error('Configured database reference disagrees with forum config');
  const uploads = c.legacyUploads ? path.join(api, 'uploads') : path.join(dir, 'uploads');
  fs.mkdirSync(uploads, { recursive: true });
  return {
    NODE_ENV: 'development', FORUM_ID: c.id, FORUM_DATABASE_NAME: c.database,
    DATABASE_URL: s.databaseUrl, REDIS_URL: s.redisUrl,
    REDIS_KEY_PREFIX: `pbn:${c.id}:`, DB_POOL_MAX: '5',
    JWT_SECRET: s.jwtSecret, COOKIE_SECRET: s.cookieSecret,
    AUTH_COOKIE_NAME: `pbn_${c.id}_auth`, COOKIE_SAMESITE: 'lax', COOKIE_SECURE: 'false',
    UPLOAD_ROOT: uploads, HOST: '127.0.0.1', PORT: String(c.apiPort),
    CORS_ORIGIN: c.publicOrigin || `http://${c.hostname}:${c.webPort}`,
    FORUM_WEB_ORIGIN: c.publicOrigin || `http://${c.hostname}:${c.webPort}`,
    FORUM_ALLOWED_HOSTS: [...new Set([`${c.hostname}:${c.webPort}`, `${c.hostname}:${c.apiPort}`, `127.0.0.1:${c.webPort}`, `127.0.0.1:${c.apiPort}`, ...(c.publicOrigin ? [new URL(c.publicOrigin).host] : [])])].join(','),
    SERVER_API_URL: `http://127.0.0.1:${c.apiPort}`,
    FORUM_NEXT_DIST: `.next-${c.id}`, FORUM_DEFAULT_LOCALE: c.locale,
    NEXT_PUBLIC_FORUM_DEFAULT_LOCALE: c.locale,
    NEXT_PUBLIC_FORUM_LOCALE_COOKIE: `pbn_${c.id}_locale`,
    FORUM_PRIMARY_COLOR: c.primaryColor,
  };
}
export function processEnv(c) {
  const inherited = { ...process.env };
  for (const key of Object.keys(inherited)) {
    if (/^(FORUM_|NEXT_PUBLIC_|DATABASE_|REDIS_|JWT_|COOKIE_|AUTH_|SERVER_API_|UPLOAD_|PORT$|HOST$|CORS_|NODE_OPTIONS$)/.test(key)) delete inherited[key];
  }
  return { ...inherited, ...runtime(c) };
}
export async function connect(c, override) {
  const client = new Client({ connectionString: override || runtime(c).DATABASE_URL, connectionTimeoutMillis: 5000 });
  await client.connect();
  const actual = (await client.query('SELECT current_database() AS name')).rows[0].name;
  if (!override && actual !== c.database) { await client.end(); throw new Error('Wrong database target'); }
  return client;
}
export async function configure(c) {
  const dir = local(c), file = path.join(dir, 'secrets.json');
  if (fs.existsSync(file)) { runtime(c); return console.log(`Configuration already exists: ${c.id}`); }
  // Operator-provided connection reference; never comes from a request or public config.
  const legacy = envFile(path.join(api, '.env'));
  const source = process.env.PBN_DATABASE_URL || legacy.DATABASE_URL;
  if (!source) throw new Error('Set PBN_DATABASE_URL');
  const url = new URL(source); url.pathname = '/' + c.database;
  if (!['127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error('Development DB must be loopback');
  writeJson(file, { databaseUrl: url.toString(), redisUrl: process.env.PBN_REDIS_URL || legacy.REDIS_URL,
    jwtSecret: crypto.randomBytes(48).toString('hex'), cookieSecret: crypto.randomBytes(48).toString('hex') });
  runtime(c);
  console.log(`Configured ${c.id}; secrets are local and ignored`);
}
export async function createDatabase(c, name = c.database) {
  if (name === 'pbn_dev' || !/^pbn_[a-z0-9_]+$/.test(name)) throw new Error('Refusing existing forum A / invalid target');
  const url = new URL(runtime(c).DATABASE_URL); url.pathname = '/postgres';
  const client = new Client({ connectionString: url.toString() }); await client.connect();
  try {
    if ((await client.query('SELECT 1 FROM pg_database WHERE datname=$1', [name])).rowCount) throw new Error('Database already exists; refusing overwrite');
    await client.query(`CREATE DATABASE ${quote(name)}`);
    console.log(`Created ${name}`);
  } finally { await client.end(); }
}
export function manifest() {
  const dir = path.join(api, 'baseline');
  const files = readJson(path.join(dir, 'meta/_journal.json')).entries.map(e => e.tag + '.sql');
  files.push('extra.sql');
  return { version: 1, files: files.map(file => ({ file, sha256: sha(fs.readFileSync(path.join(dir, file))) })) };
}
export async function migrate(c) {
  if (c.database === 'pbn_dev') throw new Error('pbn_dev migration forbidden; baseline adoption needs separate restore rehearsal');
  const dir = path.join(api, 'baseline');
  const document = readJson(path.join(dir, 'manifest.json'));
  // Preserve the v1 checksum format; append immutable records for future versions.
  const migrations = document.migrations || [document];
  let previous = 0;
  for (const migration of migrations) {
    if (!Number.isInteger(migration.version) || migration.version <= previous || !migration.files?.length) throw new Error('Invalid migration order');
    previous = migration.version;
    for (const entry of migration.files) {
      if (!/^[a-zA-Z0-9_]+\.sql$/.test(entry.file) || sha(fs.readFileSync(path.join(dir,entry.file))) !== entry.sha256) throw new Error('Migration checksum mismatch');
    }
  }
  const client = await connect(c);
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '10s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('pbn-baseline'))");
    const exists = (await client.query("SELECT to_regclass('pbn_meta.schema_versions') AS t")).rows[0].t;
    if (!exists) {
      const tables = await client.query("SELECT 1 FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema') LIMIT 1");
      if (tables.rowCount) throw new Error('Baseline requires an empty database');
      await client.query('CREATE SCHEMA pbn_meta');
      await client.query('CREATE TABLE pbn_meta.schema_versions(version integer PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
    }
    const rows = (await client.query('SELECT version,checksum FROM pbn_meta.schema_versions ORDER BY version')).rows;
    if (rows.some((row,index) => migrations[index]?.version !== row.version)) throw new Error('Unexpected applied migration history; refusing downgrade or gaps');
    for (const migration of migrations) {
      const checksum = sha(JSON.stringify(migration));
      const applied = rows.find(row => row.version === migration.version);
      if (applied) {
        if (applied.checksum !== checksum) throw new Error('Applied migration checksum mismatch');
        console.log('Migration already applied: ' + c.database + ' v' + migration.version);
      } else {
        for (const entry of migration.files) {
          for (const statement of fs.readFileSync(path.join(dir,entry.file),'utf8').split('--> statement-breakpoint')) if (statement.trim()) await client.query(statement);
        }
        await client.query('INSERT INTO pbn_meta.schema_versions(version,checksum) VALUES($1,$2)',[migration.version,checksum]);
        console.log('Migration applied: ' + c.database + ' v' + migration.version);
      }
    }
    if (migrations.at(-1).version === 1) {
      const { publicCatalog } = await import('./forum-catalog.mjs');
      if (JSON.stringify(await publicCatalog(client)) !== JSON.stringify(readJson(path.join(dir,'catalog.json')))) throw new Error('Schema drift from baseline v1');
    }
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { await client.end(); }
}
export function run(c, script, args = []) {
  const result = spawnSync(process.execPath, [path.join(api, script), ...args], { cwd: api, env: processEnv(c), stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`Command failed: ${script}`);
}
export async function seed(c) {
  if (c.database === 'pbn_dev') throw new Error('Refusing seed on forum A');
  run(c, 'src/scripts/init/index.js', ['init']);
  await identity(c);
}
export async function identity(c) {
  if (c.database === 'pbn_dev') throw new Error('Forum A identity is preserved; do not mutate its data');
  const client = await connect(c);
  try {
    for (const [key,value] of Object.entries({ site_name: c.name, site_description: c.description, site_logo: c.logo, site_url: c.publicOrigin || `http://${c.hostname}:${c.webPort}`, site_primary_color: c.primaryColor, forum_default_locale: c.locale })) {
      await client.query('INSERT INTO system_settings(key,value,value_type) VALUES($1,$2,\'string\') ON CONFLICT(key) DO UPDATE SET value=excluded.value', [key,value]);
    }
  } finally { await client.end(); }
}
export async function admin(c) {
  if (c.database === 'pbn_dev') throw new Error('Forum A admin must remain untouched');
  const file = path.join(local(c), 'admin.json');
  if (fs.existsSync(file)) throw new Error('Admin handoff already exists; refusing reset');
  const bcrypt = require('bcryptjs'), password = crypto.randomBytes(32).toString('base64url');
  const client = await connect(c);
  try {
    await client.query('BEGIN');
    if ((await client.query('SELECT 1 FROM users LIMIT 1')).rowCount) throw new Error('New forum admin provisioning requires no users');
    const role = (await client.query("SELECT id FROM roles WHERE slug='admin'")).rows[0];
    if (!role) throw new Error('Seed RBAC first');
    const username = `${c.id}_admin`, email = `${username}@example.test`;
    const user = (await client.query("INSERT INTO users(username,email,password_hash,role) VALUES($1,$2,$3,'admin') RETURNING id", [username,email,await bcrypt.hash(password,10)])).rows[0];
    await client.query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)', [user.id,role.id]);
    writeJson(file, { username,email,password });
    await client.query('COMMIT');
    console.log(`Admin created for ${c.id}; private handoff in .local/forums/${c.id}/admin.json`);
  } catch(e) { await client.query('ROLLBACK'); throw e; }
  finally { await client.end(); }
}
export async function start(c, mode = 'dev') {
  if (!['dev', 'build', 'start'].includes(mode)) throw new Error('Unknown Next mode');
  const env = processEnv(c), dir = local(c);
  if (mode !== 'dev') { env.NODE_ENV='production'; env.FORUM_NEXT_DIST=`.next-${c.id}-production`; }
  if (mode === 'start') {
    const stamp=readJson(path.join(root,'apps/web',env.FORUM_NEXT_DIST,'pbn-build.json'));
    if(stamp.configSha256!==sha(JSON.stringify(c))) throw new Error('Forum config changed; rebuild before production-mode start');
  }
  const launch = (kind, args, cwd) => {
    const file = path.join(dir, `${kind}.log`);
    const fd = fs.openSync(file, 'a');
    const child = spawn(process.execPath, [`--title=pbn_${c.id}_${kind}`, ...args], { cwd, env, detached: true, windowsHide: true, stdio: ['ignore',fd,fd] });
    child.unref(); fs.closeSync(fd); return child.pid;
  };
  const next = path.join(root, 'apps/web/node_modules/next/dist/bin/next');
  if (mode === 'build') {
    const result = spawnSync(process.execPath, [next, 'build', '--turbopack'], { cwd: path.join(root,'apps/web'), env: { ...env, NODE_ENV: 'production' }, stdio: 'inherit' });
    if (result.status !== 0) throw new Error('Next build failed');
    writeJson(path.join(root,'apps/web',env.FORUM_NEXT_DIST,'pbn-build.json'),{forum:c.id,configSha256:sha(JSON.stringify(c))});
    return;
  }
  for (const port of [c.apiPort,c.webPort]) {
    await new Promise((resolve,reject) => {
      const socket = net.createServer();
      socket.once('error', () => reject(new Error('Port already in use: ' + port)));
      socket.listen({host:'127.0.0.1',port,exclusive:true}, () => socket.close(resolve));
    });
  }
  const state = path.join(dir, 'processes.json');
  if (fs.existsSync(state)) {
    const old = readJson(state);
    for (const pid of [old.api,old.web]) { try { process.kill(pid,0); throw new Error('Instance already running; use stop first'); } catch(e) { if (e.code !== 'ESRCH') throw e; } }
  }
  const apiPid = launch('api', [path.join(api,'src/app.js')], api);
  const webPid = launch('web', [next,mode, ...(mode==='dev'?['--turbopack']:[]), '-p',String(c.webPort),'--hostname','127.0.0.1'], path.join(root,'apps/web'));
  writeJson(state, { api:apiPid,web:webPid,forum:c.id,started:new Date().toISOString() });
  console.log(`Started ${c.id}: Web ${c.webPort}, API ${c.apiPort}; isolated logs in ${dir}`);
}
export function stop(c) {
  const file = path.join(local(c),'processes.json');
  if (!fs.existsSync(file)) throw new Error('No managed process state');
  const state = readJson(file);
  if (state.forum !== c.id) throw new Error('Wrong process identity');
  // Windows helper checks command lines before stopping only this managed tree.
  const result = spawnSync('powershell.exe', ['-NoProfile','-File',path.join(root,'scripts/stop-forum.ps1'),'-StateFile',file,'-RepoRoot',root], { stdio:'inherit',windowsHide:true });
  if (result.status !== 0) throw new Error('Stop failed');
  fs.unlinkSync(file);
}
async function main() {
  const [command,file,extra] = process.argv.slice(2);
  if (!command || !file) throw new Error('Usage: node scripts/forum.mjs configure|provision|create-db|migrate|seed|identity|admin|start|stop|build <forum-config.json>');
  const c = config(file);
  const actions = { provision: async c => { await configure(c); await createDatabase(c); await migrate(c); await seed(c); await admin(c); }, configure, identity, 'create-db':createDatabase, migrate, seed, admin, start, stop, build:c=>start(c,'build') };
  if (!actions[command]) throw new Error('Unknown command');
  await actions[command](c,...(command === 'start' ? [extra] : []));
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch(e => { console.error(e.message.replace(/postgres(?:ql)?:\/\/[^\s]+/g,'[database URL redacted]')); process.exitCode=1; });
}
