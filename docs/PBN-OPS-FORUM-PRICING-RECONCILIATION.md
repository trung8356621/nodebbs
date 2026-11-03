# PBN ↔ OPS Forum Pricing Contract Reconciliation

**OPS commit:** `0683c6eef032cc3726d1b5e943c0f88937aa65b6`  
**Date:** 2026-11-03  
**Action:** Adapt PBN to OPS `forum-pricing/1` (no production migrate/commit/push/deploy)

---

## A. Contract mismatches found

| Area | PBN draft (pre-recon) | OPS (authoritative) | Resolution |
|------|----------------------|---------------------|------------|
| `schemaVersion` | number `2` | string `forum-pricing/1` | Adopt OPS |
| Product field | `productCode` | `productKey` | Adopt OPS |
| Conversion | `creditVnd` | `vndPerCredit` | Adopt OPS; map to `creditVnd` in UI view |
| Catalog shape | `products[]` typed union | `creditPackages[]`, `seoServices[]`, `paidPins[]`, `freeLaunch` | Adopt OPS |
| Package id | `id` / `packageId` | `code` / `packageCode` | Adopt OPS |
| Package money | `amountVnd`/`creditsGranted` | `priceVnd`/`credits` | Adopt OPS |
| SEO SKU | `listPriceCredit`/`salePriceCredit`/`durationMonths` | `creditPrice` (+ PBN duration defaults) | Map + document duration bridge |
| Paid pin | `durationSeconds` | `durationHours` | Map; runtime still MIGRATION_PENDING |
| Signature | envelope `{payload,checksum,signature}` over raw bytes | embedded `signature:{alg,keyId,value}` over **canonical JSON** | Adopt OPS verifier |
| Key distribution | local trust PEM file | sync `verification.publicKey` (SPKI base64url) | Adopt OPS |
| Sync transport | file / SEO fixture | Bearer HTTP sync/catalog/quotes | Implement OPS client |
| API paths | `/api/v1/forum/pricing/catalogs...` (PBN draft) | `/api/v1/forum/installations/:id/pricing/...` | Adopt OPS |
| Credit orders | free-form credits | `packageCode`+`pricingVersion` / `freeLaunch:true` | Adapt order client |
| Quote APIs | local-only SEO quotes | OPS `POST .../pricing/quotes` + local wallet lock | Both: OPS quote optional; local lock preserved |
| Offline | last verified file snapshot | last verified signed snapshot | Keep fail-closed; no invention |

---

## B. Files changed

### Contracts / docs
- `contracts/forum-pricing/v1/*` — mirrored from OPS (removed obsolete PBN draft schemas)
- `docs/forum-pricing-protocol-handoff.md` — rewritten to OPS SoT
- `docs/forum-pricing-protocol-handoff.ops.md` / `docs/forum-pricing-contract-adjustments.ops.md` — OPS copies
- `docs/PBN-OPS-FORUM-PRICING-RECONCILIATION.md` — this report

### PBN implementation
- `apps/api/src/extensions/forum-pricing/**` — crypto, validate, sync, catalog view, admin routes, plugin
- `apps/api/src/extensions/forum-credit/services/opsClient.js` — pricing HTTP + contract header
- `apps/api/src/extensions/forum-credit/services/creditOrderService.js` — packageCode / freeLaunch
- `apps/api/src/extensions/forum-credit/routes/admin.js` — request fields
- `apps/api/src/modules/forum/services/seo/service.js` — prefer OPS catalog when verified
- `apps/api/src/modules/forum/db/seo-schema.js` — authority columns
- `apps/api/src/db/schema.js` — export forum-pricing schema
- `apps/api/baseline/0007_forum_pricing_ops.sql` — additive (not applied)
- `apps/api/src/extensions/forum-pricing/tests/forum-pricing-contract.test.js`

Preserved: forum-credit enrollment/receiver/ledger, historical `ops_price_snapshots` / purchases / wallets.

---

## C. Compatibility fixes

1. **Verifier** matches OPS canonical JSON + Ed25519 base64url + keyId binding.
2. **Sync client** pulls `pricing/sync` with Bearer + `x-ops-api-contract: forum-pricing/1`.
3. **Local store** `ops_forum_pricing_snapshots` holds immutable verified versions.
4. **SEO/UI bridge** maps `vndPerCredit`→`creditVnd`, `seoServices`→products (`durationMonths=1` default documented).
5. **Credit orders** send OPS fields; reject free-launch credit mismatch as `price_tamper`.
6. **Quote lock** unchanged: local purchase still executes locked unit/total; V2 publish does not reprice open quotes.
7. **paid_pin** catalog visible; purchase path still `MIGRATION_PENDING`.
8. **No signature bypass / no silent contract fallback** for OPS authority path.

---

## D. Tests

```bash
node --test \
  apps/api/src/extensions/forum-pricing/tests/forum-pricing-contract.test.js \
  apps/api/src/modules/forum/services/seo/tests/forum-pricing.test.js \
  apps/api/src/extensions/forum-credit/tests/forum-credit.test.js
```

**Result:** 39 passed, 1 skipped (legacy live DB sync), 0 failed.

Covered: valid sign/verify, tamper reject, wrong key reject, expired view, V1 lock vs V2 price, package mapping, free-launch fixture shape, paid_pin MIGRATION_PENDING, forum-credit regression.

---

## E. Remaining live E2E blockers

1. Apply `0007_forum_pricing_ops.sql` on each forum DB (not done here) before OPS SEO purchases (FK drop + snapshot tables).
2. OPS must have a **published** catalog + Ed25519 env keys on VPS.
3. PBN forum must be **enrolled** (`forum-credit/1`) with reachable HTTPS callback as needed for grants.
4. Align SEO SKU codes on OPS with PBN UI product IDs (OPS example uses `seo_audit_basic`; PBN fixtures used `seo-monthly-paid`).
5. Duration/renewal for SEO entitlements are PBN defaults until OPS extends `seoServices`.
6. Complete `paid_pin` runtime cutover.
7. Live: sync → verify → quote → package order → grant delivery still needs staging run.

---

## F. Exact sequence for live E2E

1. OPS Admin: publish pricing draft (product `pbn`) → version N signed.
2. Confirm machine APIs: `GET .../pricing/catalog` with Forum Bearer returns `{snapshot,verification}`.
3. On PBN (staging DB): apply `0007_forum_pricing_ops.sql` once.
4. Ensure OPS enrollment connected; Admin → `POST /api/ops/forum/pricing/sync`.
5. Confirm `GET /api/ops/forum/pricing/status` shows verified version + `vndPerCredit`.
6. Tamper test offline: mutate snapshot bytes → verifier rejects; last good retained.
7. Create local SEO quote at V1 price; publish OPS V2; confirm purchase still charges V1 lock.
8. New quote after V2 → uses V2 `creditPrice`.
9. `POST /api/ops/forum/credit-orders/package` with `packageCode=pack_100` (+ `pricingVersion`).
10. Free launch: `freeLaunch:true` only; confirm `amountVnd=0` / no fake revenue.
11. Duplicate idempotency → single order / single wallet debit.
12. Ledger outbox sync remains idempotent (`eventId` + sequence).
