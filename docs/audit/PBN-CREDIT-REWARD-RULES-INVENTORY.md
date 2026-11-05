# PBN Credit reward/spend rules inventory (Phase A + B)

**Date:** 2026-11-04  
**Machine:** DESKTOP — PBN (`T--rung`)  
**Repo:** `D:\workspace-2026\pbn`  
**Scope:** Local `sys_currencies.config` for `credits` only. OPS commercial pricing is separate.

## A. Config key inventory (seed + live `pbn_dev`)

| Key | Seed | Live DB | VN label | Readers | Runtime | Effect | Admin edit | Ownership |
|-----|------|---------|----------|---------|---------|--------|------------|-----------|
| `check_in_base_amount` | 10 | 0 | Thưởng điểm danh cơ bản | `rewardService.checkIn` | **Retired (410)** | grant (dead) | Persist-only | local |
| `check_in_streak_bonus` | 5 | 0 | Thưởng chuỗi điểm danh | `rewardService.checkIn` | **Retired (410)** | grant (dead) | Persist-only | local |
| `post_topic_amount` | 5 | 0 | Thưởng đăng chủ đề | none | **Not wired** | unused | Persist-only | local |
| `post_reply_amount` | 2 | 0 | Phí/biến động trả lời | `forum/routes/posts` | **Active if &lt;0**; ≥0 not wired for grant | deduct if negative | Yes (fee) | local |
| `receive_like_amount` | 1 | 0 | Thưởng nhận like | none | **Not wired** | unused | Persist-only | local |
| `reward_min_amount` | 1 | 1 | Tip tối thiểu | tip route + `RewardDialog` | **Retired (410 tip)** | validation | Persist-only | local |
| `reward_max_amount` | 1000 | 1000 | Tip tối đa | tip route + `RewardDialog` | **Retired (410 tip)** | validation | Persist-only | local |
| `invite_reward_amount` | 50 | 0 | Thưởng mời thành viên | register (off) + invitations display | **Retired grant**; display may read | grant (dead) | Persist-only | local |
| `register_amount` | — | 0 | Thưởng đăng ký (legacy) | none | **Not wired** | unused | Persist-only | local |
| `registration_reward_amount` | — | 0 | Alias đăng ký (legacy) | none | **Not wired** | unused | Persist-only | local |

`gold` exists inactive with `config=null` — not activated.

## B. Runtime status summary

- Engagement grants blocked by `engagement.js` → HTTP **410** for automatic types.
- Check-in routes, tip `POST /reward`, invite grant flag: retired/off.
- Only config-driven spend still coded: **negative `post_reply_amount`**.
- SEO / Paid Pin / Credit packages: **OPS**, not `credits.config`.

## C. UI / screenshots

- New section **「Quy tắc cộng/trừ Credit」** on `/dashboard/ledger?tab=services`.
- Currency edit dialog is identity-only; reward fields removed; identity save omits `config`.
- Screenshot: `.local/ledger-fix-verify/ledger-reward-rules-vi.png`
- Live checks: identity POST returns `configPreserved:true`; unknown key PATCH rejected; unauth GET → 401.

## D. Files changed (this task)

- `apps/api/src/extensions/ledger/rewardRules.js` (new)
- `apps/api/src/extensions/ledger/routes.js` (preserve config; GET/PATCH reward-rules)
- `apps/api/src/extensions/ledger/tests/reward-rules.test.js` (new)
- `apps/web/src/extensions/ledger/components/admin/LedgerRewardRules.jsx` (new)
- `apps/web/src/extensions/ledger/components/admin/LedgerPaidServices.jsx`
- `apps/web/src/extensions/ledger/components/admin/LedgerCurrencies.jsx`
- `apps/web/src/extensions/ledger/api/index.js`
- `apps/web/scripts/ensure-ledger-i18n.mjs` + messages/namespaces
- `apps/web/src/i18n/ledger-i18n.test.mjs`

## E. Tests

| Suite | Result |
|-------|--------|
| `reward-rules.test.js` | PASS 6/6 |
| `ledger-i18n.test.mjs` | PASS 3/3 |

## F. Reactivation would need separate backend work

- Check-in grant path + routes
- Tip transfer API
- Invite/register grant flags
- Topic/like listeners that call `ledger.grant`
- Product decision on amounts after reactivation

## G. Obsolete keys (do not delete yet)

- `register_amount`, `registration_reward_amount` — no readers
- Positive `post_reply_amount` / `post_topic_amount` / `receive_like_amount` — unused for grants

## Business constraints honored

- No second wallet / Gold activation
- No amount/balance/history changes by this task’s defaults
- No OPS contract changes
- No 410 handler re-enable
