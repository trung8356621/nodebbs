/**
 * API smoke for forum-network Admin UI endpoints (forum_v7 fixture).
 * Does not touch Forum A/B. No password files written.
 */
import path from 'node:path';
import { root, readJson, config, local, start, stop } from './forum.mjs';

const results = [];
function record(id, ok, summary, detail = {}) {
  results.push({ id, ok, summary, ...detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}: ${summary}`);
}

async function wait(url, ms = 90000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      const res = await fetch(url);
      if (res.ok || [401, 403].includes(res.status)) return;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('timeout ' + url);
}

async function main() {
  const c = config('forums/forum-v7.json');
  let started = false;
  try {
    try { stop(c); } catch { /* not running */ }
    await start(c);
    started = true;
    await wait(`http://127.0.0.1:${c.apiPort}/api/settings`);

    const admin = readJson(path.join(local(c), 'admin.json'));
    const login = await fetch(`http://127.0.0.1:${c.apiPort}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identifier: admin.username, password: admin.password }),
    });
    const loginBody = await login.json();
    const token = loginBody.token || loginBody.data?.token;
    record('login', login.ok && Boolean(token), 'Admin login');

    const api = async (method, pathname, body) => {
      const res = await fetch(`http://127.0.0.1:${c.apiPort}${pathname}`, {
        method,
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      return { status: res.status, json: await res.json().catch(() => ({})) };
    };

    const overview = await api('GET', '/api/forum/network/overview');
    record('overview', overview.status === 200 && overview.json.data?.ready === true,
      'GET overview', { role: overview.json.data?.role, provision: overview.json.data?.provision?.availableInRuntime });

    // Ensure parent for draft/publish tests without forcing A
    if (overview.json.data?.role === 'none') {
      const en = await api('POST', '/api/forum/network/enable-parent');
      record('enable_parent', en.status === 200 && en.json.data?.role === 'parent', 'Enable parent');
    } else {
      record('enable_parent', true, `Already role=${overview.json.data?.role}`);
    }

    const templates = await api('GET', '/api/forum/network/templates');
    record('templates', templates.status === 200, 'GET templates', {
      count: templates.json.data?.templates?.length,
    });

    const children = await api('GET', '/api/forum/network/children');
    record('children', children.status === 200, 'GET children');

    const apps = await api('GET', '/api/forum/network/policy-applications');
    record('policy_applications', apps.status === 200, 'GET policy-applications');

    const publish = await api('POST', '/api/forum/network/policies/publish-from-template', { templateId: 'default' });
    record('publish_from_template', publish.status === 200 && Boolean(publish.json.data?.package?.version),
      'Publish managed from template', { version: publish.json.data?.package?.version });

    const draft = await api('POST', '/api/forum/network/children/draft', {
      id: 'forum_ui_draft',
      database: 'pbn_forum_ui_draft',
      name: 'UI Draft Child',
      locale: 'vi-VN',
      freeMonths: 2,
      webPort: 3900,
      apiPort: 7900,
    });
    record('draft_child', draft.status === 200 && draft.json.data?.provisioned === false
      && draft.json.data?.availableInRuntime === false && Boolean(draft.json.data?.command),
    'Draft child does not fake provision', {
      command: draft.json.data?.command,
    });

    const blocked = await api('POST', '/api/forum/network/children/draft', {
      id: 'forum_a',
      database: 'pbn_dev',
      name: 'Blocked',
    });
    record('draft_blocks_a', blocked.status >= 400, 'Draft rejects Forum A target', {
      status: blocked.status,
      error: blocked.json.error,
    });
  } catch (err) {
    record('smoke', false, err.message);
  } finally {
    if (started) {
      try { stop(c); } catch { /* ignore */ }
    }
  }

  const failed = results.filter((r) => !r.ok).length;
  const out = {
    ok: failed === 0,
    passed: results.filter((r) => r.ok).length,
    failed,
    results,
  };
  const fs = await import('node:fs');
  fs.writeFileSync(
    path.join(root, 'docs/audit/PBN-FORUM-NETWORK-ADMIN-UI-SMOKE.json'),
    JSON.stringify(out, null, 2) + '\n',
  );
  console.log(JSON.stringify(out, null, 2));
  if (failed) process.exitCode = 1;
}

main();
