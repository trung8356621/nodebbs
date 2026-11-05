# PBN Ledger Transaction History Standardization

**Date:** 2026-11-05  
**Machine:** DESKTOP — PBN  
**Repo:** `D:\workspace-2026\pbn`  
**Status:** Implementation + API verification complete. Browser Admin E2E stopped per instruction (no further real-admin login).

## 1. Storage unit (actual)

| Field | Unit | Type |
|-------|------|------|
| `sys_transactions.amount` | **Credit** | `NUMERIC(30,10)` |
| `sys_transactions.balance_after` | **Credit** | `NUMERIC(30,10)` |
| `sys_accounts.balance` | **Credit** | `NUMERIC(30,10)` |

Admin UI displays **VND** only when a **snapshot** allows conversion. Formatting never rewrites ledger values.

## 2. Snapshot audit (local `pbn_dev`)

| Metric | Count |
|--------|------:|
| Total transactions | 67 |
| With `creditVnd` / `valueVnd` / `vndPerCredit` snapshot | **0** |

Conclusion: **all current fixture rows are legacy for VND display**. Admin table must show `—` for VND amount/balance + **Legacy** badge; Credit remains under the amount cell and in the detail drawer. **Current Forum rate is never applied retrospectively.**

New activity-rules grants/fees are designed to write `metadata.valueVnd` + `metadata.creditVnd` going forward (covered by unit tests; no new balance-changing fixture was created in this pass).

## 3. Transaction types present

| Type | n | Notes |
|------|--:|-------|
| `post_topic` | 23 | Activity / legacy rewards-extension |
| `seo_purchase` | 16 | Commercial |
| `pin_purchase` | 14 | Commercial |
| `test_fixture` | 5 | Lab |
| `check_in` | 4 | Activity |
| `post_reply` | 3 | Fee/reward |
| `admin_grant` | 2 | Opaque lab descriptions kept in detail only |

No `ops_credit_grant` in this DB sample; type is registered in UI/i18n.

## 4. UI / API changes

### API `GET /api/ledger/transactions`
- Filters: `type`, `direction` (`credit` / `debit` / `zero`), `from`, `to`, plus existing `currency` / `userId` / `page` / `limit`
- Display-only enrichment via `enrichTransactionForDisplay`:
  - `amountCredit`, `balanceAfterCredit`, `balanceBeforeCredit`
  - `amountVnd`, `balanceAfterVnd`, `balanceBeforeVnd` (null if no snapshot)
  - `snapshotCreditVnd`, `vndSource`, `legacyVndUnknown`, `direction`
- Response notes: `storageUnit: 'credit'`, `displayUnit: 'vnd'`

### Admin tab `/dashboard/ledger?tab=transactions`
- Columns: ID, Time, User, Type, Amount (VND), Balance after (VND), Summary, Details
- Signed VND colors; zero is neutral `0 đ`
- Summary from type registry (not raw lab strings such as “Phase23B…”)
- Original description kept in detail drawer
- Filters: user, type, direction, currency, date range
- Pagination (newest first); EN/VI i18n keys

### Key files
- `apps/api/src/extensions/ledger/utils/transactionDisplay.js` (new)
- `apps/api/src/extensions/ledger/routes.js`
- `apps/api/src/extensions/ledger/tests/transaction-display.test.js` (new)
- `apps/web/src/extensions/ledger/components/admin/LedgerTransactions.jsx`
- `apps/web/src/extensions/ledger/utils/transactionDisplay.js` (new)
- `apps/web/src/extensions/ledger/utils/transactionTypes.js`
- `apps/web/src/extensions/ledger/components/common/LedgerTransactionTable.jsx`
- i18n EN/VI + `namespaces.json`

## 5. Tests — PASS vs unverified

### PASS

| Check | Result |
|-------|--------|
| `transaction-display.test.js` (legacy null VND; snapshot rate → VND; no current-rate revalue) | **PASS** |
| `reward-rules.test.js` | **PASS** |
| `ledger-i18n.test.mjs` | **PASS** |
| API auth + list (reuse saved session token; timeout 15s) | **PASS** — total 67 |
| Filter `direction=debit` | **PASS** — 30 |
| Filter `direction=credit` | **PASS** — 37 |
| Filter `direction=zero` | **PASS** — 0 (none in DB) |
| Filter `type=seo_purchase` | **PASS** — 16 |
| Filter `type=pin_purchase` | **PASS** — 14 |
| Pagination `page=2&limit=10` | **PASS** |
| Legacy enrichment: `amountVnd=null`, `legacyVndUnknown=true` on fixture rows | **PASS** |
| Stack left running (API 7100 / Web 3100 / Redis 16379) | **UP** |

### Not verified (stopped; no further browser Admin E2E)

| Check | Status |
|-------|--------|
| Logged-in Admin UI screenshot of transactions table | **NOT VERIFIED** |
| UI rendering of Legacy badge / Credit subline / `—` VND cells | **NOT VERIFIED** (code present; browser login aborted) |
| Detail modal fields (raw description, rate, refs) in browser | **NOT VERIFIED** |
| Live UI for a **new** row with VND snapshot on fixture | **NOT VERIFIED** — DB has 0 snapshot rows; no balance-mutating fixture created |
| VI/EN language switch on the transactions tab in browser | **NOT VERIFIED** |
| Visual confirmation of signed green/red VND formatting | **NOT VERIFIED** |

## 6. Legacy limits

- Cannot show trustworthy historical VND without snapshots — by design.
- Do **not** backfill invented `creditVnd` onto old rows.
- Free Mode / zero-Credit rows remain listable; filter `zero` works.
- User wallet table still shows **Credit** (stored unit).
- Opaque lab descriptions stay in DB; Admin summary prefers type labels.

## 7. Screenshots

- Admin authenticated transactions screenshot: **not captured** (E2E login stopped per instruction).
- Unauthenticated `/dashboard/ledger?tab=transactions` previously showed Sign-in only.

## 8. Git (read-only)

- Working tree has many modified + untracked files spanning ledger VND/Credit work, i18n, reward rules, and this tx-history UI/API.
- Notable for this task: `LedgerTransactions.jsx`, `transactionDisplay.js` (api+web), `routes.js` filters/enrichment, i18n keys, `docs/audit/PBN-LEDGER-TRANSACTION-HISTORY-REPORT.md`.
- **No commit / no push** performed.

## 9. Limits honored

- No OPS-SERVER / OPS contract changes.
- No balance or history mutation; no DB reset; no transaction deletes.
- No invented historical VND from current rate.
- Temp password file `.local/owner-pw-tmp.txt` removed; DPAPI original kept.
- Secrets not written into this report.
- Dev stack left running.
