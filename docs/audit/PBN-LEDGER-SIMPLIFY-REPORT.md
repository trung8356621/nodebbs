# PBN Ledger simplify — report (2026-11-04)

Machine: DESKTOP PBN · Repo: `D:\workspace-2026\pbn` · No OPS-SERVER/VPS changes.

## A. Root cause of UI/API regressions

1. **`ledgerApi.getRewardRules is not a function`**  
   Methods existed in `extensions/ledger/api/index.js`, but the client path was fragile under HMR/re-exports. Reward Rules now call `api.get/patch('/ledger/reward-rules')` directly from `@/lib/api`.

2. **Literal `common.ledger*` labels**  
   Keys were present after upsert but UI still needed a hard refresh of messages/namespaces. Re-ran `ensure-ledger-i18n.mjs` and added the new compact-UI keys. Browser check: **no literal keys**.

## B. Final UI structure

`/dashboard/ledger` tabs (4):

1. Tổng quan  
2. Lịch sử giao dịch  
3. Quản lý tiền tệ (identity-only; preserves `config`)  
4. **Dịch vụ & quy tắc** — compact services table + reward rules  

Removed tab: Lịch sử dịch vụ (API/component kept). SEO history readable at `/dashboard/seo?tab=history`. Pins/SEO catalog redirects → `tab=services`. OPS diagnostics stay on **Kết nối OPS**.

## C–D. Screenshots

- Services table: `.local/ledger-fix-verify/ledger-services-compact-vi.png`
- Reward rules: `.local/ledger-fix-verify/ledger-reward-rules-compact-vi.png`

## E. Pricing capability matrix

| Capability | Status |
|---|---|
| Show live SEO legacy prices | **Implemented** (runtime) |
| Show OPS pin catalog prices | **Implemented when catalog exists** (currently missing store → —) |
| Forum-base local pin price | **Missing** (OPS-authoritative today) |
| OPS ban / override precedence | **Not implemented** (still forum-pricing/1 signed catalog authority) |
| Standalone without OPS | **Partial** — SEO legacy can show; pins unavailable without catalog |
| Free Mode (all prices 0, fulfill anyway) | **Missing** — pin path requires `price >= 1` and DB check `price > 0` |
| Immutable purchase price snapshot | **Exists** for SEO/pins purchases historically |
| Credit packages in service catalog | **Removed from UI** (wallet/OPS flow) |

## F. SEO → Paid Member badge

**STOP for PO approval.** SEO is topic-scoped and drives outbound link `rel` policy. Badges are account-wide cosmetic with **no** top-up→badge path. Converting historical SEO entitlements to an account-wide badge would change link behavior or expand paid-link scope. History preserved; no migration performed.

## G. Paid Pin E2E

**Not PASS (blocker).** No fixture E2E run against live user balances (policy). Current code cannot satisfy Free Mode acceptance (`price >= 1` in `pinService`, `pin_entitlements` check `price > 0`). Unit contract tests for forum-pricing paid_pin: **PASS**. Live pin products API: `PRICE_UNAVAILABLE` until baseline 0007 + OPS sync.

## H. Files changed (this task slice)

- `apps/web/.../LedgerAdminPage.jsx` — 4 tabs  
- `apps/web/.../LedgerPaidServices.jsx` — compact table  
- `apps/web/.../LedgerRewardRules.jsx` — compact table + direct API  
- `apps/web/src/app/dashboard/seo/page.js` — history still readable  
- `apps/api/.../rewardRules.js` — edit only active-supported keys  
- `apps/web/scripts/ensure-ledger-i18n.mjs` + messages/namespaces  
- tests + this report  

## I. Tests

| Suite | Result |
|---|---|
| `reward-rules.test.js` | **PASS** 7/7 |
| `ledger-i18n.test.mjs` | **PASS** 3/3 |
| forum-credit + forum-pricing contract | **PASS** 39 combined in last run |
| Paid Pin live E2E | **FAIL / blocked** (see G) |

## J. OPS contract changes needed later

Moving from OPS-authoritative signed catalogs to **Forum-base + OPS override/ban** requires a new/extended contract (not silent reuse of forum-pricing/1). Needs OPS counterpart for override payloads, ban flags, validity, and PBN persistence of overrides across outages. Free Mode and VND-canonical display also need coordinated design.
