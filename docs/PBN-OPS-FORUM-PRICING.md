# PBN ↔ OPS-SERVER Forum Pricing — Implementation & Verification Report

**Date:** 2026-11-03  
**Contract:** `forum-pricing/1` (catalog schemaVersion 2)  
**Branch:** `chore/pbn-phase1-5-i18n` (uncommitted local work; agent did not commit/push/deploy)  
**OPS-SERVER repo:** not mounted in this workspace — contract + handoff authored here  

---

## Corrections applied (mandatory)

1. **Quote lock preserved across price updates.** Purchase executes the locked quote (`unitPrice` / `totalCredits` / authenticated `price_snapshot`). Newer catalog versions do **not** force REQUOTE. REQUOTE only for expired, canceled, consumed, invalid, or emergency-revoked quotes.
2. **`paid_pin` in shared catalog.** Catalog type defined. Runtime pin pricing remains Forum-admin and is marked **`MIGRATION_PENDING`**. Full monetary-authority compliance is **not** claimed.
3. **Historical economics.** Forums audited independently (read-only). Migration SQL is additive and **not applied**. Backfill uses only stored `paid_price` / `price_snapshot` / quote timestamps; never today’s catalog.

---

## Architecture

```
OPS publishes immutable catalog vN (Ed25519 envelope)
  → PBN verifies + stores ops_price_snapshots (retain last verified)
  → Quote locks unitPrice/quantity/totalCredits + authenticated snapshot
  → Purchase charges locked totalCredits atomically (0 = no ledger / no fake revenue)
  → Ledger outbox (forum-credit/1) reconciles with eventId + sequence cursor
```

Offline policy: keep last verified snapshot while `validUntil` is future; never invent `creditVnd` or SKU prices; expired/missing snapshot → `PRICE_UNAVAILABLE` for **new** quotes.

---

## Changed files

### Contract / docs
- `contracts/forum-pricing/v1/catalog.schema.json`
- `contracts/forum-pricing/v1/envelope.schema.json`
- `contracts/forum-pricing/v1/catalog.example.json`
- `contracts/forum-pricing/v1/quote-lock.example.json`
- `docs/forum-pricing-protocol-handoff.md`
- `docs/PBN-OPS-FORUM-PRICING.md` (this report)
- `docs/audit/FORUM-PRICING-HISTORY-AUDIT.json`

### API
- `apps/api/src/modules/forum/services/seo/prices.js` — v1 + shared v2 validation/sync
- `apps/api/src/modules/forum/services/seo/service.js` — snapshot-sourced conversion; quote lock execute; revoke; packages
- `apps/api/src/modules/forum/services/seo/constants.js` — provenance + MIGRATION_PENDING
- `apps/api/src/modules/forum/services/seo/errors.js` — REQUOTE codes without “price changed”
- `apps/api/src/modules/forum/db/seo-schema.js` — additive quote/purchase lock columns
- `apps/api/src/modules/forum/routes/seo/index.js` — packages + revoke + snapshot creditVnd
- `apps/api/src/modules/forum/services/pinService.js` — expose MIGRATION_PENDING on plans
- `apps/api/src/modules/forum/routes/pins/index.js` — migration status wrapper
- `apps/api/src/extensions/forum-credit/services/creditOrderService.js` — package-bound orders
- `apps/api/src/extensions/forum-credit/routes/admin.js` — `/credit-orders/package`
- `apps/api/baseline/0006_forum_pricing.sql` — additive migration (not applied)
- `scripts/seo-price-fixture.mjs` — shared schemaVersion 2 fixture
- `scripts/audit-forum-pricing-history.mjs`
- `apps/api/src/modules/forum/services/seo/tests/forum-pricing.test.js`

Unrelated uncommitted forum-credit enrollment/receiver code was not rewritten beyond additive package-order binding.

---

## Migrations

| File | Status |
|------|--------|
| `apps/api/baseline/0006_forum_pricing.sql` | Authored only. **Not applied** to `pbn_dev` or `pbn_forum_b`. |
| Prior baselines | Not re-run. |

Backfill rules inside `0006` copy from `paid_price`, quote `created_at`/`expires_at`, and `price_snapshot` fields only. Rows that cannot be reconstructed get `pricing_provenance='unknown'` — never recalculated from current catalog.

---

## Historical audit (read-only)

Source: `docs/audit/FORUM-PRICING-HISTORY-AUDIT.json`

| Forum | DB | SEO purchases | Paid range | Snapshot on purchase | Pin entitlements | Wallet credits total | New pricing columns |
|-------|-----|---------------|------------|----------------------|------------------|----------------------|---------------------|
| A | `pbn_dev` | 36 | 0–3 | 36/36 | 14 (stored price 10) | 1358 | **absent** (migration not applied) |
| B | `pbn_forum_b` | 27 | 0–4 | 27/27 | 19 (stored price 10) | 546 | **absent** |

Both forums retain reliable transaction-level SEO economics (`paid_price` + `price_snapshot`). Pin purchases retain stored `pin_entitlements.price` / ledger rows. Existing schemaVersion 1 snapshots lack `creditVnd` — runtime now fail-closes until a signed v2 catalog is synced (fixture script updated; operator must sync intentionally).

---

## Tests

```bash
node --test apps/api/src/modules/forum/services/seo/tests/forum-pricing.test.js
node --test apps/api/src/extensions/forum-credit/tests/forum-credit.test.js
```

**Result:** forum-pricing 7 pass / 1 skip (live sync needs `FORUM_PRICING_TEST_DATABASE_URL`); forum-credit 21/21 pass.

Covered behaviors:
- Shared catalog + packages + paid_pin validation
- Fail-closed without snapshot `creditVnd`
- Quote lock charges original 10 after later 15 publish (simulation)
- Expired/revoked require reconfirmation
- Reconciliation gap detection without duplicate eventIds
- Forum-credit protocol regression preserved

---

## Verification matrix

| Requirement | Status |
|-------------|--------|
| V1 purchase remains V1 after V2 publication | **Pass** (execute locked quote; ignore newer catalog price) |
| New purchases use V2 after effectiveAt | **Pass** (new quotes read current effective product) |
| Expired quotes cannot execute silently | **Pass** |
| Duplicate purchase cannot debit twice | **Pass** (existing idempotency + quote consumed) |
| Concurrent purchase vs price update consistent | **Pass by design** (shared advisory lock + quote lock; no silent reprice) |
| Offline snapshot policy explicit | **Pass** (retain last verified; fail-closed if expired/missing conversion) |
| Reconciliation detects missing events without duplicates | **Pass** (unit) + existing forum-credit outbox |
| Free-launch without fake revenue | **Pass** (`totalCredits=0` skips ledger) |
| No local invented prices | **Pass** for SEO/conversion/packages; **NOT** for paid_pin (MIGRATION_PENDING) |
| Preserve SEO-OPS / ZYVAVU / forum-credit | **Pass** (envelope + credit protocol unchanged) |

---

## paid_pin MIGRATION_PENDING

**Exposure:** Forum Admin still creates/edits `shop_items` type `topic_pin` prices. `/api/pins/products` returns `migrationStatus: MIGRATION_PENDING`. Catalog may list `paid_pin` SKUs but purchase path does not consume them yet.

**Follow-up acceptance criterion:** Pin plans and purchases resolve exclusively from authenticated catalog `paid_pin` SKUs; Forum Admin cannot set Credit prices; historical `pin_entitlements.price` remains immutable with provenance.

Until then, **do not claim full monetary-authority compliance**.

---

## Remaining blockers / OPS handoff

1. **OPS-SERVER code not in workspace** — implement publish/sign/admin + package-resolved credit orders per `docs/forum-pricing-protocol-handoff.md`.
2. Operator must sync schemaVersion 2 fixtures (or live OPS envelope) before runtime conversion works against existing DBs (current snapshots are v1 without `creditVnd`).
3. Apply `0006_forum_pricing.sql` per forum DB intentionally after review — **not** auto-applied here.
4. Complete `paid_pin` runtime cutover.
5. No commit / push / deploy / production migrate performed by agent.
