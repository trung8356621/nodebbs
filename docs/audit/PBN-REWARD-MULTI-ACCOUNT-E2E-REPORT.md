# PBN Reward UI Cleanup & Multi-Account E2E Report

**Date:** 2026-11-05  
**Machine:** DESKTOP — PBN  
**Repo:** `D:\workspace-2026\pbn`  
**Forum under test:** Forum B (`pbn_forum_b`, API `:7200`, Web `:3200`)  
**Overall E2E:** **PASS** (see `docs/audit/PBN-REWARD-MULTI-ACCOUNT-E2E-RESULTS.json`)  
**Production / Forum A:** not mutated. Fixture users banned; `credits.config` + `registration_mode` restored after run.

---

## Summary

Admin ledger UI now separates **Dịch vụ thu phí** (`tab=services`) from **Quy tắc cộng/trừ** (`tab=reward-rules`). Limits/anti-abuse live under **Cấu hình hệ thống → Credit & chống lạm dụng** (same `credits.config` source via `/ledger/reward-rules`). Legacy keys are hidden from admin UI. Four reward rules were exercised with multi-account Forum B fixtures (`e2er_*`), verifying balances, transactions, idempotency, and anti-abuse.

---

## Files changed (this task)

### Frontend
- `apps/web/src/extensions/ledger/pages/admin/LedgerAdminPage.jsx` — split tabs; add `reward-rules`
- `apps/web/src/extensions/ledger/components/admin/LedgerPaidServices.jsx` — services only (no reward rules)
- `apps/web/src/extensions/ledger/components/admin/LedgerRewardRules.jsx` — earn/spend only; link to settings; hide legacy/limits
- `apps/web/src/extensions/ledger/components/admin/LedgerCurrencies.jsx` — links to both tabs
- `apps/web/src/app/dashboard/settings/page.js` — nav item `credit-abuse`
- `apps/web/src/app/dashboard/settings/components/CreditAbuseSettings.jsx` — **new** settings surface
- `apps/web/src/i18n/messages/en-US.json`, `vi-VN.json`, `namespaces.json`
- `apps/web/scripts/ensure-ledger-i18n.mjs`, `apps/web/src/i18n/ledger-i18n.test.mjs`

### Backend
- `apps/api/src/extensions/ledger/rewardRules.js` — `daily_activity_reward_cap_vnd`; legacy `retired`; UI group helpers
- `apps/api/src/extensions/ledger/services/activityRewardService.js` — activity clock override; safer VND rate read; daily-cap toggle
- `apps/api/src/extensions/ledger/routes.js` — `POST /ledger/admin/activity-clock` (gated by `PBN_ALLOW_ACTIVITY_CLOCK=1`)
- `apps/api/src/routes/auth/register.js` — invite grant via `afterCommit` (avoids poisoned policy `atomicWrite`)
- `apps/api/src/extensions/ledger/tests/reward-rules.test.js`

### Scripts / docs
- `scripts/test-reward-multi-account-e2e.mjs` — **new** Forum B multi-account E2E
- `docs/audit/PBN-REWARD-MULTI-ACCOUNT-E2E-RESULTS.json`
- Screenshots (below)

**Not changed:** OPS-SERVER, OPS contract, Forum A DB, history deletions. No commit/push.

---

## Screenshots (after split)

| Tab / page | File |
|------------|------|
| Dịch vụ thu phí | `docs/audit/ledger-tab-services-vi.png` |
| Quy tắc cộng/trừ | `docs/audit/ledger-tab-reward-rules-vi.png` |
| Credit & chống lạm dụng | `docs/audit/settings-credit-abuse-vi.png` |

Observed UI:

- Ledger tabs: Tổng quan · Lịch sử giao dịch · Quản lý tiền tệ · **Dịch vụ thu phí** · **Quy tắc cộng/trừ**
- Services tab: pin + SEO only, Free Mode, VND/Credit rate — **no** reward rules / OPS diagnostics dump
- Reward-rules tab: Cộng Credit + Trừ Credit only; link **Cấu hình giới hạn & chống lạm dụng**; **no** legacy group
- Settings: `credits.config` single source; daily cap + tip bounds; hardcoded policy badges (self-like, 1 check-in/day, idempotency)

---

## Active rules (runtime honest)

| Key | Group | Runtime | Notes |
|-----|-------|---------|-------|
| `check_in_base_amount` | earn | **active** | `/ledger/activity/check-in` |
| `check_in_streak_bonus` | earn | **active** | streak days (capped) |
| `post_topic_amount` | earn | **active** | topic create |
| `receive_like_amount` | earn | **active** | author grant; not self-like |
| `invite_reward_amount` | earn | **active** | afterCommit on invitation register |
| `post_reply_amount` | spend | **active** | reply fee |
| `daily_activity_reward_cap_vnd` | limits (Settings) | **active** | daily activity grant cap |
| `reward_min_amount` / `reward_max_amount` | limits (Settings) | unsupported | tip API still 410 |
| `register_amount` / `registration_reward_amount` | legacy | **retired** | hidden from UI; not editable |

---

## E2E environment (D1)

| Item | Value |
|------|-------|
| Forum | B only (`pbn_forum_b`) |
| Accounts | prefix `e2er_` (≤20 chars; maps to `e2e_reward_` intent) |
| Email/SMS | `@example.test` only; no external send |
| Clock | in-process `PBN_ALLOW_ACTIVITY_CLOCK=1` — **not** Windows/DB clock |
| Cleanup | fixture users `is_banned`; invite codes `disabled`; config restored |
| Script | `node scripts/test-reward-multi-account-e2e.mjs` |

---

## Scenario results (ledger-verified)

Source of truth: `PBN-REWARD-MULTI-ACCOUNT-E2E-RESULTS.json` (not unit tests).

### D2 Check-in — PASS
| Case | Result |
|------|--------|
| First check-in | `0 → 1` Credit; tx `check_in` ref `YYYY-MM-DD_<userId>`; `valueVnd=10000` |
| Same day again | no credit / no extra tx |
| Retry | idempotent |
| Rules disabled | balance + tx count unchanged |
| Re-enable @ 20000 VND | `+2` Credit; metadata `valueVnd=20000` |

### D3 Streak — PASS (fake clock)
| Case | Result |
|------|--------|
| Day 1 | base only (+1) |
| Day 2 consecutive | +1.5 (base + streak 0.5) |
| Skip a day | streak reset → 1; +1 only |
| Retry | no double |
| Streak rule off | base only |
| Same Forum calendar day (00:30 vs 23:30 +07) | no second grant |

### D4 Likes — PASS (2+ accounts)
| Case | Result |
|------|--------|
| A likes B’s post | author `0 → 0.2`; ref `<postId>_<likerId>` |
| Unlike + re-like | no farm (tx count stable) |
| Self-like | no grant |
| Retry | balance unchanged |
| Rule off | no grant |
| Daily cap (2000 VND) | second like grant blocked |

Topic rows for like fixtures were inserted via DB because Forum B topic API still trips `policy_decisions` update; **like/unlike APIs and ledger grants were real**.

### D5 Referral — PASS
| Case | Result |
|------|--------|
| Valid invite | inviter `0 → 2`; ref `invite_<inviteeId>` |
| Self-referral | structurally impossible (code owner precedes invitee id) |
| Second invitee | second grant (+2); distinct refs |
| Rule off | no grant |
| No code in invitation mode | HTTP 400 |
| Daily cap | second invite grant blocked |

**Bug found & fixed:** invite `grantForRule` ran inside policy `atomicWrite`; a swallowed local-pricing read aborted the PG transaction → grant failed. Fixed with `afterCommit` + safer VND rate read. Applied Forum B `0009_forum_local_pricing.sql`.

### E Ledger verification pattern
Each positive case checked: balance before → action → balance after → `sys_transactions` row → referenceId → `metadata.valueVnd` / Credit. Blocked cases proved balance and tx counts unchanged.

### F Regression smoke — PASS
| Check | Result |
|-------|--------|
| Toggle / save VND | PATCH persists |
| Credit rate readable | OK |
| Transaction history | HTTP 200 |
| Login | OK |
| VI/EN tab labels | present |
| Free Mode | independent of activity rewards |

Topic/comment browser UX regression beyond API smoke was not re-run as a full Playwright suite in this pass (topic create API on Forum B remains policy-fragile — noted above).

---

## Rules not working / unsupported

| Item | Status |
|------|--------|
| Tip min/max | Unsupported (tip API 410) — editable in Settings for future use only |
| Legacy register rewards | Retired; hidden; cannot re-enable via admin UI |
| Topic create reward E2E via HTTP | **BLOCKED** on Forum B by `policy_decisions` contentId update (500) — rule code path exists; not exercised via `/topics` HTTP here |

---

## Confirmation: no real-user impact

- Only Forum B database touched
- Fixture accounts banned after run; invitation codes disabled
- `credits.config` restored from pre-test snapshot
- `registration_mode` restored via settings API
- Forum A not reset; history not deleted; OPS untouched

---

## How to re-run

```bash
# Forum B API with activity clock (required for streak scenarios)
# PBN_ALLOW_ACTIVITY_CLOCK=1 on Forum B process env

node scripts/test-reward-multi-account-e2e.mjs
```

Unit checks (not substitutes for E2E):

```bash
cd apps/api && node --test src/extensions/ledger/tests/reward-rules.test.js
cd apps/web && node --test src/i18n/ledger-i18n.test.mjs
```
