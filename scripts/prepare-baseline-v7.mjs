/**
 * Prepare baseline manifest v7 (0005–0012) safely.
 * - Uses isolated probe DB only (never A/B).
 * - Validates apply + idempotent re-apply + catalog fingerprint.
 * - Writes catalog-v7.json + appends manifest v7 only on success.
 * - Reverts manifest/catalog if end-to-end migrate on a second empty DB fails.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  root, api, Client, sha, readJson, writeJson, config, local, runtime, connect,
  configure, createDatabase, migrate,
} from './forum.mjs';
import { publicCatalog } from './forum-catalog.mjs';

const PROTECTED_DB = new Set(['pbn_dev', 'pbn_forum_b']);
const V7_FILES = [
  '0005_forum_credit.sql',
  '0006_forum_pricing.sql',
  '0007_forum_pricing_ops.sql',
  '0008_forum_pricing_hardening.sql',
  '0009_forum_local_pricing.sql',
  '0010_ledger_credit_numeric.sql',
  '0011_bank_payment.sql',
  '0012_forum_network.sql',
];

const REQUIRED_TABLES = [
  'sys_accounts', 'sys_transactions', 'sys_currencies',
  'forum_local_services', 'forum_commercial_settings', 'forum_credit_vnd_rate_history',
  'ops_forum_connections', 'ops_forum_pricing_snapshots',
  'pbn_topup_packages', 'pbn_payment_orders',
  'forum_network_settings', 'forum_topic_reference_snapshots',
  'pin_entitlements',
];

function baselineDir() {
  return path.join(api, 'baseline');
}

function buildV7Record() {
  const dir = baselineDir();
  return {
    version: 7,
    files: V7_FILES.map((file) => ({
      file,
      sha256: sha(fs.readFileSync(path.join(dir, file))),
    })),
  };
}

async function dropFixtureDb(database) {
  const allowed = new Set(['pbn_baseline_v7_probe', 'pbn_forum_v7', 'pbn_forum_v7_verify']);
  if (PROTECTED_DB.has(database) || !allowed.has(database)) {
    throw new Error(`Refusing to drop unexpected/protected database: ${database}`);
  }
  const legacy = fs.existsSync(path.join(api, '.env'))
    ? Object.fromEntries(
      fs.readFileSync(path.join(api, '.env'), 'utf8').split(/\r?\n/)
        .filter((l) => l && !l.startsWith('#') && l.includes('='))
        .map((l) => {
          const i = l.indexOf('=');
          return [l.slice(0, i), l.slice(i + 1)];
        }),
    )
    : {};
  const source = process.env.PBN_DATABASE_URL || legacy.DATABASE_URL;
  if (!source) throw new Error('Set PBN_DATABASE_URL or apps/api/.env DATABASE_URL');
  const url = new URL(source);
  url.pathname = '/postgres';
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  try {
    await client.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()`, [database]);
    await client.query(`DROP DATABASE IF EXISTS "${database}"`);
    console.log(`Dropped ${database}`);
  } finally {
    await client.end();
  }
}

async function applySqlFiles(client, files) {
  const dir = baselineDir();
  for (const file of files) {
    const body = fs.readFileSync(path.join(dir, file), 'utf8');
    for (const statement of body.split('--> statement-breakpoint')) {
      if (statement.trim()) await client.query(statement);
    }
    console.log(`Applied ${file}`);
  }
}

async function assertRequiredTables(client) {
  const missing = [];
  for (const name of REQUIRED_TABLES) {
    const row = (await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`,
      [name],
    )).rows[0];
    if (!row) missing.push(name);
  }
  if (missing.length) throw new Error(`Missing tables after v7: ${missing.join(', ')}`);
}

async function assertPinFreeModeConstraint(client) {
  const def = (await client.query(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname='pin_entitlements_valid'`,
  )).rows[0]?.def || '';
  if (!/price\s*>=\s*0/i.test(def) && !/price>=0/i.test(def.replace(/\s+/g, ''))) {
    throw new Error(`pin_entitlements_valid does not allow Free Mode price>=0: ${def}`);
  }
  if (!/transaction_id/i.test(def)) {
    throw new Error('pin_entitlements_valid missing transaction_id free-mode branch');
  }
}

async function probeApply() {
  const probeConfigPath = path.join(root, 'forums/forum-v7-probe.json');
  writeJson(probeConfigPath, {
    id: 'forum_v7_probe',
    database: 'pbn_baseline_v7_probe',
    webPort: 3600,
    apiPort: 7600,
    hostname: '127.0.0.1',
    name: 'Baseline V7 Probe',
    locale: 'en-US',
    primaryColor: '#115e59',
    logo: '/logo.svg',
    description: 'Temporary probe for baseline v7; not a product forum',
    status: 'active',
  });
  const c = config(probeConfigPath);
  await dropFixtureDb(c.database);
  // Clear secrets so configure recreates
  const secrets = path.join(local(c), 'secrets.json');
  if (fs.existsSync(secrets)) fs.unlinkSync(secrets);
  const admin = path.join(local(c), 'admin.json');
  if (fs.existsSync(admin)) fs.unlinkSync(admin);

  await configure(c);
  await createDatabase(c);
  await migrate(c); // current manifest v1–v6 only

  const client = await connect(c);
  try {
    console.log('--- First apply 0005–0012 ---');
    await client.query('BEGIN');
    await applySqlFiles(client, V7_FILES);
    await assertRequiredTables(client);
    await assertPinFreeModeConstraint(client);
    await client.query('COMMIT');

    console.log('--- Idempotent re-apply 0005–0012 ---');
    await client.query('BEGIN');
    await applySqlFiles(client, V7_FILES);
    await assertRequiredTables(client);
    await client.query('COMMIT');

    const catalog = await publicCatalog(client);
    return { c, catalog, v7: buildV7Record() };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw err;
  } finally {
    await client.end();
  }
}

async function writeManifestAndCatalog(v7, catalog) {
  const dir = baselineDir();
  const manifestPath = path.join(dir, 'manifest.json');
  const catalogPath = path.join(dir, 'catalog-v7.json');
  const backupManifest = path.join(dir, 'manifest.json.bak-pre-v7');
  const document = readJson(manifestPath);
  if (!document.migrations) throw new Error('manifest missing migrations[]');
  if (document.migrations.some((m) => m.version === 7)) {
    throw new Error('manifest already contains version 7');
  }
  if (document.migrations.at(-1)?.version !== 6) {
    throw new Error(`Expected last migration v6, found ${document.migrations.at(-1)?.version}`);
  }

  fs.copyFileSync(manifestPath, backupManifest);
  writeJson(catalogPath, catalog);
  document.migrations.push(v7);
  writeJson(manifestPath, document);
  console.log(`Wrote ${catalogPath}`);
  console.log(`Appended v7 to ${manifestPath} (backup: ${backupManifest})`);
  console.log(`v7 migration checksum: ${sha(JSON.stringify(v7))}`);
  return { manifestPath, catalogPath, backupManifest };
}

async function verifyFreshMigrate() {
  const file = path.join(root, 'forums/forum-v7-verify.json');
  writeJson(file, {
    id: 'forum_v7_verify',
    database: 'pbn_forum_v7_verify',
    webPort: 3601,
    apiPort: 7601,
    hostname: '127.0.0.1',
    name: 'Baseline V7 Verify',
    locale: 'en-US',
    primaryColor: '#134e4a',
    logo: '/logo.svg',
    description: 'Empty-DB migrate verification for manifest v7',
    status: 'active',
  });
  const c = config(file);
  await dropFixtureDb(c.database);
  const secrets = path.join(local(c), 'secrets.json');
  if (fs.existsSync(secrets)) fs.unlinkSync(secrets);
  await configure(c);
  await createDatabase(c);
  await migrate(c); // must apply v1–v7 and match catalog-v7
  // no-op rerun
  await migrate(c);
  const client = await connect(c);
  try {
    const versions = (await client.query('SELECT version FROM pbn_meta.schema_versions ORDER BY version')).rows.map((r) => r.version);
    if (JSON.stringify(versions) !== JSON.stringify([1, 2, 3, 4, 5, 6, 7])) {
      throw new Error(`Unexpected versions: ${versions.join(',')}`);
    }
    await assertRequiredTables(client);
    await assertPinFreeModeConstraint(client);
    const numeric = (await client.query(
      `SELECT data_type FROM information_schema.columns
       WHERE table_name='sys_accounts' AND column_name='balance'`,
    )).rows[0]?.data_type;
    if (numeric !== 'numeric') throw new Error(`sys_accounts.balance expected numeric, got ${numeric}`);
  } finally {
    await client.end();
  }
  return c;
}

async function revert(manifestPath, backupManifest, catalogPath) {
  if (fs.existsSync(backupManifest)) {
    fs.copyFileSync(backupManifest, manifestPath);
    console.error('REVERTED manifest.json from backup');
  }
  if (fs.existsSync(catalogPath)) {
    fs.unlinkSync(catalogPath);
    console.error('Removed catalog-v7.json after failure');
  }
}

async function main() {
  const audit = {
    order: V7_FILES,
    dependencies: [
      '0005: ops credit tables (IF NOT EXISTS) — after users',
      '0006: seo_quotes/purchases columns — needs seo_* from v5 (0003_big_emma_frost)',
      '0007: ops pricing snapshots + seo_purchases columns — after 0006',
      '0008: pin_entitlements OPS columns/constraint — needs pin_entitlements from v3',
      '0009: local pricing + Free Mode pin constraint — replaces 0008 pin constraint',
      '0010: ledger numeric + rate history — needs sys_accounts from v1',
      '0011: bank payment packages/orders — needs users + numeric credits',
      '0012: forum-network Parent/Child — needs users',
    ],
    idempotencyNotes: [
      'CREATE TABLE/INDEX IF NOT EXISTS throughout 0005/0007/0009/0011/0012',
      '0006/0008/0009 constraints use DROP IF EXISTS before ADD',
      'Seed INSERTs use ON CONFLICT DO NOTHING / NOT EXISTS',
      '0010 ALTER TYPE numeric is stable when re-run on numeric columns',
    ],
  };
  console.log(JSON.stringify(audit, null, 2));

  let written = null;
  try {
    const { catalog, v7 } = await probeApply();
    written = await writeManifestAndCatalog(v7, catalog);
    await verifyFreshMigrate();
    console.log('BASELINE_V7_READY');
    writeJson(path.join(root, 'docs/audit/PBN-BASELINE-V7-PREPARE.json'), {
      ok: true,
      v7,
      v7Checksum: sha(JSON.stringify(v7)),
      catalog,
      audit,
    });
  } catch (err) {
    console.error('BASELINE_V7_FAILED:', err.message);
    if (written) await revert(written.manifestPath, written.backupManifest, written.catalogPath);
    writeJson(path.join(root, 'docs/audit/PBN-BASELINE-V7-PREPARE.json'), {
      ok: false,
      error: String(err.message || err),
      audit,
    });
    process.exitCode = 1;
  }
}

main();
