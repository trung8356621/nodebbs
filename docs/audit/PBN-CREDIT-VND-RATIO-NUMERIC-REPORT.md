# PBN Credit Display Ratio & Fractional VND Save

**Date:** 2026-11-05  
**Machine:** DESKTOP  
**Repo:** `D:\workspace-2026\pbn`

## A. Root cause

Admin configures rewards in **VND**, but ledger previously stored **integer Credits** (`bigint` + `Number.isSafeInteger`). Saving `5.000 VND` with `creditVnd=10000` (= `0,5 Credit`) was rejected.

## B. Storage plan (implemented)

| Item | Decision |
|------|----------|
| Approach | **PostgreSQL `NUMERIC(30,10)`** for `sys_accounts.balance/total_*` and `sys_transactions.amount/balance_after` |
| Existing balances | **Cast in place** (`USING balance::numeric`) — values unchanged (5 stays 5). **No × / ÷** |
| History | Prior integer amounts become `5.0000000000` numerically identical |
| OPS `forum-credit/1` | Still grants **integer** Credits; integers ⊂ numeric — contract unchanged |
| JS money math | BigInt long division → decimal **strings** (no IEEE float for 0.2 / 0.5) |
| Alternative rejected | Fixed-point microcredits with scale factor would require multiplying all balances — **not done** |

### Migration

- File: `apps/api/baseline/0010_ledger_credit_numeric.sql`
- Applied on local `pbn_dev` via `src/scripts/apply-0010-ledger-numeric.mjs`
- Also creates `forum_credit_vnd_rate_history`

**PO note:** This is a financial column-type change that does **not** revalue balances. If another environment needs the same fix, run the baseline SQL (or the apply script) once. No reset / no history rewrite.

## C. Editable Credit display ratio

- Setting: `forum_commercial_settings.vnd_per_credit` (Forum-local; **no OPS required**)
- API: `GET/PATCH /api/forum/local-pricing/settings/vnd-per-credit`
- History: `forum_credit_vnd_rate_history` (old/new, actor, effectiveAt)
- UI: compact card above services table on `/dashboard/ledger?tab=services`
- Forum rate is authoritative for Admin display + activity rewards (OPS catalog rate shown as reference only)

### Rate-change rules

- Configured reward **VND values unchanged** when rate changes
- Past transactions keep `metadata.creditVnd` / `valueVnd` snapshots where written
- Balances are **not** repriced
- New grants/fees use the **current** rate at event time
- Changing 10.000 → 5.000 changes display Credit for the same VND rule going forward (e.g. 5.000 VND: 0,5 → 1 Credit)

## D. VND save fix

- Removed “must be divisible by creditVnd” validation
- Allowed: 0 / 1.000 / 2.000 / 5.000 / 10.000 / 50.000 VND
- Exact Credit via `vndToCreditAmount` (e.g. `5000/10000 → "0.5"`)

## E. Tests

| Check | Result |
|-------|--------|
| Unit: fractional VND merge + money helpers | **PASS** |
| Local migration `balance` type = numeric | **PASS** |
| Rate history table exists | **PASS** |
| Full logged-in E2E grant 0.5 Credit | Deferred (no fixture burn of real balances) |

## F. Limits honored

- No OPS-SERVER edits / no contract change  
- No DB reset / no balance rewrite / no history deletion  
- No commit/push  

## G. Follow-ups (optional)

1. `pin_entitlements.price` is still bigint — fractional **service** Credit prices still use `Math.ceil` for pin checkout compatibility.  
2. Capture Admin UI screenshot after login.  
3. Apply `0010_ledger_credit_numeric.sql` on any other Forum DB before deploying this code.
