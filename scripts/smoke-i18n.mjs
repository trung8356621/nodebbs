import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
import { chromium } from '@playwright/test';

const web = 'http://127.0.0.1:3100';
const api = 'http://127.0.0.1:7100/api';
const env = fs.readFileSync('apps/api/.env', 'utf8');
const database = new URL(env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, '') || 'invalid:');
assert.equal(database.hostname, '127.0.0.1', 'Smoke writes require the local PBN database');
assert.equal(database.pathname, '/pbn_dev', 'Smoke writes require pbn_dev');
const accounts = fs.existsSync('.local/smoke-accounts.json')
  ? JSON.parse(fs.readFileSync('.local/smoke-accounts.json', 'utf8'))
  : [
    { username: process.env.PBN_SMOKE_ADMIN_USERNAME, password: process.env.PBN_SMOKE_ADMIN_PASSWORD },
    { username: process.env.PBN_SMOKE_USER_USERNAME, password: process.env.PBN_SMOKE_USER_PASSWORD },
  ];
assert(accounts.length >= 2 && accounts.every((a) => a.username && a.password), 'Provide local admin/user smoke accounts via .local/smoke-accounts.json or PBN_SMOKE_* environment variables');
fs.mkdirSync('.local', { recursive: true });
const results = [];
async function request(path, { locale = 'vi-VN', token, method = 'GET', body, status = 200 } = {}) {
  const response = await fetch(`${api}${path}`, {
    method, headers: { 'content-type': 'application/json', cookie: `pbn-locale=${locale}`, ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  assert.equal(response.status, status, `${method} ${path}`);
  return data;
}
await request('');
const sessions = [];
for (const account of accounts) sessions.push(await request('/auth/login', { method: 'POST', body: { identifier: account.username, password: account.password } }));
assert.equal(sessions[0].user.role, 'admin');
assert.equal(sessions[1].user.role, 'user');
// Regression writes create smoke content only; no deletes or schema operations.
const categories = await request('/categories');
const suffix = Date.now().toString(36);
const registeredAccount = { username: `pbn15${suffix}`, email: `pbn15${suffix}@example.invalid`, password: randomBytes(24).toString('hex') };
const registered = await request('/auth/register', { method: 'POST', body: registeredAccount });
assert.equal(registered.user.role, 'user');
await request('/auth/login', { method: 'POST', body: { identifier: registeredAccount.username, password: registeredAccount.password } });
fs.writeFileSync(`.local/registered-smoke-${suffix}.json`, JSON.stringify(registeredAccount));
const content = 'PBN i18n regression — 用户自定义内容 must stay unchanged.';
const topic = await request('/topics', { method: 'POST', token: sessions[1].token, body: { title: `PBN i18n smoke ${suffix}`, categoryId: categories[0].id, content } });
const topicId = topic.topic.id;
await request('/posts', { method: 'POST', token: sessions[1].token, body: { topicId, content: 'PBN i18n smoke reply' } });
for (const locale of ['vi-VN', 'en-US']) {
  const detail = await request(`/topics/${topicId}`, { locale });
  assert.equal(detail.content, content, 'User content must not be translated');
  await request('/topics');
  await request(`/posts?topicId=${topicId}`);
  await request(`/topics/${topicId}`, { method: 'PATCH', locale, token: sessions[1].token, body: { isPinned: true }, status: 403 });
  for (const isPinned of [true, false]) {
    await request(`/topics/${topicId}`, { method: 'PATCH', locale, token: sessions[0].token, body: { isPinned } });
    assert.equal((await request(`/topics/${topicId}`, { locale })).isPinned, isPinned);
  }
  await request('/dashboard/stats', { locale, token: sessions[0].token });
  await request('/dashboard/stats', { locale, token: sessions[1].token, status: 403 });
  await request('/dashboard/stats', { locale, status: 401 });
  await request('/ledger/balance', { locale, token: sessions[1].token });
  await request('/ledger/transactions', { locale, token: sessions[1].token });
  const error = await request('/auth/login', { locale, method: 'POST', body: { identifier: 'pbn_missing_account', password: 'invalid-password' }, status: 401 });
  assert.match(error.error, locale === 'vi-VN' ? /mật khẩu/ : /password/);
}

const browser = await chromium.launch({ headless: true });
try {
  for (const locale of ['vi-VN', 'en-US']) {
    const context = await browser.newContext({ locale });
    await context.addCookies([{ name: 'pbn-locale', value: locale, url: web }]);
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(90000);
    page.setDefaultTimeout(45000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error' && /INTL|MISSING_MESSAGE|INVALID_MESSAGE|hydration/i.test(message.text())) errors.push(message.text()); });
    await page.goto(`${web}/auth/login`, { waitUntil: 'networkidle' });
    const form = page.locator('form').filter({ has: page.locator('input[name="identifier"]') }).first();
    await form.locator('button[type="submit"]').click();
    const nativeValidation = await form.locator('input[name="identifier"]').evaluate((input) => input.validationMessage);
    assert.match(nativeValidation, locale === 'vi-VN' ? /Vui lòng/ : /Please/);
    await form.locator('input[name="identifier"]').fill(accounts[0].username);
    await form.locator('input[name="password"]').fill('wrong-password-for-smoke');
    await form.locator('button[type="submit"]').click();
    await page.getByText(locale === 'vi-VN' ? 'Tên người dùng/email hoặc mật khẩu sai' : 'Incorrect username/email or password', { exact: true }).first().waitFor();
    // Upstream dispatches the global unauthorized dialog for a failed login.
    // Dismiss it before continuing on the login page; do not change auth behavior.
    if (await page.getByRole('dialog').isVisible()) await page.keyboard.press('Escape');
    await form.locator('input[name="password"]').fill(accounts[0].password);
    await Promise.all([
      page.waitForResponse((response) => response.url().endsWith('/api/auth/login') && response.status() === 200),
      form.locator('button[type="submit"]').click(),
    ]);
    await page.waitForTimeout(700);
    for (const route of ['/', '/categories', `/topic/${topicId}`, '/profile/settings', '/profile/wallet', '/profile/shop', '/dashboard', '/dashboard/settings', '/dashboard/ledger', '/dashboard/shop', '/dashboard/ads']) {
      const response = await page.goto(`${web}${route}`, { waitUntil: 'networkidle', timeout: 60000 });
      assert.equal(response.status(), 200, route);
      assert.equal(await page.locator('html').getAttribute('lang'), locale);
      const body = await page.locator('body').innerText();
      assert(!body.includes('Pending translation'));
      if (route === '/dashboard/settings') assert(!/站点名称|在 Logo 旁|SEO 关键词|自定义统计脚本/.test(body), 'System descriptions must be translated');
      if (route === '/profile/wallet') assert(body.includes(locale === 'vi-VN' ? 'Ví của tôi' : 'My wallet'));
      const canonical = await page.locator('link[rel="canonical"]').evaluateAll((links) => links.map((link) => link.getAttribute('href')));
      results.push({ locale, route, status: response.status(), canonical });
      await page.screenshot({ path: `.local/phase15-${locale}${route.replaceAll('/', '_')}.png`, fullPage: true });
    }
    assert.deepEqual(errors, [], 'No browser translation or hydration errors');
    await context.close();
  }
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(90000);
  await page.goto(`${web}/auth/login`, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('html').getAttribute('lang'), 'vi-VN');
  for (const locale of ['en-US', 'vi-VN']) {
    await page.getByTestId('locale-switcher').selectOption(locale);
    await page.waitForFunction((expected) => document.documentElement.lang === expected, locale);
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(page.url(), `${web}/auth/login`);
    assert.equal(await page.locator('html').getAttribute('lang'), locale);
    assert.equal((await context.cookies()).find((cookie) => cookie.name === 'pbn-locale').value, locale);
  }
  const seo = {};
  for (const result of results.filter((entry) => entry.locale === 'vi-VN')) {
    const english = results.find((entry) => entry.locale === 'en-US' && entry.route === result.route);
    assert.deepEqual(result.canonical, english.canonical, `${result.route}: canonical must not vary by locale`);
  }
  for (const route of ['/robots.txt', '/sitemap.xml']) {
    const values = [];
    for (const locale of ['vi-VN', 'en-US']) {
      const response = await fetch(`${web}${route}`, { headers: { cookie: `pbn-locale=${locale}` } });
      assert.equal(response.status, 200);
      values.push(await response.text());
    }
    assert.equal(values[0], values[1], `${route} must be locale-independent`);
    seo[route] = 'unchanged across locales';
  }
  fs.writeFileSync('.local/phase15-smoke.json', JSON.stringify({ results, languageSwitchAndRefresh: 'PASS', nativeValidationAndLogin: 'PASS', phase1ApiRegression: 'PASS', userContentPreserved: 'PASS', canonicalUnchangedAcrossLocales: 'PASS', topicId, seo }, null, 2));
  console.log(`PASS: ${results.length} browser pages, two locales, login/validation, switch/refresh, Phase 1 API regression, user content and SEO invariants. Smoke topic ${topicId}.`);
} finally {
  await browser.close();
}
