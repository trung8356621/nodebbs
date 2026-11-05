# PBN Deep Vietnamese Localization & UTF-8 Cleanup Report

**Date:** 2026-11-05  
**Machine:** DESKTOP — MÁY BÀN  
**Repo:** `D:\workspace-2026\pbn`  
**Scope:** Forum A local stack only (no OPS-SERVER / VPS / contract changes)

## Executive summary

Catalog parity was already strong (`check-i18n` green before this work). Remaining user-visible Chinese came mainly from **DB seed/display defaults**, **email templates**, and **site settings**, not from missing `vi-VN`/`en-US` message files.

This pass:

1. Normalized known Chinese seed display names to English technical identities.
2. Localized verification/welcome emails (VI default, EN fallback).
3. Hardened currency UI labels so Chinese leftovers cannot surface for known codes.
4. Forced UTF-8 console code page for Windows `pnpm dev` children.
5. Expanded automated i18n checks.
6. Applied a safe conditional data normalizer on the local `pbn_dev` database.

## A. Issues found

| Category | Finding | Severity |
|----------|---------|----------|
| UI catalogs | EN/VI parity OK (2931→2933 keys); no Han in locale values | — |
| Raw keys | No `common.ledger*` / `Pending translation` in catalogs | — |
| DB currencies | Seed historically used `积分` / `金币`; local DB already had English names | P0 (seed) |
| DB category `general` | Still `综合讨论` until normalize | P0 |
| OAuth / message / storage / captcha / ads / shop seeds | Chinese `displayName` / `name` | P0–P1 |
| Emails | Verification + welcome fully Chinese | P0 |
| Site setting | `site_description` default Chinese and stored in DB | P0 |
| Ledger adjust descriptions | Admin grant/deduct defaults Chinese | P1 |
| API canonical errors | Still Chinese `source.json` match pipeline (translated on send) | P2 (architecture) |
| Plugin startup logs | Many Chinese log banners | P2 (encoding/content) |
| Admin setting meta | `systemSettings.js` category/description text still Chinese (admin-only) | P2 |
| Historical ledger `description` rows | May still contain Chinese text | Leave / UI map later |
| UGC | Topics/posts/custom categories | Leave alone |

## B. Fixes applied

### Seeds / config (new installs)

- `apps/api/src/scripts/init/ledger.js` → `Credit` / `Gold` + English rule descriptions
- `categories.js` → `General`
- `oauth.js` → WeChat Scan / Official Account / Mini Program
- `message.js` → Aliyun DirectMail / Aliyun SMS / Tencent Cloud SMS
- `storage.js` → Local Storage / Aliyun OSS
- `shop.js` → `Dragon Frame`
- `ads.js` → English slot names/descriptions
- `captcha.js` → `Cap (self-hosted PoW)`
- `systemSettings.js` → English `site_description` default
- Email templates rewritten locale-aware (`vi-VN` default, `en-US` fallback)
- Verification configs: English `description` + `typeKey`
- Ledger admin grant/deduct default descriptions → English
- Startup listen log → `[system] API listening at …`

### UI

- `currencyLabels.js` + wired into CreditsBadge, wallet, transactions, ledger overview, shop admin table
- i18n keys: `currencyNameCredits` / `currencyNameGold` (EN: Credits/Gold, VI: Điểm Credit/Vàng)

### UTF-8

- `scripts/dev.mjs` Windows spawn: `chcp 65001 >nul & pnpm.cmd run dev`
- Confirmed Chinese plugin logs and Vietnamese UI render correctly under UTF-8 session
- Fixed mojibake comment in `moderation/index.js`

### Automation

- Expanded `scripts/check-i18n.mjs`:
  - namespace registry consistency
  - broken Unicode (`U+FFFD`)
  - raw key values
  - seed display Han scan
  - email template Han scan
- New: `scripts/normalize-i18n-defaults.mjs` (conditional UPDATE only)

## C. Database rows normalized (local `pbn_dev`)

Applied via `node scripts/normalize-i18n-defaults.mjs` (20+ matched rows on first apply; site_description on second apply):

- categories `general`
- oauth_providers (3 WeChat rows)
- message_providers (Aliyun/Tencent)
- storage_providers (local, aliyun-oss)
- shop_items `神龙降世` → Dragon Frame
- captcha_providers Cap display name
- ad_slots (9 default codes)
- system_settings `site_description` exact Chinese default → English

**Not changed:** balances, prices, IDs, slugs, codes, FKs, transaction history amounts, user-edited non-matching values.

Currencies `credits`/`gold` already English in this DB (0 rows).

## D. Intentionally kept

| Item | Why |
|------|-----|
| API `source.json` Chinese templates | Canonical match keys for response translation; changing requires large API rewrite |
| Web `source-messages.json` | Legacy notification matching |
| Historical `sys_transactions.description` | May be operator/user context; UI already maps many types |
| Admin-only Chinese meta in `systemSettings.js` descriptions/categories | Needs dedicated admin i18n pass |
| Remaining Chinese in code comments / plugin log banners | Not UI; UTF-8 console handles display |
| User-generated content | Out of scope |

## E. Files changed (high level)

- `scripts/dev.mjs`, `scripts/check-i18n.mjs`, `scripts/normalize-i18n-defaults.mjs`
- `apps/api/src/app.js`
- `apps/api/src/config/systemSettings.js`
- `apps/api/src/scripts/init/{ledger,categories,oauth,message,storage,shop,ads,captcha}.js`
- `apps/api/src/plugins/message/**` (emails, verification config, index)
- `apps/api/src/extensions/ledger/routes.js` + reward-rules test
- `apps/api/src/routes/moderation/index.js` (comment encoding)
- `apps/web/src/extensions/ledger/utils/currencyLabels.js` + consumers
- `apps/web/src/i18n/messages/{en-US,vi-VN}.json`, `namespaces.json`
- `docs/audit/PBN-DEEP-I18N-UTF8-REPORT.md`, `docs/audit/i18n-home-vi.png`

## F. Migration / operator commands

```bash
# Already applied on this desktop DB. For other local DBs:
node scripts/normalize-i18n-defaults.mjs --dry-run
node scripts/normalize-i18n-defaults.mjs

# Gate
node scripts/check-i18n.mjs

# Stack
pnpm dev
```

No Drizzle schema migration required (data-only updates).

## G. Verification

| Check | Result |
|-------|--------|
| `node scripts/check-i18n.mjs` | **PASS** (0 errors) |
| `pnpm dev` READY | **PASS** |
| API `GET /api` | **PASS** `status=ok` |
| Web `GET /` | **PASS** 200 |
| Redis PONG | **PASS** |
| Home VI UI | **PASS** (Đăng nhập, Trang chủ, …) — `docs/audit/i18n-home-vi.png` |
| Home EN UI | **PASS** (Sign in, Home, About…) — `docs/audit/i18n-home-en.png` |
| About widget | **PASS** English site description after normalize |
| Category chip `General` | **PASS** |
| Terminal UTF-8 | **PASS** Chinese plugin logs readable; listen line ASCII |
| Login API dependency | Stack up with Redis (prior orchestrator work) |

## H. Remaining / confirm with Product Owner

1. **Admin settings category labels** still Chinese in `systemSettings.js` metadata (admin dashboard).
2. **API Chinese canonical error strings** long-term migration to English keys.
3. **Historical Chinese transaction descriptions** — translate in UI by pattern allowlist vs leave raw.
4. **Site name / other operator-edited settings** — only exact default Chinese values were rewritten; custom Chinese site copy left alone.
5. Confirm whether `site_description` English default is acceptable for Forum A branding (can set Vietnamese copy in Admin → Settings).

## I. Screenshots

- After VI home: `docs/audit/i18n-home-vi.png`
- After EN home: `docs/audit/i18n-home-en.png`
- About widget Chinese blurb removed (now English technical default; operators may set Vietnamese copy in Admin → Settings).

## J. Non-goals respected

- No OPS-SERVER / VPS / production env edits
- No `forum-credit/1` or `forum-pricing/1` contract changes
- No ledger balance / price / history deletion
- No DB reset
- No git commit / push
