# PBN Baseline Manifest v7 — Ready for New Forums

**Date:** 2026-11-05 (Asia/Bangkok)  
**Verdict: READY** — greenfield forums can be created with current commercial + Parent/Child schema via `scripts/forum.mjs migrate` alone.  
**Preserved:** Forum A (`pbn_dev`), Forum B (`pbn_forum_b`) — no migrate/seed/admin/adopt.  
**Git:** No commit / no push / no production adopt.

---

## 1. Audit of SQL `0005`–`0012`

| Order | File | Depends on | Idempotency |
|------:|------|------------|-------------|
| 1 | `0005_forum_credit.sql` | `users` (v1) | `CREATE TABLE/INDEX IF NOT EXISTS` |
| 2 | `0006_forum_pricing.sql` | `seo_quotes` / `seo_purchases` (v5) | `ADD COLUMN IF NOT EXISTS`; `DROP CONSTRAINT IF EXISTS` + ADD |
| 3 | `0007_forum_pricing_ops.sql` | 0006 columns | `IF NOT EXISTS` tables/indexes; drop legacy FK |
| 4 | `0008_forum_pricing_hardening.sql` | `pin_entitlements` (v3) | column IF NOT EXISTS; drop/add constraint |
| 5 | `0009_forum_local_pricing.sql` | users + pin_entitlements | IF NOT EXISTS tables; seed `ON CONFLICT DO NOTHING`; **replaces** pin constraint for Free Mode (`price >= 0`) |
| 6 | `0010_ledger_credit_numeric.sql` | `sys_accounts` / `sys_transactions` | ALTER to `numeric(30,10)` (stable re-run); rate history IF NOT EXISTS |
| 7 | `0011_bank_payment.sql` | users + numeric credits | IF NOT EXISTS + package seed `ON CONFLICT DO NOTHING` |
| 8 | `0012_forum_network.sql` | users | IF NOT EXISTS Parent/Child tables + role seed |

**Reward rules:** still live in Ledger `sys_currencies.config` via seed (`init/ledger.js`) — no extra SQL required in v7.

**Conflict check:** Probe apply + full re-apply of 0005–0012 succeeded (no duplicate-table failures). No migration conflict found; proceed was safe.

---

## 2. Manifest / checksum mechanism

Appended immutable record to [`apps/api/baseline/manifest.json`](../../apps/api/baseline/manifest.json):

- **version:** 7  
- **files:** 0005…0012 with per-file SHA-256  
- **migration object checksum** (`sha(JSON.stringify(migration))`):  
  `8815e91ed9e52718e1d91a05ac06ebc948786cc6038995af42d606ea60e7acce`  
- **catalog:** [`apps/api/baseline/catalog-v7.json`](../../apps/api/baseline/catalog-v7.json)  
- **backup pre-change:** `apps/api/baseline/manifest.json.bak-pre-v7`

Runner behavior unchanged ([`scripts/forum.mjs` `migrate`](../../scripts/forum.mjs)):

1. Verify file SHA vs manifest entries  
2. Skip already-applied versions (checksum must match)  
3. Apply only missing versions inside advisory lock  
4. Final catalog fingerprint must equal `catalog-v7.json`  
5. Re-run is no-op

Prepare evidence: [`PBN-BASELINE-V7-PREPARE.json`](./PBN-BASELINE-V7-PREPARE.json) (`BASELINE_V7_READY`).

---

## 3. Forward-patch interaction

`scripts/forum-network.mjs` `applyForwardPatches` now **skips** when `pbn_meta.schema_versions` max ≥ 7, so Child create does not double-apply 0005–0012 after baseline migrate.

---

## 4. Greenfield fixture provision

| Forum | DB | Ports | Path |
|-------|-----|-------|------|
| Parent | `pbn_forum_v7` | 3700 / 7700 | `forums/forum-v7.json` |
| Child | `pbn_forum_v7c` | 3800 / 7800 | `forums/forum-v7c.json` |

Provision used **only** baseline migrate v1–v7 (no `forward_patches` rows). Observed versions: `1,2,3,4,5,6,7`.

Includes: Ledger numeric balances, local pricing + Free Mode pin constraint, bank-payment packages, forum-network tables, OPS credit/pricing tables (unused at runtime).

---

## 5. E2E results

Command: `node scripts/test-baseline-v7-e2e.mjs`  
Evidence: [`PBN-BASELINE-V7-E2E-RESULTS.json`](./PBN-BASELINE-V7-E2E-RESULTS.json)

**19 passed / 0 failed**, including:

- Parent provision via v7  
- Child create wizard on v7  
- Admin login  
- Credit wallet  
- Free Mode + local services  
- Post + paid pin (no OPS)  
- Managed policy version + anti-duplicate  
- Parent offline → Child still works  

A/B: not migrated in this task (preservation boundary intact).

---

## 6. Operator: create a new forum now

```bash
# 1) Add forums/<id>.json (unique id, pbn_* database, ports)
# 2) Provision (migrate applies v1–v7 automatically)
node scripts/forum.mjs provision forums/<id>.json

# Optional Parent/Child
node scripts/forum-network.mjs enable-parent forums/<parent>.json
node scripts/forum-network.mjs create-child --config forums/<child>.json --parent forums/<parent>.json --template default --free-months 2
```

---

## 7. Explicit non-goals

- **Not** adopted onto Forum A or Forum B  
- **Not** production deploy  
- **Not** committed/pushed  

Adopting v7 onto existing A/B remains a separate PO-approved adopt rehearsal.
