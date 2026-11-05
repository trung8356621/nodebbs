# PBN Local Pricing & Editable Credit Rules — Final Report

**Date:** 2026-11-04  
**Machine:** DESKTOP — PBN (`D:\workspace-2026\pbn`)  
**Scope:** Forum-primary local pricing; OPS optional; no OPS-SERVER edits; no commit/deploy.

## A. Current vs target architecture

| Area | Before | Target / Now |
|------|--------|--------------|
| Paid Pin price authority | OPS `forum-pricing/1` catalog only | Forum VND base + optional OPS override/ban + Free Mode |
| SEO entitlement price | OPS/legacy snapshot | Forum-local product when `forum-local-pricing` present |
| Credit packages | OPS | Unchanged (not a Forum service row) |
| OPS enrollment | Required to configure/buy pin | Optional |
| Credit reward rules | Mostly read-only UI | Editable persist; runtime badge honest |
| Forum→OPS service push | N/A | **BLOCKED** — 501 + contract doc |

## B. Implemented local pricing capabilities — IMPLEMENTED

- Tables: `forum_local_services`, `forum_local_service_price_history`, `forum_ops_service_policies`, `forum_commercial_settings`
- Baseline: `apps/api/baseline/0009_forum_local_pricing.sql` (incl. Free Mode pin constraint)
- Extension: `apps/api/src/extensions/forum-local-pricing/`
- Admin API: `GET/PATCH /api/forum/local-pricing/services…`, Free Mode, history, sync stub
- Effective precedence: OPS ban → Free Mode → OPS override → Forum base
- Append-only price history; base price never overwritten by override
- Paid Pin plans/purchase use local effective Credit (VND→Credit at boundary)
- Free Mode: price 0, skip debit, nullable `transaction_id`
- Services UI on `/dashboard/ledger?tab=services`
- Sync button: **Chưa hỗ trợ** / HTTP 501 (does not pretend success)

## C. Services table screenshots — TESTED

- `.local/ledger-services-verify/services-table-vi.png`
- VI UI: Paid Pin 50.000₫ / 5 Credit, SEO 30.000₫ / 3 Credit, Free Mode toggle, sync **Chưa hỗ trợ**, editable reward rules with honest runtime badges.

## D. Price-history behavior — IMPLEMENTED

- Each admin save bumps `local_price_version` and inserts history row
- History API append-only; no update/delete endpoints
- Purchases snapshot `pricing_version` / authority on entitlement rows

## E. Credit rule editability matrix — IMPLEMENTED (persist) / execution honest

| Key | Editable | Runtime |
|-----|----------|---------|
| check_in_base_amount | Yes | Retired (410) |
| check_in_streak_bonus | Yes | Retired |
| post_topic_amount | Yes | Not wired / Chưa hỗ trợ thực thi |
| receive_like_amount | Yes | Not wired |
| invite_reward_amount | Yes | Retired |
| register_amount | Yes | Not wired (legacy alias) |
| registration_reward_amount | Yes | Not wired (legacy alias) |
| post_reply_amount | Yes | Active only if &lt; 0 |
| reward_min_amount | Yes | Retired tip |
| reward_max_amount | Yes | Retired tip |

Unknown keys preserved on save. Bounds validated server-side.

## F. Retired rewards that can safely be reactivated — DESIGN ONLY

| Rule | Missing before reactivation |
|------|-----------------------------|
| Check-in | Re-open grant path with daily/idempotency; keep engagement 410 for other types |
| Invite | Product flag + anti-abuse + single grant per invitee |
| Tip min/max | Tip transfer API + ledger audit |
| Topic / like | Event listeners + spam/delete guards |
| Register aliases | Do **not** dual-activate — pick one key |

Global `engagement.js` 410 **retained**.

## G. Free Mode — IMPLEMENTED (unit) / E2E pending

- Unit: Free Mode forces 0 Credit without mutating base (local-pricing.test.js)
- Purchase path skips `ledger.deduct` when price=0
- Constraint migration allows `price=0 AND transaction_id IS NULL`
- Live E2E against balances: **not run** (per safety)

## H. Paid Pin E2E — DESIGN fixtures / partial

| Case | Status |
|------|--------|
| Local price without OPS | IMPLEMENTED in code |
| Override / ban | IMPLEMENTED via `acceptOpsPolicy` + resolve |
| Insufficient Credit | Existing ledger deduct |
| Idempotent retry | Existing pin idempotency key |
| Free Mode no charge | IMPLEMENTED |
| Expiry | Existing `pins.expire` |
| Admin manual pin independent | Untouched |
| Live purchase vs user balances | **Not run** |

## I. Required OPS sync contract — DESIGN ONLY / BLOCKED

See `docs/audit/PBN-FORUM-OPS-SERVICE-SYNC-CONTRACT.md`.  
Do **not** claim sync works. Do **not** reuse `forum-pricing/1` for Forum-base push.

## J. Files / migrations / tests

### Migration

- `apps/api/baseline/0009_forum_local_pricing.sql` — additive; apply with `psql` / dotenvx against `pbn_dev`

### Key files

- `apps/api/src/extensions/forum-local-pricing/**`
- `apps/api/src/modules/forum/services/pinService.js`
- `apps/api/src/modules/forum/routes/pins/index.js`
- `apps/api/src/modules/forum/services/seo/service.js`
- `apps/api/src/extensions/ledger/rewardRules.js`
- `apps/web/src/extensions/ledger/components/admin/LedgerPaidServices.jsx`
- `apps/web/src/extensions/ledger/components/admin/LedgerRewardRules.jsx`
- `apps/web/scripts/ensure-ledger-i18n.mjs`

### Tests

- `node --test apps/api/src/extensions/forum-local-pricing/tests/local-pricing.test.js`
- `node --test apps/api/src/extensions/ledger/tests/reward-rules.test.js`
- `node --test apps/web/src/i18n/ledger-i18n.test.mjs` (after ensure script)

### Explicitly not done

- OPS-SERVER code / VPS deploy
- Git commit / push
- Destructive migrations
- Reactivating engagement grants
- Claiming OPS sync success
