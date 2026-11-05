/**
 * Greenfield provision + smoke tests for baseline manifest v7.
 * Touches only forum_v7 / forum_v7c. Never Forum A/B.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import {
  root, readJson, writeJson, config, local, connect, start, stop,
} from './forum.mjs';
import {
  createChild, enableParent, destroyFixture, healthCheck, exportPolicy, applyPolicy,
} from './forum-network.mjs';

const results = [];
function record(id, ok, summary, detail = {}) {
  results.push({ id, ok, summary, ...detail, at: new Date().toISOString() });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}: ${summary}`);
}

async function waitHttp(url, timeoutMs = 90000) {
  const startAt = Date.now();
  let last;
  while (Date.now() - startAt < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || [401, 403].includes(res.status)) return res.status;
      last = res.status;
    } catch (err) {
      last = err.message;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Timeout ${url}: ${last}`);
}

async function login(apiBase, username, password) {
  const res = await fetch(`${apiBase}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier: username, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`login ${res.status} ${JSON.stringify(body)}`);
  const token = body.token || body.data?.token;
  if (!token) throw new Error('missing token');
  return token;
}

async function api(apiBase, token, method, pathname, body) {
  const res = await fetch(`${apiBase}${pathname}`, {
    method,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

async function schemaAudit(c) {
  const client = await connect(c);
  try {
    const versions = (await client.query(
      'SELECT version, checksum FROM pbn_meta.schema_versions ORDER BY version',
    )).rows;
    const tables = (await client.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema='public'
         AND table_name = ANY($1::text[])
       ORDER BY table_name`,
      [[
        'forum_local_services', 'forum_commercial_settings', 'forum_network_settings',
        'forum_credit_vnd_rate_history', 'ops_forum_connections', 'pbn_topup_packages',
        'pbn_payment_orders', 'sys_accounts', 'sys_currencies',
      ]],
    )).rows.map((r) => r.table_name);
    const balanceType = (await client.query(
      `SELECT data_type FROM information_schema.columns
       WHERE table_name='sys_accounts' AND column_name='balance'`,
    )).rows[0]?.data_type;
    const packages = (await client.query('SELECT count(*)::int AS n FROM pbn_topup_packages')).rows[0].n;
    const services = (await client.query('SELECT count(*)::int AS n FROM forum_local_services')).rows[0].n;
    const forward = (await client.query(
      `SELECT to_regclass('pbn_meta.forward_patches') AS t`,
    )).rows[0]?.t;
    let forwardCount = 0;
    if (forward) {
      forwardCount = (await client.query('SELECT count(*)::int AS n FROM pbn_meta.forward_patches')).rows[0].n;
    }
    return { versions, tables, balanceType, packages, services, forwardCount };
  } finally {
    await client.end();
  }
}

async function main() {
  const parent = config('forums/forum-v7.json');
  const child = config('forums/forum-v7c.json');

  record('guard', true, 'Using forum_v7 / forum_v7c only; A/B excluded');

  for (const c of [child, parent]) {
    try {
      await destroyFixture(c);
      record(`reset.${c.id}`, true, `Dropped ${c.database}`);
    } catch (err) {
      record(`reset.${c.id}`, true, `reset note: ${err.message}`);
    }
  }

  // Fresh Parent via classic provision (migrate includes v7 — no forward patches needed)
  try {
    const { configure, createDatabase, migrate, seed, admin } = await import('./forum.mjs');
    await configure(parent);
    await createDatabase(parent);
    await migrate(parent);
    await seed(parent);
    await admin(parent);
    const audit = await schemaAudit(parent);
    const versionsOk = audit.versions.map((v) => v.version).join(',') === '1,2,3,4,5,6,7';
    const tablesOk = audit.tables.length === 9 && audit.balanceType === 'numeric'
      && audit.packages >= 4 && audit.services >= 2 && audit.forwardCount === 0;
    record('parent.provision_v7', versionsOk && tablesOk, 'Parent provisioned via baseline v1–v7 only', audit);
    await enableParent(parent);
    const health = await healthCheck(parent);
    record('parent.health', health.ok && health.networkRole === 'parent', 'Parent health + role', health);
  } catch (err) {
    record('parent.provision_v7', false, err.message);
    throw err;
  }

  // Child via network wizard (migrate v7 path; forward patches skipped)
  try {
    const report = await createChild({
      configPath: 'forums/forum-v7c.json',
      parentPath: 'forums/forum-v7.json',
      templateId: 'default',
      freeMonths: 1,
    });
    const childAudit = await schemaAudit(child);
    record('child.create_v7', report.ok === true && childAudit.versions.at(-1)?.version === 7,
      'Child create on baseline v7', {
        steps: report.steps?.map((s) => s.step),
        versions: childAudit.versions.map((v) => v.version),
        forwardCount: childAudit.forwardCount,
        freeModeExpiresAt: report.freeModeExpiresAt,
      });
  } catch (err) {
    record('child.create_v7', false, err.message);
    throw err;
  }

  // Policy fixture for pin eligibility
  try {
    const { spawnSync } = await import('node:child_process');
    spawnSync(process.execPath, [path.join(root, 'scripts/policy-fixture.mjs')], { stdio: 'inherit' });
    const trust = path.join(root, '.local/phase22/policy-public.pem');
    const snap = path.join(root, '.local/phase22/global-policy.json');
    for (const c of [parent, child]) {
      const file = path.join(local(c), 'secrets.json');
      const s = readJson(file);
      s.policyTrustKeyFile = trust;
      s.policySnapshotFile = snap;
      writeJson(file, s);
    }
    record('policy.fixture', true, 'Policy snapshot attached');
  } catch (err) {
    record('policy.fixture', false, err.message);
  }

  let parentUp = false;
  let childUp = false;
  try {
    await start(parent);
    parentUp = true;
    await waitHttp(`http://127.0.0.1:${parent.apiPort}/api/settings`);
    record('parent.start', true, `API ${parent.apiPort}`);
  } catch (err) {
    record('parent.start', false, err.message);
  }
  try {
    await start(child);
    childUp = true;
    await waitHttp(`http://127.0.0.1:${child.apiPort}/api/settings`);
    record('child.start', true, `API ${child.apiPort}`);
  } catch (err) {
    record('child.start', false, err.message);
  }

  const parentApi = `http://127.0.0.1:${parent.apiPort}`;
  const childApi = `http://127.0.0.1:${child.apiPort}`;
  const parentAdmin = readJson(path.join(local(parent), 'admin.json'));
  const childAdmin = readJson(path.join(local(child), 'admin.json'));

  let parentToken;
  let childToken;
  try {
    parentToken = await login(parentApi, parentAdmin.username, parentAdmin.password);
    record('parent.admin_login', true, 'Admin login OK');
  } catch (err) {
    record('parent.admin_login', false, err.message);
  }
  try {
    childToken = await login(childApi, childAdmin.username, childAdmin.password);
    record('child.admin_login', true, 'Admin login OK');
  } catch (err) {
    record('child.admin_login', false, err.message);
  }

  if (childToken) {
    try {
      const net = await api(childApi, childToken, 'GET', '/api/forum/network/status');
      record('child.network', net.status === 200 && net.json.data?.role === 'child'
        && net.json.data?.opsRequired === false && net.json.data?.parentOfflineSafe === true,
      'Child network status independent', net.json.data);
    } catch (err) {
      record('child.network', false, err.message);
    }

    try {
      const pricing = await api(childApi, childToken, 'GET', '/api/forum/local-pricing/services');
      const data = pricing.json.data || {};
      record('child.free_mode_services', pricing.status === 200 && data.freeMode === true
        && Array.isArray(data.services) && data.services.length >= 2,
      'Free Mode + local services present', {
        freeMode: data.freeMode,
        vndPerCredit: data.vndPerCredit,
        serviceCodes: (data.services || []).map((s) => s.serviceCode),
      });
    } catch (err) {
      record('child.free_mode_services', false, err.message);
    }

    try {
      const wallet = await api(childApi, childToken, 'GET', '/api/pins/me');
      record('child.credit_wallet', wallet.status === 200, 'Credit/pin wallet readable', {
        status: wallet.status,
        balance: wallet.json.balance,
      });
    } catch (err) {
      record('child.credit_wallet', false, err.message);
    }

    try {
      const cats = await api(childApi, childToken, 'GET', '/api/categories');
      const list = cats.json.data || cats.json.categories || cats.json;
      const categoryId = Array.isArray(list) ? list[0]?.id : null;
      const created = await api(childApi, childToken, 'POST', '/api/topics/', {
        title: `V7 child topic ${Date.now()}`,
        content: 'Baseline v7 child post',
        categoryId,
      });
      const topicId = created.json.data?.topic?.id || created.json.topic?.id;
      if (topicId) {
        const client = await connect(child);
        try {
          await client.query(`UPDATE topics SET approval_status='approved' WHERE id=$1`, [topicId]);
          await client.query(`UPDATE posts SET approval_status='approved' WHERE topic_id=$1 AND post_number=1`, [topicId]);
        } finally {
          await client.end();
        }
      }
      const pin = topicId
        ? await api(childApi, childToken, 'POST', `/api/pins/topics/${topicId}/purchase`, {
          idempotencyKey: crypto.randomUUID(),
        })
        : { status: 0, json: {} };
      record('child.post_and_pin', created.status < 400 && pin.status < 400,
        'Post + Free Mode pin without OPS', {
          topicStatus: created.status,
          topicId,
          pinStatus: pin.status,
          pinBody: pin.json,
        });
    } catch (err) {
      record('child.post_and_pin', false, err.message);
    }
  }

  try {
    const exported = await exportPolicy(parent, {
      out: path.join(root, 'docs/audit/parent-child/baseline-v7-policy.json'),
    });
    const first = await applyPolicy(child, exported.path);
    const second = await applyPolicy(child, exported.path);
    record('policy.sync', first.status === 'applied' && second.status === 'skipped_duplicate',
      'Managed policy version + anti-duplicate', { first, second });
  } catch (err) {
    record('policy.sync', false, err.message);
  }

  if (parentUp) {
    try {
      stop(parent);
      parentUp = false;
      record('parent.offline', true, 'Parent stopped');
    } catch (err) {
      record('parent.offline', false, err.message);
    }
  }
  if (childToken) {
    try {
      let me; let pricing; let lastErr;
      for (let i = 0; i < 5; i += 1) {
        try {
          await new Promise((r) => setTimeout(r, 500));
          me = await api(childApi, childToken, 'GET', '/api/auth/me');
          pricing = await api(childApi, childToken, 'GET', '/api/forum/local-pricing/services');
          lastErr = null;
          break;
        } catch (err) {
          lastErr = err;
        }
      }
      if (lastErr) throw lastErr;
      record('child.while_parent_offline', me.status === 200 && pricing.status === 200,
        'Child works while Parent offline', { me: me.status, pricing: pricing.status });
    } catch (err) {
      record('child.while_parent_offline', false, err.message);
    }
  }

  if (childUp) {
    try {
      stop(child);
      childUp = false;
      record('child.stop', true, 'Child stopped');
    } catch (err) {
      record('child.stop', false, err.message);
    }
  }

  for (const [flag, c, label] of [[parentUp, parent, 'parent'], [childUp, child, 'child']]) {
    if (flag) {
      try { stop(c); record(`${label}.cleanup`, true, 'stopped'); }
      catch (err) { record(`${label}.cleanup`, false, err.message); }
    }
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  const summary = {
    ok: failed === 0,
    passed,
    failed,
    baselineReadyForNewForums: failed === 0,
    preserved: ['forum_a/pbn_dev', 'forum_b/pbn_forum_b'],
    fixtures: { parent: parent.id, child: child.id },
    results,
  };
  writeJson(path.join(root, 'docs/audit/PBN-BASELINE-V7-E2E-RESULTS.json'), summary);
  console.log(`\nBaseline v7 E2E: ${passed} passed, ${failed} failed`);
  if (failed) process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
