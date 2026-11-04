# Final PBN Pricing Hardening Report

**Date:** 2026-11-03  
**Follows:** forum-pricing/1 reconciliation to OPS `0683c6e`  
**Constraints honored:** no production change, no production migrate, no DB reset, no commit/push/deploy

---

## Priority 1 — Security (trusted OPS keys)

### Problem
`sync` responses include `verification.publicKey`. Trusting that key alone allows an attacker to generate a keypair, sign a fake catalog, and pass cryptographic verification.

### Fix
- New trust registry: [`apps/api/src/extensions/forum-pricing/trust.js`](apps/api/src/extensions/forum-pricing/trust.js)
- Pin keys via env:
  - `FORUM_PRICING_TRUST_KEY_ID` + `FORUM_PRICING_TRUST_PUBLIC_KEY` / `FORUM_PRICING_TRUST_KEY_FILE`
  - or `FORUM_PRICING_TRUSTED_KEYS_JSON` (`status: active|retired` for rotation)
- `ingestSnapshot` calls `resolveTrustedVerification(keyId, syncVerification)` **before** signature verify
- Unknown / retired keyIds rejected (`unknown_key_id` / `key_retired`)
- Sync publicKey, if present, must match pinned fingerprint (`untrusted_sync_public_key`)
- OPS private key never configured on PBN

### Attack test
Hardening suite proves: attacker-generated key + correctly signed fake catalog + matching sync `publicKey` → **rejected** by registry (`unknown_key_id`).

---

## Priority 2 — Pricing compatibility

| Item | Change |
|------|--------|
| SEO SKU codes | Canonical `seo-monthly`, `seo-monthly-paid`; `seo_audit_basic` aliased → `seo-monthly-paid` |
| SEO duration | Required on OPS `seoServices`: `durationMonths`, `renewalWindowDays` (no PBN invention) |
| Quote/purchase history | Untouched; local quote lock still charges locked totals after V2 publish |
| paid_pin | Plans/purchases consume verified OPS catalog; status `OPS_CATALOG` |
| Forum Admin prices | Admin create/update pin products → **410** `OPS_PRICING_AUTHORITY` |
| Wallet / pin behavior | Ledger deduct preserved; historical `pin_entitlements` kept |

Additive SQL (not applied): `apps/api/baseline/0008_forum_pricing_hardening.sql` (`ops_sku_code`, nullable `product_id`).

---

## Changed files

- `apps/api/src/extensions/forum-pricing/trust.js` **(new)**
- `apps/api/src/extensions/forum-pricing/crypto.js`
- `apps/api/src/extensions/forum-pricing/validate.js`
- `apps/api/src/extensions/forum-pricing/constants.js`
- `apps/api/src/extensions/forum-pricing/services/{syncService,catalogView}.js`
- `apps/api/src/extensions/forum-pricing/index.js`
- `apps/api/src/extensions/forum-pricing/tests/forum-pricing-hardening.test.js` **(new)**
- `apps/api/src/extensions/forum-pricing/tests/forum-pricing-contract.test.js`
- `apps/api/src/modules/forum/services/{pinService,seo/constants,seo/tests/forum-pricing.test}.js`
- `apps/api/src/modules/forum/routes/pins/index.js`
- `apps/api/src/modules/forum/db/pin-schema.js`
- `apps/api/baseline/0008_forum_pricing_hardening.sql`
- `apps/api/.env.example`
- `contracts/forum-pricing/v1/snapshot.example.json`
- `docs/PBN-OPS-FORUM-PRICING-HARDENING.md`

---

## Tests

```bash
node --test \
  apps/api/src/extensions/forum-pricing/tests/forum-pricing-hardening.test.js \
  apps/api/src/extensions/forum-pricing/tests/forum-pricing-contract.test.js \
  apps/api/src/modules/forum/services/seo/tests/forum-pricing.test.js \
  apps/api/src/extensions/forum-credit/tests/forum-credit.test.js
```

**Result: 46 passed / 1 skipped / 0 failed**

Verified in suite:
- Attacker key rejection
- Trusted verify + sync publicKey mismatch rejection
- Key rotation (retired vs active)
- SEO SKU alignment + OPS duration required
- paid_pin from OPS catalog
- V1 locked economics survive V2
- Forum-credit regression + cross-forum isolation (existing suite)
- Offline / missing conversion fail-closed (existing suite)

---

## Remaining blockers

1. **OPS must publish** `durationMonths` + `renewalWindowDays` on every `seoServices[]` entry (PBN now fail-closes without them).
2. Operator must pin **trust keys** on each forum (`FORUM_PRICING_TRUST_*`) before sync works.
3. Apply additive `0007` + `0008` on staging DBs only after review (not applied here).
4. Live VPS: published catalog + enrollment + HTTPS as needed for grants.
5. UI clients must send pin `skuCode` (string OPS code), not legacy numeric `shop_items.id`.

---

## Exact live E2E prerequisites

1. OPS: publish catalog with SEO codes `seo-monthly` / `seo-monthly-paid` (or keep `seo_audit_basic` alias), each with `durationMonths` + `renewalWindowDays`; include `paidPins`.
2. Copy OPS pricing **public** SPKI to PBN trust env (`FORUM_PRICING_TRUST_KEY_ID` + public key). Never ship private key.
3. Staging only: apply `0007_forum_pricing_ops.sql` then `0008_forum_pricing_hardening.sql`.
4. Enroll forum (`forum-credit/1`); `POST /api/ops/forum/pricing/sync`.
5. Confirm attacker/fake key sync fails; genuine catalog imports.
6. Quote SEO at V1 → publish V2 → purchase still charges V1 lock.
7. New SEO quote uses V2; pin purchase via `skuCode=pin_24h` debits OPS `creditPrice`.
8. Admin pin price POST/PUT returns 410.
9. Historical SEO/pin receipts and wallet balances unchanged.
10. Ledger outbox remains idempotent.
