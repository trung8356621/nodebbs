#!/usr/bin/env node
/**
 * PBN local development orchestrator.
 *
 * Ensures Forum A dependencies (PostgreSQL + Redis on 16379) are reachable,
 * starts Redis via scripts/start-pbn-redis.ps1 when needed, then runs the
 * existing API/Web package `dev` scripts without duplicating healthy instances.
 *
 * Does not start Forum B, Docker, migrations, or shared PostgreSQL.
 */
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseEnv } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const apiDir = path.join(root, 'apps', 'api');
const webDir = path.join(root, 'apps', 'web');
const redisHelper = path.join(root, 'scripts', 'start-pbn-redis.ps1');
const stateFile = path.join(root, '.local', 'dev-stack.json');
const stopFile = path.join(root, '.local', 'dev-stack.stop');
const redisDataDir = path.join(root, '.local', 'redis');
let activeConfig = null;

const PG_ATTEMPTS = 45;
const PG_DELAY_MS = 1000;
const REDIS_ATTEMPTS = 60;
const REDIS_DELAY_MS = 500;
const SERVICE_ATTEMPTS = 90;
const SERVICE_DELAY_MS = 1000;

const owned = { redis: false, api: false, web: false };
const children = { api: null, web: null };
let shuttingDown = false;

function log(message) {
  console.log(`[dev] ${message}`);
}

function fail(message) {
  console.error(`[dev] FAIL: ${message}`);
  process.exitCode = 1;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function redact(text) {
  return String(text)
    .replace(/postgres(?:ql)?:\/\/[^\s)'"]+/gi, '[database URL redacted]')
    .replace(/redis:\/\/[^\s)'"]+/gi, '[redis URL redacted]');
}

function readEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  return parseEnv(fs.readFileSync(file, 'utf8'));
}

function loadConfig() {
  const apiEnv = readEnvFile(path.join(apiDir, '.env'));
  const webEnv = readEnvFile(path.join(webDir, '.env'));
  const databaseUrl = process.env.DATABASE_URL || apiEnv.DATABASE_URL;
  const redisUrl = process.env.REDIS_URL || apiEnv.REDIS_URL || 'redis://127.0.0.1:16379/0';
  const apiHost = process.env.HOST || apiEnv.HOST || '127.0.0.1';
  const apiPort = Number(process.env.PORT || apiEnv.PORT || 7100);
  const webPort = Number(webEnv.PORT || 3100);
  const webOrigin = `http://127.0.0.1:${webPort}`;
  const apiOrigin = `http://${apiHost === '0.0.0.0' ? '127.0.0.1' : apiHost}:${apiPort}`;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is missing from apps/api/.env');
  }

  let db;
  let redis;
  try {
    db = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL is not a valid URL');
  }
  try {
    redis = new URL(redisUrl);
  } catch {
    throw new Error('REDIS_URL is not a valid URL');
  }

  if (!['127.0.0.1', 'localhost'].includes(db.hostname)) {
    throw new Error('Development DATABASE_URL must target loopback');
  }
  if (!['127.0.0.1', 'localhost'].includes(redis.hostname)) {
    throw new Error('Development REDIS_URL must target loopback');
  }

  return {
    databaseUrl,
    databaseName: decodeURIComponent(db.pathname.replace(/^\//, '')),
    dbHost: db.hostname === 'localhost' ? '127.0.0.1' : db.hostname,
    dbPort: Number(db.port || 5432),
    redisUrl,
    redisHost: redis.hostname === 'localhost' ? '127.0.0.1' : redis.hostname,
    redisPort: Number(redis.port || 6379),
    apiHost: apiHost === '0.0.0.0' ? '127.0.0.1' : apiHost,
    apiPort,
    webPort,
    apiOrigin,
    webOrigin,
    apiReadyUrl: `${apiOrigin}/api`,
  };
}

function tcpConnect(host, port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, timeoutMs);
    socket.once('connect', () => {
      clearTimeout(timer);
      socket.end();
      resolve(true);
    });
    socket.once('error', () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

async function checkPostgres(config) {
  const require = createRequire(path.join(apiDir, 'package.json'));
  const { Client } = require('pg');
  const client = new Client({
    connectionString: config.databaseUrl,
    connectionTimeoutMillis: 3000,
  });
  await client.connect();
  try {
    const actual = (await client.query('SELECT current_database() AS name')).rows[0].name;
    if (actual !== config.databaseName) {
      throw new Error(`Connected to ${actual}, expected ${config.databaseName}`);
    }
    return true;
  } finally {
    await client.end().catch(() => {});
  }
}

async function waitForPostgres(config) {
  let lastError = 'unreachable';
  for (let attempt = 1; attempt <= PG_ATTEMPTS; attempt += 1) {
    try {
      await checkPostgres(config);
      log(`PostgreSQL ready (${config.databaseName} @ ${config.dbHost}:${config.dbPort})`);
      return;
    } catch (error) {
      lastError = redact(error.message || String(error));
      if (attempt === 1 || attempt % 5 === 0 || attempt === PG_ATTEMPTS) {
        log(`PostgreSQL wait ${attempt}/${PG_ATTEMPTS}: ${lastError}`);
      }
      await sleep(PG_DELAY_MS);
    }
  }
  throw new Error(
    `PostgreSQL unavailable for ${config.databaseName} at ${config.dbHost}:${config.dbPort} after ${PG_ATTEMPTS}s. Start Laragon/native PostgreSQL manually, then retry. Last error: ${lastError}`,
  );
}

function redisPing(host, port, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    socket.once('connect', () => {
      socket.write('*1\r\n$4\r\nPING\r\n');
    });
    let buffer = '';
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      if (buffer.includes('+PONG')) finish(true);
    });
    socket.once('error', () => finish(false));
    socket.once('close', () => finish(false));
  });
}

async function waitForRedis(config, label = 'Redis') {
  for (let attempt = 1; attempt <= REDIS_ATTEMPTS; attempt += 1) {
    if (await redisPing(config.redisHost, config.redisPort)) {
      log(`${label} PONG @ ${config.redisHost}:${config.redisPort}`);
      return true;
    }
    if (attempt === 1 || attempt % 10 === 0 || attempt === REDIS_ATTEMPTS) {
      log(`${label} wait ${attempt}/${REDIS_ATTEMPTS}`);
    }
    await sleep(REDIS_DELAY_MS);
  }
  return false;
}

function powershellJson(command) {
  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command],
    { encoding: 'utf8', windowsHide: true },
  );
  if (result.status !== 0) {
    return null;
  }
  const text = (result.stdout || '').trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function listenersOnPort(port) {
  if (process.platform !== 'win32') {
    const result = spawnSync('sh', ['-c', `lsof -nP -iTCP:${port} -sTCP:LISTEN -Fp 2>/dev/null | sed 's/^p//'`], {
      encoding: 'utf8',
    });
    const pids = (result.stdout || '')
      .split(/\s+/)
      .map((v) => Number(v))
      .filter((v) => Number.isInteger(v) && v > 0);
    return pids.map((pid) => ({ pid, name: 'unknown', commandLine: '' }));
  }

  // Prefer netstat — Get-NetTCPConnection is often multi-second on Windows.
  const netstat = spawnSync('netstat', ['-ano', '-p', 'tcp'], {
    encoding: 'utf8',
    windowsHide: true,
  });
  const pids = new Set();
  for (const line of (netstat.stdout || '').split(/\r?\n/)) {
    if (!/LISTENING/i.test(line)) continue;
    const parts = line.trim().split(/\s+/);
    if (parts.length < 5) continue;
    const local = parts[1];
    const pid = Number(parts[4]);
    if (!Number.isInteger(pid) || pid <= 0) continue;
    if (local.endsWith(`:${port}`) || local.endsWith(`:${port}]`)) pids.add(pid);
  }
  if (pids.size === 0) return [];

  const pidList = [...pids].join(',');
  const command = `
    $rows = foreach ($processId in @(${pidList})) {
      $p = Get-CimInstance Win32_Process -Filter ("ProcessId = $processId") -ErrorAction SilentlyContinue
      [pscustomobject]@{
        pid = $processId
        name = if ($p) { $p.Name } else { '' }
        commandLine = if ($p) { [string]$p.CommandLine } else { '' }
      }
    }
    if ($rows) { $rows | ConvertTo-Json -Compress -Depth 3 } else { '' }
  `;
  const parsed = powershellJson(command);
  if (!parsed) {
    return [...pids].map((pid) => ({ pid, name: '', commandLine: '' }));
  }
  return (Array.isArray(parsed) ? parsed : [parsed]).map((row) => ({
    pid: Number(row.pid),
    name: String(row.name || ''),
    commandLine: String(row.commandLine || ''),
  }));
}

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/').toLowerCase();
}

function isPbnApiProcess(info) {
  const rootNorm = normalizePath(root);
  const line = normalizePath(info.commandLine);
  if (!line.includes(rootNorm)) return false;
  return (
    line.includes('/apps/api/') ||
    line.includes('src/app.js') ||
    line.includes('--title=pbn_forum_a_api') ||
    (line.includes('dotenvx') && line.includes('app.js'))
  );
}

function isPbnWebProcess(info) {
  const rootNorm = normalizePath(root);
  const line = normalizePath(info.commandLine);
  if (!line.includes(rootNorm)) return false;
  return (
    line.includes('/apps/web/') ||
    line.includes('next') ||
    line.includes('--title=pbn_forum_a_web')
  );
}

function isPbnRedisProcess(info, config) {
  const name = info.name.toLowerCase();
  const line = normalizePath(info.commandLine);
  const dataNorm = normalizePath(redisDataDir);
  const port = String(config.redisPort);
  // Helper starts redis with --dir . after Push-Location into .local/redis, so
  // the absolute data path may be absent from the command line.
  if (name.includes('redis') && (line.includes(`--port ${port}`) || line.includes(`:${port}`) || line.includes(port))) {
    return true;
  }
  if (line.includes(dataNorm) && line.includes(port)) return true;
  return false;
}

async function inspectPort(port, kind, config) {
  const listening = await tcpConnect('127.0.0.1', port);
  if (!listening) {
    return { listening: false, owners: [], pbnOwned: false };
  }
  const owners = listenersOnPort(port);
  let pbnOwned = false;
  if (kind === 'api') pbnOwned = owners.some(isPbnApiProcess);
  if (kind === 'web') pbnOwned = owners.some(isPbnWebProcess);
  if (kind === 'redis') pbnOwned = owners.some((info) => isPbnRedisProcess(info, config));
  // Healthy Redis PONG on the dedicated PBN port is treated as reusable even if
  // command-line ownership cannot be proven (e.g. started outside this command).
  if (kind === 'redis' && (await redisPing(config.redisHost, config.redisPort))) {
    pbnOwned = true;
  }
  return { listening: true, owners, pbnOwned };
}

async function ensureRedis(config) {
  if (await redisPing(config.redisHost, config.redisPort)) {
    log(`Redis already responding (reusing ${config.redisHost}:${config.redisPort})`);
    owned.redis = false;
    return;
  }

  const portState = await inspectPort(config.redisPort, 'redis', config);
  if (portState.listening) {
    const summary = portState.owners
      .map((o) => `pid=${o.pid} name=${o.name || '?'}`)
      .join(', ') || 'unknown process';
    throw new Error(
      `Port ${config.redisPort} is occupied but Redis did not PONG (${summary}). Refusing to kill unrelated processes.`,
    );
  }

  if (process.platform !== 'win32') {
    throw new Error(
      `Redis is down at ${config.redisHost}:${config.redisPort}. On this OS start it manually (Windows uses scripts/start-pbn-redis.ps1).`,
    );
  }
  if (!fs.existsSync(redisHelper)) {
    throw new Error(`Missing Redis helper: ${redisHelper}`);
  }

  log('Starting PBN Redis via scripts/start-pbn-redis.ps1');
  fs.mkdirSync(redisDataDir, { recursive: true });
  // Windows: Start-Process detaches a console-safe launcher. Node detached spawn
  // of the helper was unreliable (Redis never bound). Ownership is tracked by
  // the dedicated port + .local/redis command line, not the short-lived launcher.
  const launch = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      `Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',${JSON.stringify(redisHelper)}) -WindowStyle Hidden`,
    ],
    { encoding: 'utf8', windowsHide: true },
  );
  if (launch.status !== 0) {
    throw new Error(
      `Failed to launch Redis helper: ${redact((launch.stderr || launch.stdout || '').trim() || `exit ${launch.status}`)}`,
    );
  }
  owned.redis = true;

  const ready = await waitForRedis(config, 'Redis (starting)');
  if (!ready) {
    throw new Error(
      `Redis started but did not PONG within ${(REDIS_ATTEMPTS * REDIS_DELAY_MS) / 1000}s at ${config.redisHost}:${config.redisPort}`,
    );
  }
}

async function fetchOk(url, validate, timeoutMs = 2500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { redirect: 'manual', signal: controller.signal });
    if (!response.ok && response.status >= 500) return false;
    if (validate) {
      const data = await response.json().catch(() => null);
      return Boolean(validate(response, data));
    }
    return response.status > 0 && response.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function isApiReady(config) {
  return fetchOk(config.apiReadyUrl, (response, data) => (
    response.status === 200 && data && data.status === 'ok'
  ));
}

async function isWebReady(config) {
  return fetchOk(config.webOrigin, (response) => response.status > 0 && response.status < 500);
}

function spawnPackageDev(label, cwd) {
  // On Windows, invoke pnpm.cmd via cmd.exe /d /s /c so we avoid shell:true
  // arg-concatenation warnings while keeping PATH resolution for .cmd shims.
  // Windows: force UTF-8 code page for this child console so Vietnamese/Unicode
  // logs are not mojibaked; production logging is unchanged.
  const child = process.platform === 'win32'
    ? spawn('cmd.exe', ['/d', '/s', '/c', 'chcp 65001 >nul & pnpm.cmd run dev'], {
      cwd,
      env: {
        ...process.env,
        PYTHONUTF8: '1',
      },
      stdio: 'inherit',
      windowsHide: true,
    })
    : spawn('pnpm', ['run', 'dev'], {
      cwd,
      env: process.env,
      stdio: 'inherit',
    });
  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    fail(`${label} exited unexpectedly (code=${code}, signal=${signal || 'none'})`);
    shutdown(1);
  });
  return child;
}

async function ensureService(kind, config) {
  const port = kind === 'api' ? config.apiPort : config.webPort;
  const readyFn = kind === 'api' ? isApiReady : isWebReady;
  const isOwned = kind === 'api' ? isPbnApiProcess : isPbnWebProcess;

  if (await readyFn(config)) {
    log(`${kind.toUpperCase()} already ready at port ${port} (reusing)`);
    owned[kind] = false;
    return;
  }

  const portState = await inspectPort(port, kind, config);
  if (portState.listening) {
    const pbn = portState.owners.some(isOwned);
    if (pbn) {
      log(`${kind.toUpperCase()} port ${port} is PBN-owned but not ready yet; waiting`);
      const ok = await waitForService(kind, config);
      if (!ok) {
        throw new Error(`${kind.toUpperCase()} on port ${port} is PBN-owned but never became ready`);
      }
      owned[kind] = false;
      return;
    }
    const summary = portState.owners
      .map((o) => `pid=${o.pid} name=${o.name || '?'}`)
      .join(', ') || 'unknown process';
    throw new Error(
      `${kind.toUpperCase()} port ${port} is occupied by a non-PBN process (${summary}). Refusing to kill it.`,
    );
  }

  log(`Starting ${kind.toUpperCase()} via apps/${kind}/ package script`);
  const cwd = kind === 'api' ? apiDir : webDir;
  children[kind] = spawnPackageDev(kind.toUpperCase(), cwd);
  owned[kind] = true;

  const ok = await waitForService(kind, config);
  if (!ok) {
    throw new Error(`${kind.toUpperCase()} did not become ready on port ${port}`);
  }
}

async function waitForService(kind, config) {
  const readyFn = kind === 'api' ? isApiReady : isWebReady;
  for (let attempt = 1; attempt <= SERVICE_ATTEMPTS; attempt += 1) {
    if (await readyFn(config)) {
      log(`${kind.toUpperCase()} ready`);
      return true;
    }
    if (attempt === 1 || attempt % 10 === 0 || attempt === SERVICE_ATTEMPTS) {
      log(`${kind.toUpperCase()} wait ${attempt}/${SERVICE_ATTEMPTS}`);
    }
    await sleep(SERVICE_DELAY_MS);
  }
  return false;
}

function writeState(config) {
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  const payload = {
    forum: 'forum_a',
    startedAt: new Date().toISOString(),
    owned: { ...owned },
    ports: {
      api: config.apiPort,
      web: config.webPort,
      redis: config.redisPort,
      postgres: config.dbPort,
    },
    pids: {
      api: children.api?.pid || null,
      web: children.web?.pid || null,
    },
  };
  fs.writeFileSync(stateFile, JSON.stringify(payload, null, 2) + '\n');
}

function stopProcessTree(pid) {
  if (!pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    return;
  }
  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // already gone
    }
  }
}

function stopOwnedPortListeners(port, kind, config) {
  const owners = listenersOnPort(port);
  for (const info of owners) {
    const match =
      (kind === 'api' && isPbnApiProcess(info)) ||
      (kind === 'web' && isPbnWebProcess(info)) ||
      (kind === 'redis' && (isPbnRedisProcess(info, config) || info.name.toLowerCase().includes('redis')));
    if (!match) continue;
    log(`Stopping orchestrator-owned ${kind} listener pid=${info.pid}`);
    stopProcessTree(info.pid);
  }
}

function stopOwnedRedis(config) {
  if (!owned.redis) return;
  stopOwnedPortListeners(config.redisPort, 'redis', config);
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  log('Shutting down orchestrator-owned processes (shared PostgreSQL and external Redis are left running)');

  const config = activeConfig;
  if (owned.api) {
    if (children.api?.pid) {
      log(`Stopping orchestrator-owned API tree pid=${children.api.pid}`);
      stopProcessTree(children.api.pid);
    }
    if (config) stopOwnedPortListeners(config.apiPort, 'api', config);
  }
  if (owned.web) {
    if (children.web?.pid) {
      log(`Stopping orchestrator-owned Web tree pid=${children.web.pid}`);
      stopProcessTree(children.web.pid);
    }
    if (config) stopOwnedPortListeners(config.webPort, 'web', config);
  }
  if (config) stopOwnedRedis(config);

  try {
    if (fs.existsSync(stateFile)) fs.unlinkSync(stateFile);
  } catch {
    // ignore
  }
  try {
    if (fs.existsSync(stopFile)) fs.unlinkSync(stopFile);
  } catch {
    // ignore
  }

  // Sync exit so Windows Ctrl+C / SIGINT cannot leave orphans behind.
  process.exit(code);
}

function armStopSignals() {
  const requestStop = () => shutdown(0);
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) {
    try {
      process.on(signal, requestStop);
    } catch {
      // unsupported signal on this platform
    }
  }
  // Windows non-console launches cannot always deliver Ctrl+C; a stop file works.
  fs.mkdirSync(path.dirname(stopFile), { recursive: true });
  try {
    if (fs.existsSync(stopFile)) fs.unlinkSync(stopFile);
  } catch {
    // ignore
  }
  setInterval(() => {
    if (!shuttingDown && fs.existsSync(stopFile)) {
      log('Stop file detected');
      shutdown(0);
    }
  }, 1000).unref?.();
}

async function main() {
  armStopSignals();
  log('PBN Forum A development stack');
  const config = loadConfig();
  activeConfig = config;
  log(`Targets: API ${config.apiOrigin} | Web ${config.webOrigin} | DB ${config.databaseName} | Redis ${config.redisHost}:${config.redisPort}`);

  await waitForPostgres(config);
  await ensureRedis(config);

  await ensureService('api', config);
  await ensureService('web', config);

  // Final readiness gate
  const redisOk = await redisPing(config.redisHost, config.redisPort);
  const apiOk = await isApiReady(config);
  const webOk = await isWebReady(config);
  const pgOk = await checkPostgres(config).then(() => true).catch(() => false);

  if (!pgOk || !redisOk || !apiOk || !webOk) {
    throw new Error(
      `Stack incomplete — postgres=${pgOk} redis=${redisOk} api=${apiOk} web=${webOk}`,
    );
  }

  writeState(config);
  log('READY — Forum A stack is up');
  log(`  PostgreSQL  ${config.databaseName}`);
  log(`  Redis       PONG ${config.redisHost}:${config.redisPort}`);
  log(`  API         ${config.apiReadyUrl}`);
  log(`  Web         ${config.webOrigin}`);
  log('Ctrl+C stops only processes started by this command');
  log(`Or create stop file: ${path.relative(root, stopFile)}`);

  // Stay alive until shutdown. Child exit handlers invoke shutdown themselves.
  await new Promise(() => {});
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    fail(redact(error.message || String(error)));
    shutdown(1);
  });
}
