#!/usr/bin/env node
/**
 * Safe, conditional data normalization for known Chinese seed leftovers.
 *
 * Only updates rows that still match exact legacy seed values.
 * Does not delete rows, change IDs/slugs/codes/FKs, balances, or prices.
 *
 * Usage (Forum A / apps/api .env):
 *   node scripts/normalize-i18n-defaults.mjs
 *   node scripts/normalize-i18n-defaults.mjs --dry-run
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { parseEnv } from 'node:util';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const apiDir = path.join(root, 'apps', 'api');
const dryRun = process.argv.includes('--dry-run');

function loadDatabaseUrl() {
  const envPath = path.join(apiDir, '.env');
  const fileEnv = fs.existsSync(envPath) ? parseEnv(fs.readFileSync(envPath, 'utf8')) : {};
  const url = process.env.DATABASE_URL || fileEnv.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL missing');
  const parsed = new URL(url);
  if (!['127.0.0.1', 'localhost'].includes(parsed.hostname)) {
    throw new Error('Refusing non-loopback DATABASE_URL');
  }
  return url;
}

function redact(message) {
  return String(message).replace(/postgres(?:ql)?:\/\/[^\s)'"]+/gi, '[database URL redacted]');
}

async function main() {
  const require = createRequire(path.join(apiDir, 'package.json'));
  const { Client } = require('pg');
  const client = new Client({ connectionString: loadDatabaseUrl(), connectionTimeoutMillis: 5000 });
  await client.connect();
  // Explicit count + update pairs for clarity and safety.
  const plans = [
    {
      label: 'sys_currencies credits 积分→Credit',
      count: `SELECT count(*)::int AS n FROM sys_currencies WHERE code = 'credits' AND name = '积分'`,
      update: `UPDATE sys_currencies SET name = 'Credit' WHERE code = 'credits' AND name = '积分'`,
    },
    {
      label: 'sys_currencies gold 金币→Gold',
      count: `SELECT count(*)::int AS n FROM sys_currencies WHERE code = 'gold' AND name = '金币'`,
      update: `UPDATE sys_currencies SET name = 'Gold' WHERE code = 'gold' AND name = '金币'`,
    },
    {
      label: 'categories general 综合讨论→General',
      count: `SELECT count(*)::int AS n FROM categories WHERE slug = 'general' AND name = '综合讨论'`,
      update: `UPDATE categories SET name = 'General', description = CASE WHEN description = '讨论各类话题' THEN 'Discuss general topics' ELSE description END WHERE slug = 'general' AND name = '综合讨论'`,
    },
    {
      label: 'oauth_providers wechat_open',
      count: `SELECT count(*)::int AS n FROM oauth_providers WHERE provider = 'wechat_open' AND display_name = '微信扫码'`,
      update: `UPDATE oauth_providers SET display_name = 'WeChat Scan' WHERE provider = 'wechat_open' AND display_name = '微信扫码'`,
    },
    {
      label: 'oauth_providers wechat_mp',
      count: `SELECT count(*)::int AS n FROM oauth_providers WHERE provider = 'wechat_mp' AND display_name = '微信公众号'`,
      update: `UPDATE oauth_providers SET display_name = 'WeChat Official Account' WHERE provider = 'wechat_mp' AND display_name = '微信公众号'`,
    },
    {
      label: 'oauth_providers wechat_miniprogram',
      count: `SELECT count(*)::int AS n FROM oauth_providers WHERE provider = 'wechat_miniprogram' AND display_name = '微信小程序'`,
      update: `UPDATE oauth_providers SET display_name = 'WeChat Mini Program' WHERE provider = 'wechat_miniprogram' AND display_name = '微信小程序'`,
    },
    {
      label: 'message_providers aliyun email',
      count: `SELECT count(*)::int AS n FROM message_providers WHERE channel = 'email' AND provider = 'aliyun' AND display_name = '阿里云邮件推送'`,
      update: `UPDATE message_providers SET display_name = 'Aliyun DirectMail' WHERE channel = 'email' AND provider = 'aliyun' AND display_name = '阿里云邮件推送'`,
    },
    {
      label: 'message_providers aliyun sms',
      count: `SELECT count(*)::int AS n FROM message_providers WHERE channel = 'sms' AND provider = 'aliyun' AND display_name = '阿里云短信'`,
      update: `UPDATE message_providers SET display_name = 'Aliyun SMS' WHERE channel = 'sms' AND provider = 'aliyun' AND display_name = '阿里云短信'`,
    },
    {
      label: 'message_providers tencent sms',
      count: `SELECT count(*)::int AS n FROM message_providers WHERE channel = 'sms' AND provider = 'tencent' AND display_name = '腾讯云短信'`,
      update: `UPDATE message_providers SET display_name = 'Tencent Cloud SMS' WHERE channel = 'sms' AND provider = 'tencent' AND display_name = '腾讯云短信'`,
    },
    {
      label: 'storage_providers local',
      count: `SELECT count(*)::int AS n FROM storage_providers WHERE slug = 'local' AND display_name = '本地存储'`,
      update: `UPDATE storage_providers SET display_name = 'Local Storage' WHERE slug = 'local' AND display_name = '本地存储'`,
    },
    {
      label: 'storage_providers aliyun-oss',
      count: `SELECT count(*)::int AS n FROM storage_providers WHERE slug = 'aliyun-oss' AND display_name = '阿里云 OSS'`,
      update: `UPDATE storage_providers SET display_name = 'Aliyun OSS' WHERE slug = 'aliyun-oss' AND display_name = '阿里云 OSS'`,
    },
    {
      label: 'shop_items Dragon Frame demo',
      count: `SELECT count(*)::int AS n FROM shop_items WHERE name = '神龙降世'`,
      update: `UPDATE shop_items SET name = 'Dragon Frame', description = 'Demo golden dragon avatar frame' WHERE name = '神龙降世'`,
    },
    {
      label: 'captcha_providers cap displayName',
      count: `SELECT count(*)::int AS n FROM captcha_providers WHERE provider = 'cap' AND display_name = 'Cap (自托管 PoW)'`,
      update: `UPDATE captcha_providers SET display_name = 'Cap (self-hosted PoW)' WHERE provider = 'cap' AND display_name = 'Cap (自托管 PoW)'`,
    },
    {
      label: 'system_settings site_description default',
      count: `SELECT count(*)::int AS n FROM system_settings WHERE key = 'site_description' AND value = '一个基于 Node.js 和 React 的现代化论坛系统'`,
      update: `UPDATE system_settings SET value = 'A modern forum built with Node.js and React' WHERE key = 'site_description' AND value = '一个基于 Node.js 和 React 的现代化论坛系统'`,
    },
  ];

  // Ad slots: only rename when name still matches exact Chinese seed for known codes.
  const adSlotRenames = [
    ['home_header_banner', '首页顶部横幅', 'Home header banner', '显示在首页顶部的横幅广告位', 'Banner slot at the top of the home page'],
    ['home_footer_banner', '首页页脚上方横幅', 'Home footer banner', '显示在首页页脚上方的横幅广告位', 'Banner slot above the home page footer'],
    ['home_sidebar_top', '首页侧边栏顶部', 'Home sidebar top', '显示在首页侧边栏顶部的广告位', 'Ad slot at the top of the home sidebar'],
    ['home_sidebar_bottom', '首页侧边栏底部', 'Home sidebar bottom', '显示在首页侧边栏底部的广告位', 'Ad slot at the bottom of the home sidebar'],
    ['topic_list_inline', '首页话题列表内嵌', 'Topic list inline', '显示在首页话题列表中间的广告位', 'Inline ad slot inside the home topic list'],
    ['topic_detail_top', '话题详情顶部', 'Topic detail top', '显示在话题详情页顶部的广告位', 'Ad slot at the top of the topic detail page'],
    ['topic_detail_bottom', '话题详情底部', 'Topic detail bottom', '显示在话题详情页底部的广告位', 'Ad slot at the bottom of the topic detail page'],
    ['topic_sidebar_top', '话题侧边栏顶部', 'Topic sidebar top', '显示在话题详情页侧边栏顶部的广告位', 'Ad slot at the top of the topic detail sidebar'],
    ['topic_sidebar_bottom', '话题侧边栏底部', 'Topic sidebar bottom', '显示在话题详情页侧边栏底部的广告位', 'Ad slot at the bottom of the topic detail sidebar'],
  ];
  for (const [code, oldName, newName, oldDesc, newDesc] of adSlotRenames) {
    plans.push({
      label: `ad_slots ${code}`,
      count: `SELECT count(*)::int AS n FROM ad_slots WHERE code = $1 AND name = $2`,
      countParams: [code, oldName],
      update: `UPDATE ad_slots SET name = $1, description = CASE WHEN description = $2 THEN $3 ELSE description END WHERE code = $4 AND name = $5`,
      updateParams: [newName, oldDesc, newDesc, code, oldName],
    });
  }

  console.log(`[normalize-i18n] ${dryRun ? 'DRY RUN' : 'APPLY'} on loopback database`);
  let total = 0;
  try {
    await client.query('BEGIN');
    for (const plan of plans) {
      let n = 0;
      try {
        n = (await client.query(plan.count, plan.countParams || [])).rows[0].n;
      } catch (error) {
        console.log(`  skip ${plan.label}: ${redact(error.message)}`);
        continue;
      }
      if (!n) {
        console.log(`  ok   ${plan.label}: 0 rows`);
        continue;
      }
      if (!dryRun) await client.query(plan.update, plan.updateParams || []);
      total += n;
      console.log(`  ${dryRun ? 'would' : 'updated'} ${plan.label}: ${n} row(s)`);
    }
    if (dryRun) await client.query('ROLLBACK');
    else await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await client.end().catch(() => {});
  }
  console.log(`[normalize-i18n] done; matched rows=${total}`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error('[normalize-i18n] FAIL:', redact(error.message || String(error)));
    process.exitCode = 1;
  });
}
