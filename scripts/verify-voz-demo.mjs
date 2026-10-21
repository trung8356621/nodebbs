import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from '@playwright/test';

const web = 'http://127.0.0.1:3100';
const api = 'http://127.0.0.1:7100/api';
const source = JSON.parse(fs.readFileSync('pbn_voz_ui_seed.json', 'utf8'));
const directory = 'docs/audit/screenshots';
fs.mkdirSync(directory, { recursive: true });
async function get(path) {
  const response = await fetch(api + path);
  assert.equal(response.status, 200, path);
  return response.json();
}
const categories = await get('/categories');
const seeded = categories.filter(c => c.slug.startsWith('pbn-voz-ui-'));
assert.equal(seeded.length, 56);
const groups = seeded.filter(c => c.parentId === null);
assert.equal(groups.length, 7);
for (const group of source.groups) {
  const actual = groups.find(c => c.slug.startsWith(`pbn-voz-ui-${group.key}-`));
  assert.equal(actual.name, group.name);
  assert.equal(actual.position, group.order);
  for (const child of group.categories) {
    const c = seeded.find(c => c.slug.startsWith(`pbn-voz-ui-${child.key}-`));
    assert.equal(c.name, child.name);
    assert.equal(c.parentId, actual.id);
    assert.equal(c.position, child.order);
    assert.equal(c.topicCount, source.demo_topics.filter(t => t.category_key === child.key).length);
  }
}
const first = await get('/topics?page=1&limit=50&sort=latest');
const second = await get('/topics?page=2&limit=50&sort=latest');
const third = await get('/topics?page=3&limit=50&sort=latest');
const items = [...first.items, ...second.items, ...third.items];
assert.equal(new Set(items.map(t => t.id)).size, items.length);
const demo = items.filter(t => t.slug.startsWith('pbn-voz-ui-'));
assert.equal(demo.length, 112);
assert(demo.every(t => t.username === 'pbn_voz_ui_demo' && t.postCount === 1));
for (const fixture of source.demo_topics) {
  const t = demo.find(t => t.slug === 'pbn-voz-ui-' + fixture.seed_key);
  assert.equal(t.title, fixture.title);
  assert.equal(t.categorySlug.startsWith(`pbn-voz-ui-${fixture.category_key}-`), true);
}
const target = demo[0];
const detail = await get(`/topics/${target.id}`);
assert.equal(detail.content, source.demo_topics.find(t => 'pbn-voz-ui-' + t.seed_key === target.slug).content);
const category = seeded.find(c => c.id === target.categoryId);
const featured = await get('/categories?isFeatured=true');
assert.equal(featured.filter(c => c.slug.startsWith('pbn-voz-ui-')).length, 7);
const browser = await chromium.launch({ headless: true });
const results = [];
const pageErrors = [];
try {
  for (const locale of ['vi-VN', 'en-US']) {
    if (process.env.PBN_VERIFY_LOCALE && process.env.PBN_VERIFY_LOCALE !== locale) continue;
    for (const [device, viewport] of Object.entries({ desktop: { width: 1440, height: 1000 }, mobile: { width: 390, height: 844 } })) {
      if (process.env.PBN_VERIFY_DEVICE && process.env.PBN_VERIFY_DEVICE !== device) continue;
      const context = await browser.newContext({ viewport });
      await context.addCookies([{ name: 'pbn-locale', value: locale, url: web }]);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      for (const path of ['/', '/?p=2', '/?sort=newest', `/categories/${category.slug}`, `/topic/${target.id}`]) {
        // Respect the existing API rate limit; each page fetches several resources.
        await new Promise(resolve => setTimeout(resolve, 12000));
        const response = await page.goto(web + path, { waitUntil: 'networkidle', timeout: 90000 });
        assert.equal(response.status(), 200, path);
        if (path.startsWith('/topic/')) await page.getByText('[DỮ LIỆU DEMO]', { exact: false }).first().waitFor();
        else await page.getByText(path.startsWith('/categories/') ? category.name : (path === '/?p=2' ? second.items[0].title : target.title), { exact: false }).first().waitFor();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
        assert.equal(overflow, false, `${device} overflow ${path}`);
        if (path === '/') {
          if (device === 'desktop') await page.getByRole('link', { name: 'Đại sảnh', exact: true }).first().waitFor();
          await page.screenshot({ path: `${directory}/voz-demo-home-${device}-${locale}.png`, fullPage: true });
          await page.screenshot({ path: `${directory}/voz-demo-home-${device}-${locale}-viewport.png` });
        }
        results.push({ locale, device, path, status: response.status(), overflow });
        console.log(`PASS ${locale} ${device} ${path}`);
      }
      pageErrors.push(...errors.map(message => ({ locale, device, message })));
      await context.close();
    }
  }
} finally {
  await browser.close();
}
const report = { counts: { groups: 7, categories: 49, demoTopics: demo.length, totalTopics: items.length, totalCategories: categories.length }, topicUrl: `${web}/topic/${target.id}`, categoryUrl: `${web}/categories/${category.slug}`, results, pageErrors };
fs.writeFileSync('.local/voz-demo-verification.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (pageErrors.length) process.exitCode = 1;
