/**
 * Parent/Child E2E against forum_p / forum_c fixtures only.
 * Never migrates, seeds, or writes Forum A (pbn_dev) / Forum B (pbn_forum_b).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  root, readJson, writeJson, config, local, connect, processEnv, start, stop, Client,
} from './forum.mjs';
import {
  createChild,
  enableParent,
  destroyFixture,
  exportPolicy,
  applyPolicy,
  healthCheck,
  assertMutableForum,
} from './forum-network.mjs';

const results = [];
const evidenceDir = path.join(root, 'docs/audit/parent-child');
fs.mkdirSync(evidenceDir, { recursive: true });

function record(id, ok, summary, detail = {}) {
  const row = { id, ok, summary, ...detail, at: new Date().toISOString() };
  results.push(row);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}: ${summary}`);
  return row;
}

async function waitHttp(url, { timeoutMs = 60000 } = {}) {
  const startAt = Date.now();
  let lastErr;
  while (Date.now() - startAt < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 401 || res.status === 403) return res.status;
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Timeout waiting for ${url}: ${lastErr?.message || 'unknown'}`);
}

async function login(apiBase, username, password) {
  const res = await fetch(`${apiBase}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier: username, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Login failed ${res.status}: ${JSON.stringify(body)}`);
  const token = body.token || body.data?.token || body.accessToken;
  if (!token) throw new Error('Login response missing token');
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
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function countUsers(c) {
  const client = await connect(c);
  try {
    return (await client.query('SELECT count(*)::int AS n FROM users')).rows[0].n;
  } finally {
    await client.end();
  }
}

async function countTopics(c) {
  const client = await connect(c);
  try {
    return (await client.query('SELECT count(*)::int AS n FROM topics')).rows[0].n;
  } finally {
    await client.end();
  }
}

async function assertNoCrossLeak(parent, child) {
  const p = await connect(parent);
  const c = await connect(child);
  try {
    const pUsers = (await p.query('SELECT username FROM users ORDER BY id')).rows.map((r) => r.username);
    const cUsers = (await c.query('SELECT username FROM users ORDER BY id')).rows.map((r) => r.username);
    const leakToParent = cUsers.some((u) => pUsers.includes(u) && u !== `${parent.id}_admin`);
    // Child admin username must not appear in Parent.
    const childAdminInParent = pUsers.includes(`${child.id}_admin`);
    const parentAdminInChild = cUsers.includes(`${parent.id}_admin`);
    if (childAdminInParent || parentAdminInChild || leakToParent) {
      throw new Error(`User leak detected: parent=${pUsers.join(',')} child=${cUsers.join(',')}`);
    }
    const pTx = (await p.query('SELECT count(*)::int AS n FROM sys_transactions')).rows[0].n;
    const cTx = (await c.query('SELECT count(*)::int AS n FROM sys_transactions')).rows[0].n;
    return { pUsers, cUsers, pTx, cTx };
  } finally {
    await p.end();
    await c.end();
  }
}

async function ensureCreditsWallet(c, userId, amount = 100) {
  const client = await connect(c);
  try {
    await client.query(`UPDATE sys_currencies SET is_active=true WHERE code='credits'`);
    const currency = (await client.query(`SELECT code FROM sys_currencies WHERE code='credits'`)).rows[0];
    if (!currency) throw new Error('credits currency missing');
    await client.query(
      `INSERT INTO sys_accounts(user_id, currency_code, balance, total_earned, total_spent)
       VALUES($1,'credits',$2,$2,0)
       ON CONFLICT(user_id, currency_code) DO UPDATE SET balance = GREATEST(sys_accounts.balance::numeric, $2::numeric)`,
      [userId, amount],
    );
  } finally {
    await client.end();
  }
}

async function main() {
  const parent = config('forums/forum-p.json');
  const child = config('forums/forum-c.json');
  assertMutableForum(parent);
  assertMutableForum(child);

  // Guard: A/B must remain untouched (presence check only).
  record('guard.registry', true, 'Using forum_p / forum_c only; A/B excluded by assertMutableForum');

  // Reset fixtures for idempotent E2E.
  for (const c of [child, parent]) {
    try {
      await destroyFixture(c);
      record(`reset.${c.id}`, true, `Dropped fixture ${c.database}`);
    } catch (err) {
      record(`reset.${c.id}`, true, `Reset skipped/partial: ${err.message}`);
    }
  }

  // 1. Provision Parent (base forum first, then enable parent role)
  try {
    const { configure, createDatabase, migrate, seed, admin } = await import('./forum.mjs');
    const { applyForwardPatches } = await import('./forum-network.mjs');
    await configure(parent);
    await createDatabase(parent);
    await migrate(parent);
    await applyForwardPatches(parent);
    await seed(parent);
    await admin(parent);
    await enableParent(parent);
    const healthP = await healthCheck(parent);
    record('parent.provision', healthP.ok && healthP.networkRole === 'parent', 'Parent provisioned + role enabled', healthP);
  } catch (err) {
    record('parent.provision', false, err.message);
    throw err;
  }

  // 2. Create Child via wizard
  let createReport;
  try {
    createReport = await createChild({
      configPath: 'forums/forum-c.json',
      parentPath: 'forums/forum-p.json',
      templateId: 'default',
      freeMonths: 2,
    });
    record('child.create', createReport.ok === true, 'Child create wizard completed', {
      steps: createReport.steps?.map((s) => s.step),
      freeModeExpiresAt: createReport.freeModeExpiresAt,
    });
  } catch (err) {
    record('child.create', false, err.message, err.report || {});
    throw err;
  }

  // 3. DB isolation
  try {
    const leak = await assertNoCrossLeak(parent, child);
    record('isolation.users', true, 'No admin/user leak between Parent and Child', leak);
  } catch (err) {
    record('isolation.users', false, err.message);
  }

  // Attach signed policy fixture so paid-pin eligibility can ALLOW (no OPS required).
  try {
    const { spawnSync } = await import('node:child_process');
    spawnSync(process.execPath, [path.join(root, 'scripts/policy-fixture.mjs')], { stdio: 'inherit' });
    const trust = path.join(root, '.local/phase22/policy-public.pem');
    const snap = path.join(root, '.local/phase22/global-policy.json');
    for (const c of [parent, child]) {
      const secretsFile = path.join(local(c), 'secrets.json');
      const secrets = readJson(secretsFile);
      secrets.policyTrustKeyFile = trust;
      secrets.policySnapshotFile = snap;
      writeJson(secretsFile, secrets);
    }
    record('policy.fixture', true, 'Attached development policy snapshot to Parent/Child secrets');
  } catch (err) {
    record('policy.fixture', false, err.message);
  }

  // 4. Start both APIs (web optional for API E2E)
  let parentStarted = false;
  let childStarted = false;
  try {
    await start(parent);
    parentStarted = true;
    await waitHttp(`http://127.0.0.1:${parent.apiPort}/api/health`).catch(async () => {
      await waitHttp(`http://127.0.0.1:${parent.apiPort}/api/settings`);
    });
    record('parent.start', true, `Parent API up on ${parent.apiPort}`);
  } catch (err) {
    record('parent.start', false, err.message);
  }
  try {
    await start(child);
    childStarted = true;
    await waitHttp(`http://127.0.0.1:${child.apiPort}/api/health`).catch(async () => {
      await waitHttp(`http://127.0.0.1:${child.apiPort}/api/settings`);
    });
    record('child.start', true, `Child API up on ${child.apiPort}`);
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
    record('parent.login', true, 'Parent admin login OK');
  } catch (err) {
    record('parent.login', false, err.message);
  }
  try {
    childToken = await login(childApi, childAdmin.username, childAdmin.password);
    record('child.login', true, 'Child admin login OK');
  } catch (err) {
    record('child.login', false, err.message);
  }

  // Cross-login must fail
  try {
    await login(childApi, parentAdmin.username, parentAdmin.password);
    record('isolation.cross_login', false, 'Parent credentials unexpectedly worked on Child');
  } catch {
    record('isolation.cross_login', true, 'Parent credentials rejected on Child');
  }

  // Network status on Child
  if (childToken) {
    try {
      const st = await api(childApi, childToken, 'GET', '/api/forum/network/status');
      const data = st.json.data || {};
      record(
        'child.network_status',
        st.status === 200 && data.role === 'child' && data.parentOfflineSafe === true && data.opsRequired === false,
        'Child network status independent of OPS/Parent runtime',
        data,
      );
    } catch (err) {
      record('child.network_status', false, err.message);
    }
  }

  // Free Mode
  if (childToken) {
    try {
      const services = await api(childApi, childToken, 'GET', '/api/forum/local-pricing/services');
      const freeMode = Boolean(services.json.data?.freeMode);
      record('child.free_mode', freeMode === true, 'Free Mode enabled with expiry from template', {
        freeMode,
        expiresAt: services.json.data?.freeModeExpiresAt || createReport?.freeModeExpiresAt,
        services: services.json.data,
      });
    } catch (err) {
      record('child.free_mode', false, err.message);
    }
  }

  // Post topic on Child
  let topicId = null;
  if (childToken) {
    try {
      const cats = await api(childApi, childToken, 'GET', '/api/categories');
      const list = cats.json.data || cats.json.categories || cats.json;
      const categoryId = Array.isArray(list) ? list[0]?.id : list?.[0]?.id;
      const create = await api(childApi, childToken, 'POST', '/api/topics/', {
        title: `Child E2E topic ${Date.now()}`,
        content: 'Independent child content — not synced from parent.',
        categoryId,
      });
      topicId = create.json.data?.topic?.id || create.json.topic?.id || create.json.data?.id || create.json.id;
      if (topicId) {
        // Ensure approved for paid-pin eligibility (managed policy must not leave topics pending).
        const client = await connect(child);
        try {
          await client.query(`UPDATE topics SET approval_status='approved' WHERE id=$1`, [topicId]);
          await client.query(`UPDATE posts SET approval_status='approved' WHERE topic_id=$1 AND post_number=1`, [topicId]);
        } finally {
          await client.end();
        }
      }
      record('child.post', create.status < 400 && Boolean(topicId), 'Child can create topic', {
        status: create.status,
        topicId,
        body: create.json,
      });
    } catch (err) {
      record('child.post', false, err.message);
    }
  }

  // Credit wallet + pin under Free Mode
  if (childToken && topicId) {
    try {
      const me = await api(childApi, childToken, 'GET', '/api/auth/me');
      const userId = me.json.data?.id || me.json.id || me.json.user?.id;
      await ensureCreditsWallet(child, userId, 50);
      const wallet = await api(childApi, childToken, 'GET', '/api/ledger/me');
      const walletAlt = wallet.status === 200 ? wallet : await api(childApi, childToken, 'GET', '/api/pins/me');
      record('child.wallet', walletAlt.status === 200, 'Child ledger/pin wallet readable', { status: walletAlt.status });

      const pin = await api(childApi, childToken, 'POST', `/api/pins/topics/${topicId}/purchase`, {
        idempotencyKey: crypto.randomUUID(),
      });
      // Free Mode: expect success without requiring OPS
      record('child.pin', pin.status < 400, 'Paid pin works without OPS (Free Mode / local pricing)', {
        status: pin.status,
        body: pin.json,
      });
    } catch (err) {
      record('child.pin', false, err.message);
    }
  }

  // Policy version sync + duplicate retry
  try {
    const exported = await exportPolicy(parent, {
      out: path.join(evidenceDir, 'policy-v2.json'),
      notes: 'E2E managed policy v2',
    });
    // Force unique version already set by exportPolicy
    const first = await applyPolicy(child, exported.path);
    const second = await applyPolicy(child, exported.path);
    record(
      'policy.sync',
      first.status === 'applied' && second.status === 'skipped_duplicate',
      'Managed policy apply + anti-duplicate retry',
      { first, second, version: exported.package.version },
    );
  } catch (err) {
    record('policy.sync', false, err.message);
  }

  // Parent offline: stop parent, child still works
  if (parentStarted) {
    try {
      stop(parent);
      parentStarted = false;
      record('parent.offline', true, 'Parent stopped');
    } catch (err) {
      record('parent.offline', false, err.message);
    }
  }

  if (childToken) {
    try {
      const me = await api(childApi, childToken, 'GET', '/api/auth/me');
      const settings = await api(childApi, childToken, 'GET', '/api/forum/local-pricing/services');
      record(
        'child.while_parent_offline',
        me.status === 200 && settings.status === 200,
        'Child login/settings work while Parent offline',
        { me: me.status, pricing: settings.status },
      );
    } catch (err) {
      record('child.while_parent_offline', false, err.message);
    }
  }

  // Child offline + Parent (restart parent briefly for registry check, then stop both)
  if (childStarted) {
    try {
      stop(child);
      childStarted = false;
      record('child.offline', true, 'Child stopped cleanly');
    } catch (err) {
      record('child.offline', false, err.message);
    }
  }

  // Topic refs are not public topics
  try {
    const client = await connect(child);
    try {
      const refs = (await client.query('SELECT count(*)::int AS n FROM forum_topic_reference_snapshots')).rows[0].n;
      const publicTitles = (await client.query(
        `SELECT title FROM topics WHERE is_deleted=false`,
      )).rows.map((r) => r.title);
      const refTitles = (await client.query(
        `SELECT meta->>'titlePreview' AS title FROM forum_topic_reference_snapshots`,
      )).rows.map((r) => r.title).filter(Boolean);
      const leaked = refTitles.filter((t) => publicTitles.includes(t));
      record(
        'topic_refs.not_public',
        refs > 0 && leaked.length === 0,
        'Topic reference snapshots exist and are not published as Child topics',
        { refs, publicTopics: publicTitles.length, leaked },
      );
    } finally {
      await client.end();
    }
  } catch (err) {
    record('topic_refs.not_public', false, err.message);
  }

  // Final isolation counts
  try {
    const pUsers = await countUsers(parent);
    const cUsers = await countUsers(child);
    const pTopics = await countTopics(parent);
    const cTopics = await countTopics(child);
    record('isolation.counts', pUsers >= 1 && cUsers >= 1, 'Separate user/topic counts', {
      parentUsers: pUsers,
      childUsers: cUsers,
      parentTopics: pTopics,
      childTopics: cTopics,
    });
  } catch (err) {
    record('isolation.counts', false, err.message);
  }

  // Cleanup processes
  for (const [flag, c, label] of [[parentStarted, parent, 'parent'], [childStarted, child, 'child']]) {
    if (flag) {
      try { stop(c); record(`${label}.cleanup_stop`, true, 'Stopped'); }
      catch (err) { record(`${label}.cleanup_stop`, false, err.message); }
    }
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  const summary = {
    ok: failed === 0,
    passed,
    failed,
    results,
    fixtures: { parent: parent.id, child: child.id },
    preserved: ['forum_a/pbn_dev', 'forum_b/pbn_forum_b'],
  };
  const out = path.join(root, 'docs/audit/PBN-PARENT-CHILD-E2E-RESULTS.json');
  writeJson(out, summary);
  writeJson(path.join(evidenceDir, 'e2e-results.json'), summary);
  console.log(`\nE2E summary: ${passed} passed, ${failed} failed → ${out}`);
  if (failed) process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
