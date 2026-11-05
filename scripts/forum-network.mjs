/**
 * Parent/Child forum network CLI.
 *
 * Reuses scripts/forum.mjs provision/migrate/seed/admin.
 * Refuses writes to Forum A (pbn_dev) and Forum B (pbn_forum_b).
 * Child runtime does not depend on Parent or OPS.
 *
 * Usage:
 *   node scripts/forum-network.mjs enable-parent forums/forum-p.json
 *   node scripts/forum-network.mjs create-child --config forums/forum-c.json --parent forums/forum-p.json --template default --free-months 2
 *   node scripts/forum-network.mjs export-policy forums/forum-p.json
 *   node scripts/forum-network.mjs apply-policy forums/forum-c.json --package <path>
 *   node scripts/forum-network.mjs export-topic-refs forums/forum-p.json
 *   node scripts/forum-network.mjs health forums/forum-c.json
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  root, api, Client, sha, readJson, writeJson, config, local, runtime, connect,
  configure, createDatabase, migrate, seed, admin, identity,
} from './forum.mjs';

const FORWARD_PATCHES = [
  '0005_forum_credit.sql',
  '0006_forum_pricing.sql',
  '0007_forum_pricing_ops.sql',
  '0008_forum_pricing_hardening.sql',
  '0009_forum_local_pricing.sql',
  '0010_ledger_credit_numeric.sql',
  '0011_bank_payment.sql',
  '0012_forum_network.sql',
];

const PROTECTED_DB = new Set(['pbn_dev', 'pbn_forum_b']);
const PROTECTED_ID = new Set(['forum_a', 'forum_b']);

function assertMutableForum(c) {
  if (PROTECTED_DB.has(c.database) || PROTECTED_ID.has(c.id)) {
    throw new Error(`Refusing network ops on preserved forum ${c.id}/${c.database}`);
  }
}

function templatesDir() {
  return path.join(root, 'forums/templates');
}

function loadTemplate(id) {
  const file = path.join(templatesDir(), `${id}.json`);
  if (!fs.existsSync(file)) throw new Error(`Template not found: ${id}`);
  return readJson(file);
}

function reportDir(c) {
  const dir = path.join(local(c), 'network-reports');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function ensureForwardMeta(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS pbn_meta.forward_patches (
      name text PRIMARY KEY,
      sha256 text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function applyForwardPatches(c) {
  assertMutableForum(c);
  const dir = path.join(api, 'baseline');
  const client = await connect(c);
  const applied = [];
  try {
    // Baseline manifest v7+ already includes 0005–0012; do not double-apply.
    const latest = (await client.query(
      'SELECT coalesce(max(version),0)::int AS v FROM pbn_meta.schema_versions',
    )).rows[0]?.v || 0;
    if (latest >= 7) {
      console.log(`Baseline v${latest} already includes commercial/network schema; skipping forward patches`);
      return [];
    }
    await ensureForwardMeta(client);
    for (const name of FORWARD_PATCHES) {
      const file = path.join(dir, name);
      if (!fs.existsSync(file)) throw new Error(`Missing baseline patch: ${name}`);
      const body = fs.readFileSync(file, 'utf8');
      const digest = sha(body);
      const row = (await client.query('SELECT sha256 FROM pbn_meta.forward_patches WHERE name=$1', [name])).rows[0];
      if (row) {
        if (row.sha256 !== digest) throw new Error(`Forward patch checksum mismatch: ${name}`);
        console.log(`Forward patch already applied: ${name}`);
        continue;
      }
      await client.query('BEGIN');
      try {
        // Whole-file apply (files may contain multiple statements without breakpoints).
        await client.query(body);
        await client.query(
          'INSERT INTO pbn_meta.forward_patches(name, sha256) VALUES($1,$2)',
          [name, digest],
        );
        await client.query('COMMIT');
        applied.push(name);
        console.log(`Forward patch applied: ${name}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Forward patch failed (${name}): ${err.message}`);
      }
    }
  } finally {
    await client.end();
  }
  return applied;
}

async function setNetworkSetting(c, key, value) {
  const client = await connect(c);
  try {
    await client.query(
      `INSERT INTO forum_network_settings(key, value, updated_at)
       VALUES($1, $2::jsonb, now())
       ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=now()`,
      [key, JSON.stringify(value)],
    );
  } finally {
    await client.end();
  }
}

async function getNetworkSetting(c, key) {
  const client = await connect(c);
  try {
    const row = (await client.query('SELECT value FROM forum_network_settings WHERE key=$1', [key])).rows[0];
    return row?.value ?? null;
  } finally {
    await client.end();
  }
}

async function enableParent(c) {
  assertMutableForum(c);
  await applyForwardPatches(c);
  await setNetworkSetting(c, 'role', { role: 'parent' });
  await setNetworkSetting(c, 'parent_enabled_at', { at: new Date().toISOString() });
  const template = loadTemplate('default');
  const client = await connect(c);
  try {
    await client.query(
      `INSERT INTO forum_network_templates(id, name, description, payload, created_at, updated_at)
       VALUES($1,$2,$3,$4::jsonb,now(),now())
       ON CONFLICT(id) DO UPDATE SET name=excluded.name, description=excluded.description,
         payload=excluded.payload, updated_at=now()`,
      [template.id, template.name, template.description || null, JSON.stringify(template)],
    );
  } finally {
    await client.end();
  }
  console.log(`Parent role enabled on ${c.id}`);
  return { forumId: c.id, role: 'parent' };
}

function policyChecksum(pkg) {
  return sha(JSON.stringify({
    schema: pkg.schema,
    version: pkg.version,
    managed: pkg.managed,
  }));
}

async function exportPolicy(c, { notes, out } = {}) {
  assertMutableForum(c);
  const template = loadTemplate('default');
  const version = `${new Date().toISOString()}#${c.id}`;
  const pkg = {
    schema: 'forum-network-policy/1',
    version,
    parentForumId: c.id,
    notes: notes || 'Exported managed policy from Parent',
    managed: template.managed,
    createdAt: new Date().toISOString(),
  };
  pkg.checksum = policyChecksum(pkg);

  const client = await connect(c);
  try {
    await client.query(
      `INSERT INTO forum_network_policy_versions(version, checksum, payload, notes, created_at)
       VALUES($1,$2,$3::jsonb,$4,now())
       ON CONFLICT(version) DO NOTHING`,
      [pkg.version, pkg.checksum, JSON.stringify(pkg), pkg.notes],
    );
  } finally {
    await client.end();
  }

  const outPath = out || path.join(reportDir(c), `policy-${pkg.version.replace(/[:#]/g, '-')}.json`);
  writeJson(outPath, pkg);
  console.log(`Policy exported: ${outPath}`);
  return { package: pkg, path: outPath };
}

async function applyPolicy(c, packagePath) {
  assertMutableForum(c);
  const pkg = readJson(packagePath);
  if (pkg.schema !== 'forum-network-policy/1') throw new Error('Invalid policy schema');
  if (policyChecksum(pkg) !== pkg.checksum) throw new Error('Policy checksum mismatch');

  const client = await connect(c);
  try {
    const existing = (await client.query(
      `SELECT status FROM forum_network_policy_applications
       WHERE policy_version=$1 AND status IN ('applied','skipped_duplicate') LIMIT 1`,
      [pkg.version],
    )).rows[0];
    if (existing) {
      // Anti-duplicate: do not insert another unique version row; audit via return value + log.
      console.log(`Policy already applied (duplicate skipped): ${pkg.version}`);
      return {
        status: 'skipped_duplicate',
        version: pkg.version,
        previousStatus: existing.status,
      };
    }

    const appliedKeys = [];
    const skippedKeys = [];
    await client.query('BEGIN');
    try {
      for (const [key, value] of Object.entries(pkg.managed || {})) {
        // Managed keys only — never local/template secrets.
        const localBlocked = [
          'free_mode', 'vnd_per_credit', 'site_url', 'users', 'topics', 'posts',
          'sys_accounts', 'sys_transactions', 'sessions', 'admin_credentials',
        ];
        if (localBlocked.includes(key) || key.startsWith('service_prices') || key.endsWith('_seed')) {
          skippedKeys.push(key);
          continue;
        }
        await client.query(
          `INSERT INTO system_settings(key, value, value_type)
           VALUES($1,$2,'string')
           ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
          [key, typeof value === 'string' ? value : JSON.stringify(value)],
        );
        await client.query(
          `INSERT INTO forum_network_settings(key, value, updated_at)
           VALUES($1,$2::jsonb,now())
           ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=now()`,
          [`managed:${key}`, JSON.stringify(value)],
        );
        appliedKeys.push(key);
      }
      await client.query(
        `INSERT INTO forum_network_policy_applications
         (id, policy_version, checksum, source, status, applied_keys, skipped_keys, applied_at)
         VALUES($1,$2,$3,'cli','applied',$4::jsonb,$5::jsonb,now())`,
        [crypto.randomUUID(), pkg.version, pkg.checksum, JSON.stringify(appliedKeys), JSON.stringify(skippedKeys)],
      );
      await client.query(
        `INSERT INTO forum_network_settings(key, value, updated_at)
         VALUES('last_managed_policy', $1::jsonb, now())
         ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=now()`,
        [JSON.stringify({
          version: pkg.version,
          checksum: pkg.checksum,
          appliedAt: new Date().toISOString(),
          appliedKeys,
        })],
      );
      await client.query('COMMIT');
      console.log(`Policy applied: ${pkg.version} (${appliedKeys.length} keys)`);
      return { status: 'applied', version: pkg.version, appliedKeys, skippedKeys };
    } catch (err) {
      await client.query('ROLLBACK');
      await client.query(
        `INSERT INTO forum_network_policy_applications
         (id, policy_version, checksum, source, status, applied_keys, skipped_keys, error_message, applied_at)
         VALUES($1,$2,$3,'cli','failed','[]'::jsonb,'[]'::jsonb,$4,now())`,
        [crypto.randomUUID(), pkg.version, pkg.checksum, String(err.message).slice(0, 1000)],
      );
      throw err;
    }
  } finally {
    await client.end();
  }
}

async function exportTopicRefs(c, { out } = {}) {
  assertMutableForum(c);
  const template = loadTemplate('default');
  const items = (template.topicReferences || []).map((t) => {
    const titleNormalized = String(t.title || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
    return {
      sourceTopicKey: null,
      titleNormalized,
      titleHash: sha(titleNormalized),
      categoryHint: t.categoryHint || null,
      meta: { titlePreview: String(t.title || '').slice(0, 120) },
    };
  });
  // Optionally enrich from Parent topics (titles only — no users/comments/wallets).
  const client = await connect(c);
  try {
    const topics = (await client.query(
      `SELECT id::text AS id, title, c.slug AS category
       FROM topics t
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.is_deleted = false
       ORDER BY t.id ASC
       LIMIT 200`,
    )).rows;
    for (const row of topics) {
      const titleNormalized = String(row.title || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
      if (!titleNormalized) continue;
      items.push({
        sourceTopicKey: row.id,
        titleNormalized,
        titleHash: sha(titleNormalized),
        categoryHint: row.category || null,
        meta: { titlePreview: String(row.title || '').slice(0, 120) },
      });
    }
  } catch {
    // Parent may have no topics yet — template refs still exported.
  } finally {
    await client.end();
  }

  const dedup = new Map();
  for (const item of items) dedup.set(`${c.id}:${item.titleHash}`, item);
  const payload = {
    schema: 'forum-network-topic-refs/1',
    version: `${new Date().toISOString()}#refs`,
    sourceForumId: c.id,
    items: [...dedup.values()],
    createdAt: new Date().toISOString(),
  };
  payload.checksum = sha(JSON.stringify(payload));
  const outPath = out || path.join(reportDir(c), `topic-refs-${Date.now()}.json`);
  writeJson(outPath, payload);
  console.log(`Topic refs exported: ${outPath} (${payload.items.length} items)`);
  return { path: outPath, package: payload };
}

async function importTopicRefs(c, packagePath) {
  assertMutableForum(c);
  const pkg = readJson(packagePath);
  if (pkg.schema !== 'forum-network-topic-refs/1') throw new Error('Invalid topic ref schema');
  const client = await connect(c);
  let imported = 0;
  let skipped = 0;
  try {
    for (const item of pkg.items || []) {
      const result = await client.query(
        `INSERT INTO forum_topic_reference_snapshots
         (id, source_forum_id, source_topic_key, title_normalized, title_hash, category_hint, package_version, meta, captured_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,now())
         ON CONFLICT (source_forum_id, title_hash) DO NOTHING`,
        [
          crypto.randomUUID(),
          pkg.sourceForumId,
          item.sourceTopicKey,
          item.titleNormalized,
          item.titleHash,
          item.categoryHint || null,
          pkg.version,
          JSON.stringify(item.meta || {}),
        ],
      );
      if (result.rowCount) imported += 1;
      else skipped += 1;
    }
    await client.query(
      `INSERT INTO forum_network_settings(key, value, updated_at)
       VALUES('topic_refs_imported', $1::jsonb, now())
       ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=now()`,
      [JSON.stringify({
        version: pkg.version,
        sourceForumId: pkg.sourceForumId,
        imported,
        skipped,
        at: new Date().toISOString(),
        publicExposure: false,
      })],
    );
  } finally {
    await client.end();
  }
  console.log(`Topic refs imported: ${imported} (skipped ${skipped})`);
  return { imported, skipped };
}

async function applyTemplateCommercial(c, template, freeMonths) {
  const client = await connect(c);
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + Number(freeMonths || 2));
  try {
    const prices = template.template?.service_prices_seed || {};
    for (const [code, vnd] of Object.entries(prices)) {
      await client.query(
        `INSERT INTO forum_local_services(service_code, enabled, base_price_vnd, local_price_version, options, updated_at)
         VALUES($1,true,$2,1,'{}'::jsonb,now())
         ON CONFLICT(service_code) DO UPDATE SET base_price_vnd=excluded.base_price_vnd, updated_at=now()`,
        [code, Number(vnd)],
      );
    }
    const vndPerCredit = template.template?.credit_seed?.vndPerCredit || 10000;
    await client.query(
      `INSERT INTO forum_commercial_settings(key, value, updated_at)
       VALUES('vnd_per_credit', $1::jsonb, now())
       ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=now()`,
      [JSON.stringify({ value: vndPerCredit })],
    );
    const freeEnabled = template.template?.free_mode_initial?.enabled !== false;
    await client.query(
      `INSERT INTO forum_commercial_settings(key, value, updated_at)
       VALUES('free_mode', $1::jsonb, now())
       ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=now()`,
      [JSON.stringify({ enabled: freeEnabled, expiresAt: expiresAt.toISOString() })],
    );
    if (template.template?.credit_seed?.activateCredits) {
      await client.query(`UPDATE sys_currencies SET is_active=true WHERE code='credits'`);
    }
  } finally {
    await client.end();
  }
  return { freeModeExpiresAt: expiresAt.toISOString() };
}

async function registerChildOnParent(parent, child, meta) {
  const client = await connect(parent);
  try {
    await client.query(
      `INSERT INTO forum_network_children
       (child_forum_id, display_name, database_name, api_origin, web_origin, status, template_id, free_mode_expires_at, meta, created_at, updated_at)
       VALUES($1,$2,$3,$4,$5,'active',$6,$7::timestamptz,$8::jsonb,now(),now())
       ON CONFLICT(child_forum_id) DO UPDATE SET
         display_name=excluded.display_name,
         database_name=excluded.database_name,
         api_origin=excluded.api_origin,
         web_origin=excluded.web_origin,
         status='active',
         template_id=excluded.template_id,
         free_mode_expires_at=excluded.free_mode_expires_at,
         meta=excluded.meta,
         updated_at=now()`,
      [
        child.id,
        child.name,
        child.database,
        `http://127.0.0.1:${child.apiPort}`,
        `http://127.0.0.1:${child.webPort}`,
        meta.templateId,
        meta.freeModeExpiresAt,
        JSON.stringify({ provisionedAt: new Date().toISOString(), runtimeDependency: false }),
      ],
    );
  } finally {
    await client.end();
  }
}

async function healthCheck(c) {
  assertMutableForum(c);
  const client = await connect(c);
  try {
    const dbName = (await client.query('SELECT current_database() AS name')).rows[0].name;
    const users = (await client.query('SELECT count(*)::int AS n FROM users')).rows[0].n;
    const role = (await client.query(`SELECT value->>'role' AS role FROM forum_network_settings WHERE key='role'`)).rows[0]?.role || 'none';
    const free = (await client.query(`SELECT value FROM forum_commercial_settings WHERE key='free_mode'`)).rows[0]?.value || null;
    const refs = (await client.query('SELECT count(*)::int AS n FROM forum_topic_reference_snapshots')).rows[0].n;
    const services = (await client.query('SELECT count(*)::int AS n FROM forum_local_services')).rows[0].n;
    const creditsActive = (await client.query(`SELECT is_active FROM sys_currencies WHERE code='credits'`)).rows[0]?.is_active === true;
    const ok = dbName === c.database && users >= 1 && services >= 1 && ['parent', 'child'].includes(role);
    return {
      ok,
      forumId: c.id,
      database: dbName,
      users,
      networkRole: role,
      freeMode: free,
      topicReferences: refs,
      localServices: services,
      creditsActive,
      parentRuntimeRequired: false,
      opsRequired: false,
    };
  } finally {
    await client.end();
  }
}

/** Destroy only known non-production fixture DBs. Never touches A/B. */
async function destroyFixture(c) {
  assertMutableForum(c);
  const allowed = {
    forum_p: 'pbn_forum_p',
    forum_c: 'pbn_forum_c',
    forum_v7: 'pbn_forum_v7',
    forum_v7c: 'pbn_forum_v7c',
    forum_v7_probe: 'pbn_baseline_v7_probe',
    forum_v7_verify: 'pbn_forum_v7_verify',
  };
  if (allowed[c.id] !== c.database) {
    throw new Error(`destroy-fixture not allowed for ${c.id}/${c.database}`);
  }
  // Stop managed processes if any.
  try {
    const { stop } = await import('./forum.mjs');
    stop(c);
  } catch { /* not running */ }

  const secretsPath = path.join(local(c), 'secrets.json');
  if (!fs.existsSync(secretsPath)) {
    // Configure temporarily to learn connection template, then drop.
    await configure(c);
  }
  const url = new URL(runtime(c).DATABASE_URL);
  url.pathname = '/postgres';
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  try {
    await client.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = $1 AND pid <> pg_backend_pid()
    `, [c.database]);
    await client.query(`DROP DATABASE IF EXISTS "${c.database}"`);
    console.log(`Dropped fixture database ${c.database}`);
  } finally {
    await client.end();
  }
  // Clear local secrets/admin so provision can recreate.
  const dir = local(c);
  for (const name of ['secrets.json', 'admin.json', 'processes.json']) {
    const file = path.join(dir, name);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
  return { dropped: c.database };
}

/**
 * Create Child forum wizard.
 * Safety: never DROP DATABASE; refuse A/B; refuse overwrite of existing DB.
 */
async function createChild({ configPath, parentPath, templateId = 'default', freeMonths = 2 }) {
  const child = config(configPath);
  const parent = config(parentPath);
  assertMutableForum(child);
  assertMutableForum(parent);
  if (child.id === parent.id || child.database === parent.database) {
    throw new Error('Child must be distinct from Parent');
  }
  if (![1, 2, 3].includes(Number(freeMonths))) {
    throw new Error('free-months must be 1, 2, or 3');
  }

  const steps = [];
  const mark = (step, status, detail = {}) => {
    steps.push({ step, status, at: new Date().toISOString(), ...detail });
    console.log(`[${status}] ${step}`);
  };

  const template = loadTemplate(templateId);
  let dbCreated = false;

  try {
    // 1. Validate
    mark('validate', 'ok', { child: child.id, parent: parent.id, template: templateId, freeMonths });

    // 2. Ensure parent is ready
    await enableParent(parent);
    mark('parent_ready', 'ok');

    // 3. Configure secrets (no DB yet)
    await configure(child);
    mark('configure', 'ok');

    // 4. Create empty DB (refuses if exists)
    await createDatabase(child);
    dbCreated = true;
    mark('create_db', 'ok', { database: child.database });

    // 5. Baseline migrate (v1–v6)
    await migrate(child);
    mark('migrate_baseline', 'ok');

    // 6. Forward commercial + network patches
    const patches = await applyForwardPatches(child);
    mark('migrate_forward', 'ok', { patches });

    // 7. Seed + identity + admin (no parent user copy)
    await seed(child);
    mark('seed', 'ok');
    await admin(child);
    mark('admin', 'ok');

    // 8. Apply template commercial + free mode window
    const commercial = await applyTemplateCommercial(child, template, freeMonths);
    mark('apply_template', 'ok', commercial);

    // 9. Managed policy from template (versioned)
    const policyPath = path.join(reportDir(parent), `init-policy-${child.id}.json`);
    const policyPkg = {
      schema: 'forum-network-policy/1',
      version: `${new Date().toISOString()}#init-${child.id}`,
      parentForumId: parent.id,
      notes: `Init managed policy for ${child.id}`,
      managed: template.managed,
      createdAt: new Date().toISOString(),
    };
    policyPkg.checksum = policyChecksum(policyPkg);
    writeJson(policyPath, policyPkg);
    const policyResult = await applyPolicy(child, policyPath);
    mark('apply_managed_policy', 'ok', policyResult);

    // 10. Topic reference snapshot (init only)
    const refs = await exportTopicRefs(parent);
    const refImport = await importTopicRefs(child, refs.path);
    mark('topic_refs', 'ok', refImport);

    // 11. Enable child role + parent registry (metadata only)
    await setNetworkSetting(child, 'role', { role: 'child' });
    await setNetworkSetting(child, 'parent_link', {
      parentForumId: parent.id,
      parentOrigin: `http://127.0.0.1:${parent.apiPort}`,
      linkedAt: new Date().toISOString(),
      runtimeDependency: false,
    });
    await registerChildOnParent(parent, child, {
      templateId,
      freeModeExpiresAt: commercial.freeModeExpiresAt,
    });
    mark('link_parent_child', 'ok');

    // 12. Health
    const health = await healthCheck(child);
    mark('health', health.ok ? 'ok' : 'fail', health);
    if (!health.ok) throw new Error('Child health check failed');

    const report = {
      ok: true,
      child: { id: child.id, database: child.database, webPort: child.webPort, apiPort: child.apiPort },
      parent: { id: parent.id, database: parent.database },
      templateId,
      freeMonths: Number(freeMonths),
      freeModeExpiresAt: commercial.freeModeExpiresAt,
      steps,
      notes: [
        'Child is fully independent: no Parent/OPS runtime dependency.',
        'No users, wallets, sessions, or secrets were copied from Parent.',
        'Topic references are fingerprints only — not public Child topics.',
        dbCreated ? 'Database was created empty; on failure DB is left for operator review (never auto-dropped).' : null,
      ].filter(Boolean),
    };
    const reportPath = path.join(reportDir(child), `create-child-${Date.now()}.json`);
    writeJson(reportPath, report);
    console.log(`Create-child report: ${reportPath}`);
    return report;
  } catch (err) {
    const report = {
      ok: false,
      error: String(err.message || err),
      child: { id: child.id, database: child.database },
      parent: { id: parent.id, database: parent.database },
      steps,
      recovery: [
        'No DROP DATABASE was attempted.',
        dbCreated
          ? `Database ${child.database} may be partial — inspect then DROP manually only if intentional.`
          : 'No database was created.',
        'Re-run create-child only after removing a failed empty/partial DB if create_db succeeded.',
        'Forum A/B were not modified.',
      ],
    };
    try {
      writeJson(path.join(reportDir(child), `create-child-failed-${Date.now()}.json`), report);
    } catch { /* ignore */ }
    throw Object.assign(err, { report });
  }
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const flags = {};
  const positional = [];
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = rest[i + 1];
      if (!next || next.startsWith('--')) flags[key] = true;
      else {
        flags[key] = next;
        i += 1;
      }
    } else positional.push(token);
  }
  return { command, positional, flags };
}

async function main() {
  const { command, positional, flags } = parseArgs(process.argv.slice(2));
  if (!command) {
    throw new Error('Usage: node scripts/forum-network.mjs <enable-parent|create-child|export-policy|apply-policy|export-topic-refs|apply-topic-refs|health|apply-forward> ...');
  }

  if (command === 'create-child') {
    if (!flags.config || !flags.parent) throw new Error('create-child requires --config and --parent');
    return createChild({
      configPath: flags.config,
      parentPath: flags.parent,
      templateId: flags.template || 'default',
      freeMonths: Number(flags['free-months'] || 2),
    });
  }

  const file = positional[0];
  if (!file) throw new Error(`${command} requires <forum-config.json>`);
  const c = config(file);

  if (command === 'enable-parent') return enableParent(c);
  if (command === 'apply-forward') return applyForwardPatches(c);
  if (command === 'export-policy') return exportPolicy(c, { out: flags.out, notes: flags.notes });
  if (command === 'apply-policy') {
    if (!flags.package) throw new Error('apply-policy requires --package');
    return applyPolicy(c, flags.package);
  }
  if (command === 'export-topic-refs') return exportTopicRefs(c, { out: flags.out });
  if (command === 'apply-topic-refs') {
    if (!flags.package) throw new Error('apply-topic-refs requires --package');
    return importTopicRefs(c, flags.package);
  }
  if (command === 'health') {
    const result = await healthCheck(c);
    console.log(JSON.stringify(result, null, 2));
    return result;
  }
  if (command === 'destroy-fixture') return destroyFixture(c);
  throw new Error(`Unknown command: ${command}`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((e) => {
    console.error(String(e.message || e).replace(/postgres(?:ql)?:\/\/[^\s]+/g, '[database URL redacted]'));
    process.exitCode = 1;
  });
}

export {
  createChild,
  enableParent,
  applyForwardPatches,
  exportPolicy,
  applyPolicy,
  exportTopicRefs,
  importTopicRefs,
  healthCheck,
  destroyFixture,
  assertMutableForum,
  FORWARD_PATCHES,
};
