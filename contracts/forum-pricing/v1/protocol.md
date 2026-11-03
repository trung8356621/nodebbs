# forum-pricing/1 protocol

## Headers (machine)

- `Authorization: Bearer <forum_machine_credential>`
- `x-ops-product-code: pbn`
- `x-ops-forum-id: <forumId>`
- `x-ops-installation-id: <installationId>`
- `x-ops-api-contract: forum-pricing/1`

URL `installationId` must match the credential (same isolation as forum-credit/1).

## Snapshot fields

| Field | Meaning |
|-------|---------|
| `schemaVersion` | always `forum-pricing/1` |
| `productKey` | `pbn` |
| `version` | monotonic published integer |
| `pricingVersionId` | durable row id |
| `issuedAt` | publish timestamp |
| `effectiveAt` | when version becomes current for **new** quotes/orders |
| `validUntil` | optional hard end; null = open |
| `vndPerCredit` | integer VND represented by 1 Credit (display/conversion) |
| `creditPackages[]` | purchasable Credit packs (VND → Credits) |
| `seoServices[]` | Credit-priced SEO SKUs (wallet spend on PBN) |
| `paidPins[]` | Credit-priced pin SKUs |
| `freeLaunch` | 0 VND grant policy (not revenue) |
| `signature` | Ed25519 over canonical body |

## Sync APIs (OPS)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/v1/forum/installations/:installationId/pricing/catalog` | `{ snapshot, verification }` for current effective version |
| `GET` | `/api/v1/forum/installations/:installationId/pricing/sync?afterVersion=N` | Incremental published versions with `version > N` |
| `GET` | `/api/v1/forum/installations/:installationId/pricing/versions/:version` | `{ snapshot, verification }` for exact published version |
| `POST` | `/api/v1/forum/installations/:installationId/pricing/quotes` | Lock a quote against a published version |

## Credit orders (extends forum-credit/1)

`POST .../credit/orders` **must** reference OPS pricing:

```json
{
  "localUserId": "42",
  "orderReference": "pbn_ord_1001",
  "packageCode": "pack_100",
  "pricingVersion": 1,
  "quoteId": "fpq_optional",
  "idempotencyKey": "idem_1001"
}
```

- OPS sets `amountVnd` / `creditsToGrant` from the package (or free-launch policy).
- If client also sends those fields, they must **exactly** match or OPS returns `price_tamper`.
- Free launch: `{ "freeLaunch": true, ... }` → `amountVnd=0`, `orderKind=free_grant`, `paidAt` stays null on confirm.
- Duplicate `orderReference` / `idempotencyKey` → same order; never double-grant.

## Quote survival

- Quotes store `pricingVersion`, unit/total prices, `quotedAt`, `quoteExpiresAt`.
- Publishing V2 does **not** invalidate unexpired V1 quotes.
- Expired quotes cannot be consumed; client must re-quote.
- Historical purchases never recalculate against newer versions.

## Offline policy

- PBN may serve last **verified** snapshot while offline.
- New money orders still require OPS create/confirm when connectivity returns.
- Never invent prices locally.
