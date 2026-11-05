# PBN Service Configuration & Functional Credit Reward Rules

**Date:** 2026-11-05  
**Machine:** DESKTOP — MÁY BÀN  
**Repo:** `D:\workspace-2026\pbn`  
**Scope:** Forum-local services + activity reward/fee runtime. No OPS-SERVER / contract changes. No commit/push.

## 1. Summary

Admin can edit **service name, description, VND base price, duration in days, and enablement** for Forum-local commercial services.  
Activity reward/fee rules are configured in **VND**, with Credit shown as reference. Live handlers run through **`activity-rules-v1`** (not by reopening legacy HTTP 410 tip/check-in routes).

## 2. Files changed

### Backend
- `apps/api/src/extensions/ledger/engagement.js` — allow grants when `metadata.engine === activity-rules-v1`
- `apps/api/src/extensions/ledger/rewardRules.js` — VND unit, `enabled` toggle, honest runtime labels
- `apps/api/src/extensions/ledger/utils/money.js` — **new** shared VND helpers
- `apps/api/src/extensions/ledger/services/activityRewardService.js` — **new** idempotent grant/deduct + check-in
- `apps/api/src/extensions/ledger/index.js` — decorate `activityRewards`
- `apps/api/src/extensions/ledger/routes.js` — reward-rules VND PATCH; `/ledger/activity/check-in`
- `apps/api/src/extensions/ledger/tests/reward-rules.test.js` — updated
- `apps/api/src/extensions/forum-local-pricing/services/localPricingService.js` — name/description/`durationDays`
- `apps/api/src/modules/forum/routes/topics/index.js` — topic create grant
- `apps/api/src/modules/forum/routes/posts/index.js` — reply fee + like grant
- `apps/api/src/routes/auth/register.js` — invite grant via activity engine
- `apps/api/src/extensions/rewards/listeners.js` — log wording
- `apps/api/src/extensions/rewards/api` path unchanged (HTTP 410 preserved on `/api/check-in`)

### Frontend
- `apps/web/src/extensions/ledger/utils/money.js` — **new** `formatVnd` / `formatCredit` / `parseVndInput`
- `apps/web/src/extensions/ledger/components/admin/LedgerPaidServices.jsx` — name/desc/days/toggle
- `apps/web/src/extensions/ledger/components/admin/LedgerRewardRules.jsx` — VND input, per-row toggle, status
- `apps/web/src/extensions/rewards/api/index.js` — check-in → `/ledger/activity/check-in`
- `apps/web/src/extensions/rewards/components/AutoCheckIn.jsx` — toast on amount > 0
- `apps/web/src/i18n/messages/en-US.json`, `vi-VN.json`, `namespaces.json`
- `apps/web/scripts/ensure-ledger-i18n.mjs`

## 3. Rules that are truly active

| Key | Runtime | Handler |
|-----|---------|---------|
| `check_in_base_amount` | **Active** | `POST /api/ledger/activity/check-in` |
| `check_in_streak_bonus` | **Active** | same (streak days, capped) |
| `post_topic_amount` | **Active** | topic create when immediately approved |
| `receive_like_amount` | **Active** | like → author (no self-like) |
| `invite_reward_amount` | **Active** | register with valid invite code |
| `post_reply_amount` | **Active** | reply fee (non-negative VND → Credit deduct) |

Admin **enable** flag + value > 0 required. Disabled or 0 VND → no ledger movement.

## 4. Rules still unsupported (honest UI)

| Key | Status | Reason |
|-----|--------|--------|
| `reward_min_amount` | **Not supported** | Tip API remains HTTP 410 |
| `reward_max_amount` | **Not supported** | Tip API remains HTTP 410 |
| `register_amount` | **Not supported** | Legacy unused / read-only |
| `registration_reward_amount` | **Not supported** | Legacy unused / read-only |

Legacy `POST/GET /api/check-in` and tip `POST /api/rewards/reward` stay **410**. New check-in uses `/api/ledger/activity/check-in` only.

## 5. Anti double credit / fee

- Idempotency: lookup existing `sys_transactions` by `(userId, type, referenceType, referenceId)` before grant/deduct.
- Check-in: one grant per Forum calendar day (`Asia/Ho_Chi_Minh`) via `referenceId = YYYY-MM-DD_userId` + `user_check_ins` unique user row.
- Topic: `referenceId = topicId`.
- Like: `referenceId = postId_likerId` (re-like after unlike does not re-grant).
- Invite: `referenceId = invite_{newUserId}`.
- Reply fee: balance pre-check; deduct after insert with `referenceId = postId`.
- Daily activity grant cap default: **100 Credit / day** (`DEFAULT_DAILY_ACTIVITY_CAP_CREDIT`). Optional future config key `daily_activity_reward_cap_vnd` (not auto-written). Cap does **not** rewrite existing policy rows.

## 6. Unified VND configuration

- Admin inputs are **VND integers** for services and reward rules.
- Display: `formatVnd` + reference `formatCredit(vnd, creditVnd)`.
- Ledger still stores **integer Credits**.
- Save rejects VND amounts not divisible by `creditVnd` (no silent float / no auto `×10000` on legacy Credit rows).
- Legacy config without `valueUnit` is treated as **Credit** for display conversion only (compat).
- **Limitation:** with `creditVnd = 10000`, values like `5.000 VND ≈ 0,5 Credit` can be **shown** but **cannot be granted** until divisible (e.g. `10.000 VND = 1 Credit`) or PO lowers rate / upgrades ledger precision. Documented — not silently rounded into ledger writes.

## 7. Service configuration

- `options.name`, `options.description` editable; `service_code` / SKU unchanged.
- Pin duration: Admin enters **days** → stored `durationSeconds = days * 86400` (+ `durationDays` mirror).
- Existing purchase snapshots unchanged; only new purchases use new duration/price.
- Enable off → no new purchases; existing entitlements keep running until expiry.
- Free Mode unchanged: effective price 0, base price preserved, no fake Debit 0; does not force-enable reward rules.

## 8. Database changes

- **No schema migration.**
- Data writes only when Admin saves services/rules (options JSON / `sys_currencies.config`).
- No balance/history reset.

## 9. Verification

| Check | Result |
|-------|--------|
| `node --test …/reward-rules.test.js` | **PASS** 11/11 |
| `node --test …/ledger-i18n.test.mjs` | **PASS** 3/3 |
| API `GET /api` | **PASS** |
| `GET /api/ledger/reward-rules` unauth | **401** |
| `POST /api/ledger/activity/check-in` unauth | **401** |
| Legacy `POST /api/check-in` | **410** (preserved) |
| Admin UI screenshot (logged-in) | **Not captured** — Web briefly down during restart; no fixture admin session in this run |
| Full E2E purchase pin / topic / like / invite with fixture users | **Not run** — avoid touching real balances; recommend fixture users next |

### Recommended fixture E2E (next session)

1. Admin: rename pin service, set 1/7/30 days, toggle off/on.  
2. Fixture user: buy pin → list order → expiry job.  
3. Enable `post_topic_amount=10000` VND → create topic → +1 Credit once; retry no second grant.  
4. Enable reply fee → reply with insufficient balance blocked; success deducts once.  
5. Like another user’s post → author +Credit; self-like no grant.  
6. Check-in twice same day → second is no-op.  
7. Switch VI/EN on `/dashboard/ledger?tab=services`.

## 10. Screenshots

- Unauthenticated gate: `docs/audit/ledger-services-unauth.png` (route requires Sign in).
- Logged-in Admin table screenshot: capture after signing in at `/dashboard/ledger?tab=services`.

## 11. Decisions for Product Owner

1. Accept integer-Credit floor for activity grants, or change `creditVnd` / ledger precision to support `0,5 Credit`.  
2. Keep tip min/max keys for future tip product, or hide/remove from Admin table.  
3. Whether pending (moderated) topics should grant on **approval** (today: only immediate approve).  
4. Whether reply-fee failure after insert should hard-roll back the post (today: log only after successful create).  
5. Confirm 100 Credit/day activity cap default.

## 12. Limits honored

- No OPS-SERVER edits  
- No `forum-credit/1` / `forum-pricing/1` contract changes  
- No DB reset / history wipe / real-user balance test burns  
- No git commit / push  
- Existing Git work preserved  
