# PBN Transaction History Value Formatting Fix

**Date:** 2026-11-05  
**Machine:** DESKTOP — PBN  
**Target:** `/dashboard/ledger?tab=transactions`

## Changes

### A–C Display
- Amount / balance cells never use bare `—` for financial fields.
- Exact VND snapshot → signed VND primary (`−30.000 đ` / `+5.000 đ` / `0 đ`).
- Credit without VND snapshot → Credit primary (`−3 Credit` / `+40 Credit` / `0 Credit`) + badge **Lịch sử cũ** + tooltip.
- Missing VND copy: **Chưa có giá trị VND** (EN: No VND value available).
- Balance after uses committed Credit when VND unknown (`28 Credit`), not `—`.
- Column headers renamed to **Giá trị** / **Số dư sau** (unit lives in the cell).
- Trailing Credit decimals trimmed (`28.0000000000` → `28`); zero uses muted tone (never red).

### D Snapshots (new writes only)
- `LedgerService.grant` / `deduct` / `transfer` attach committed metadata:
  - `ledgerAmountCredit`, `balanceAfterCredit`
  - `creditVnd` (caller or live Forum rate at write time)
  - `valueVnd` (caller `valueVnd` / `priceVnd` / `amountVnd`, else rate × committed Credit)
- Enricher also reads existing `priceVnd` / `amountVnd` aliases display-only (no DB rewrite of history).
- Old rows are not backfilled.

### Files
- `apps/web/src/extensions/ledger/utils/money.js`
- `apps/web/src/extensions/ledger/utils/transactionValueFormat.js` (new)
- `apps/web/src/extensions/ledger/utils/transactionDisplay.js`
- `apps/web/src/extensions/ledger/utils/transactionDisplay.format.test.mjs` (new)
- `apps/web/src/extensions/ledger/components/admin/LedgerTransactions.jsx`
- `apps/web/src/i18n/messages/{en-US,vi-VN}.json`, `namespaces.json`
- `apps/api/src/extensions/ledger/utils/transactionDisplay.js`
- `apps/api/src/extensions/ledger/services/ledgerService.js`
- `apps/api/src/extensions/ledger/tests/transaction-display.test.js`

## Tests

| Suite | Result |
|-------|--------|
| `transaction-display.test.js` | **PASS** 7/7 |
| `transactionDisplay.format.test.mjs` | **PASS** 7/7 |
| `ledger-i18n.test.mjs` | **PASS** 3/3 |

No commit / push. No rewrite of historical DB rows.
