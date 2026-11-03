# Forum Pricing Protocol Handoff — OPS-SERVER → PBN

**Status:** OPS-SERVER `forum-pricing/1` implemented (catalog, publish/sign, sync, quote lock, credit-order validation).  
**Contract:** `contracts/forum-pricing/v1/`  
**Product key:** `pbn`  
**Date:** 2026-11-03  

> Note: PBN-authored handoff/contract files were **not** present in ops-server at implementation time. OPS defined the contract (see `docs/forum-pricing-contract-adjustments.md`). Diff against this doc if PBN has a parallel draft.

---

## 1. Authority

**ALL monetary pricing authority belongs to OPS-SERVER.**

| Concern | Owner |
|---------|--------|
| VND↔Credit conversion (`vndPerCredit`) | OPS |
| Credit packages (VND → Credits) | OPS |
| SEO service Credit prices | OPS |
| Paid-pin Credit prices | OPS |
| Free-launch policy (0 VND, not revenue) | OPS |
| Publish / Ed25519 sign / versioning | OPS |
| Credit wallet balance & spend | PBN |
| Real-money payment confirmation | OPS (`forum-credit/1`) |
| Credit grant delivery / ledger | `forum-credit/1` (unchanged) |

- One shared catalog for **all** Forums under product `pbn`.
- Published versions are **immutable**.
- Valid quotes / locked orders survive newer publications.
- PBN must **never** invent local prices or bypass OPS validation with arbitrary `amountVnd` / `creditsToGrant`.

---

## 2. Auth

Same per-forum Bearer as `forum-credit/1`:

- `Authorization: Bearer <forum_machine_credential>`
- URL `installationId` must match credential
- Recommended headers: `x-ops-product-code: pbn`, `x-ops-forum-id`, `x-ops-installation-id`, `x-ops-api-contract: forum-pricing/1`

---

## 3. Endpoints (OPS)

### Machine (Bearer)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/v1/forum/installations/:installationId/pricing/catalog` | `{ snapshot, verification }` current effective |
| `GET` | `/api/v1/forum/installations/:installationId/pricing/sync?afterVersion=N` | Incremental published versions |
| `GET` | `/api/v1/forum/installations/:installationId/pricing/versions/:version` | `{ snapshot, verification }` historical |
| `POST` | `/api/v1/forum/installations/:installationId/pricing/quotes` | Lock quote |

### Credit orders (extended)

`POST /api/v1/forum/installations/:installationId/credit/orders`

```json
{
  "localUserId": "42",
  "orderReference": "pbn_ord_1001",
  "packageCode": "pack_100",
  "pricingVersion": 1,
  "quoteId": null,
  "idempotencyKey": "idem_1001"
}
```

Free launch:

```json
{
  "localUserId": "42",
  "orderReference": "pbn_free_1",
  "freeLaunch": true,
  "pricingVersion": 1,
  "idempotencyKey": "idem_free_1"
}
```

If `amountVnd` / `creditsToGrant` are also sent, they must **exactly** match OPS catalog or OPS returns `price_tamper`.

### Admin

- Product page: `/admin/products/pbn?tab=credits` — draft JSON edit + publish.
- Server actions: `updateForumPricingDraftAction`, `publishForumPricingDraftAction`.

---

## 4. Signature

See `contracts/forum-pricing/v1/signing.md`.

- Alg: Ed25519 over canonical JSON (sorted keys, no `signature` field).
- Sync responses include `verification: { alg, keyId, publicKey }`.
- Env (OPS): `FORUM_PRICING_ED25519_PRIVATE_KEY`, `FORUM_PRICING_ED25519_PUBLIC_KEY`, `FORUM_PRICING_ED25519_KEY_ID`.

---

## 5. PBN client checklist

1. On connect / periodically: `GET .../pricing/sync?afterVersion=<last>` — verify each snapshot signature; store immutable versions.
2. UI prices only from verified snapshot (or last good offline snapshot — never invent).
3. Before purchase: optional `POST .../pricing/quotes`; persist `quoteId` + version.
4. Credit top-up: `POST .../credit/orders` with `packageCode` (+ `quoteId` / `pricingVersion`).
5. Free launch: `freeLaunch: true` only; treat as audit, not paid receipt.
6. SEO / paid-pin spends: debit local wallet using locked quote Credit totals; reconcile via existing ledger ingest (`forum-credit/1`).
7. After OPS confirms paid/free and delivers `credit-granted`: apply once per `eventId` (unchanged).

---

## 6. Explicit non-goals

- Second payment engine / gateway
- Overwriting SEO-OPS or ZYVAVU catalog tables
- Rewriting `forum-credit/1` delivery/ledger protocols
- Per-forum price lists (catalog is product-shared)
