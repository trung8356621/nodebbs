# Forum Pricing Protocol Handoff — OPS-SERVER → PBN

**Status:** Reconciled to OPS-SERVER commit `0683c6eef032cc3726d1b5e943c0f88937aa65b6`.  
**Contract SoT:** OPS `contracts/forum-pricing/v1/` (mirrored into PBN).  
**Product key:** `pbn`  
**Date:** 2026-11-03  

PBN’s earlier draft (`schemaVersion: 2`, `products[]`, file envelope) is **superseded**. Runtime accepts the OPS snapshot shape and Ed25519 canonical signature.

See also:

- `contracts/forum-pricing/v1/` (OPS mirror)
- `docs/forum-pricing-contract-adjustments.ops.md`
- `docs/PBN-OPS-FORUM-PRICING-RECONCILIATION.md`

---

## Authority

ALL monetary pricing belongs to OPS-SERVER (`vndPerCredit`, credit packages, SEO service credits, paid-pin catalog prices, free-launch).

PBN owns wallet balance/spend, quote-lock execution for wallet debits, and `forum-credit/1` delivery/ledger.

`paid_pin` catalog SKUs sync from OPS; **runtime purchase remains `MIGRATION_PENDING`** (Forum-admin `shop_items`).

---

## Machine APIs (Bearer)

| Method | Path |
|--------|------|
| `GET` | `/api/v1/forum/installations/:id/pricing/catalog` |
| `GET` | `/api/v1/forum/installations/:id/pricing/sync?afterVersion=N` |
| `GET` | `/api/v1/forum/installations/:id/pricing/versions/:version` |
| `POST` | `/api/v1/forum/installations/:id/pricing/quotes` |

Headers: same as forum-credit plus `x-ops-api-contract: forum-pricing/1`.

---

## Signature

Canonical JSON (sorted keys) + Ed25519 + unpadded base64url. See `contracts/forum-pricing/v1/signing.md`.

Public key distributed in sync `verification` — never invent prices on verify failure.

---

## Quote lock

Publishing V2 does **not** invalidate unexpired V1 quotes. REQUOTE only when expired/canceled/consumed/invalid/revoked.

---

## Credit orders

Use `packageCode` + `pricingVersion` (+ optional `quoteId`). Free launch: `{ freeLaunch: true, pricingVersion }`. Arbitrary `amountVnd`/`creditsToGrant` must exact-match OPS or OPS returns `price_tamper`.
