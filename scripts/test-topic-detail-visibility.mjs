/**
 * Topic detail visibility + SSR fetch contract (no DB mutation).
 * Live probes are optional via TOPIC_DETAIL_BASE_URL.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

let passed = 0;
const check = (name, fn) => {
  fn();
  passed += 1;
  console.log('PASS ' + name);
};

const pagePath = path.resolve('apps/web/src/app/(main)/topic/[id]/page.js');
const serverPath = path.resolve('apps/web/src/modules/forum/server.js');
const apiPath = path.resolve('apps/web/src/lib/server/api.js');
const topicsRoute = path.resolve('apps/api/src/modules/forum/routes/topics/index.js');
const adapterPath = path.resolve('apps/api/src/services/moderation/adapters.js');

const pageSrc = fs.readFileSync(pagePath, 'utf8');
const serverSrc = fs.readFileSync(serverPath, 'utf8');
const apiSrc = fs.readFileSync(apiPath, 'utf8');
const topicsSrc = fs.readFileSync(topicsRoute, 'utf8');
const adapterSrc = fs.readFileSync(adapterPath, 'utf8');

check('getTopicData is not React.cache-wrapped', () => {
  assert.match(serverSrc, /export async function getTopicData/);
  assert.doesNotMatch(serverSrc, /export const getTopicData = cache\(/);
});

check('getTopicData uses request() not fetchData fallback', () => {
  assert.match(serverSrc, /return request\(`\/topics\/\$\{id\}`/);
  assert.doesNotMatch(serverSrc, /getTopicData[\s\S]{0,200}fetchData\(/);
});

check('topic metadata does not Promise.all topic+siteInfo', () => {
  assert.doesNotMatch(pageSrc, /Promise\.all\(\[getTopicData\(id\),\s*getSiteInfo/);
});

check('topic page rethrows non-null failures instead of notFound', () => {
  assert.match(pageSrc, /throw error/);
  assert.match(pageSrc, /if \(!topic\) \{\s*notFound\(\);/s);
});

check('missing topic metadata commits notFound instead of a 200 title', () => {
  assert.match(pageSrc, /if \(!topic\) \{\s*notFound\(\);/s);
  assert.doesNotMatch(pageSrc, /return \{\s*title: pbnT\("m118"\)/s);
});

check('api.js documents critical resources must use request()', () => {
  assert.match(apiSrc, /getTopicData/);
});

check('API masks pending/rejected as 404 for non-privileged', () => {
  assert.match(topicsSrc, /approvalStatus !== 'approved' && !canManageTopics && !isAuthor/);
  assert.match(topicsSrc, /reply\.code\(404\)\.send/);
});

check('topic moderation approve updates first post too', () => {
  assert.match(adapterSrc, /eq\(posts\.postNumber, 1\)/);
  assert.match(adapterSrc, /approvalStatus: status/);
});

check('request maps HTTP 404 to null', () => {
  assert.match(apiSrc, /if \(response\.status === 404\) \{\s*return null;/s);
});

const base = process.env.TOPIC_DETAIL_BASE_URL;
if (base) {
  const origin = base.replace(/\/+$/, '');
  const probe = async (label, url, expect) => {
    const started = Date.now();
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(20000) });
    const ms = Date.now() - started;
    console.log(`${label} ${res.status} ${ms}ms ${url}`);
    if (expect.status) assert.equal(res.status, expect.status);
    if (expect.maxMs) assert.ok(ms < expect.maxMs, `${label} too slow: ${ms}ms`);
    if (expect.json) {
      const body = await res.json();
      if (expect.json.approvalStatus) assert.equal(body.approvalStatus, expect.json.approvalStatus);
      if (expect.json.id) assert.equal(body.id, expect.json.id);
    }
    passed += 1;
  };

  await probe('api-198', `${origin}/api/topics/198`, {
    status: 200,
    maxMs: 5000,
    json: { id: 198, approvalStatus: 'approved' },
  });
  await probe('api-193', `${origin}/api/topics/193`, {
    status: 200,
    maxMs: 5000,
    json: { id: 193, approvalStatus: 'approved' },
  });
  await probe('api-missing', `${origin}/api/topics/99999991`, { status: 404, maxMs: 5000 });
  await probe('page-198', `${origin}/topic/198`, { status: 200, maxMs: 15000 });
  await probe('page-193', `${origin}/topic/193`, { status: 200, maxMs: 15000 });
  await probe('page-missing', `${origin}/topic/99999991`, { status: 404, maxMs: 15000 });
}

console.log(`PASS ${passed} topic-detail visibility assertions`);
