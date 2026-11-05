# Proposed Forum → OPS service sync contract

**Status:** DESIGN ONLY / BLOCKED on OPS-SERVER  
**Date:** 2026-11-04  
**Machine:** DESKTOP — PBN  
**Do not reuse:** `forum-pricing/1` catalog pull (OPS→Forum signed snapshots). Semantics differ.

## Why a new contract

Forum is now the **primary** commercial configuration owner:

- Local VND base prices + enablement live on each Forum.
- OPS is an optional multi-forum management layer (override / ban / visibility).
- Outbound “Đồng bộ dịch vụ lên OPS” must push Forum definitions **to** OPS.

Current OPS endpoints only support **pull** of signed `forum-pricing/1` catalogs. Pushing Forum base prices through that channel would corrupt authority semantics. PBN therefore returns **HTTP 501** with `OPS_SYNC_UNSUPPORTED` until OPS implements the contract below.

## Proposed endpoint (OPS)

`POST /api/v1/forum-installations/{forumId}/service-catalog/sync`

### Auth

- Forum installation credential (same mTLS / JWT as `forum-credit/1`).
- Idempotency-Key header required.

### Request body (draft)

```json
{
  "contract": "forum-service-sync/1",
  "forumId": "frm_…",
  "syncedAt": "2026-11-04T10:00:00.000Z",
  "vndPerCreditHint": 10000,
  "services": [
    {
      "serviceCode": "paid_pin",
      "enabled": true,
      "localPriceVersion": 3,
      "basePriceVnd": 50000,
      "options": { "durationSeconds": 86400, "skuCode": "paid_pin_default", "name": "Paid topic pin 24h" }
    },
    {
      "serviceCode": "seo_entitlement",
      "enabled": true,
      "localPriceVersion": 1,
      "basePriceVnd": 30000,
      "options": { "durationMonths": 1, "skuCode": "seo_monthly_local" }
    }
  ]
}
```

### Response (draft)

```json
{
  "accepted": true,
  "opsCatalogVersion": "ops-svc-42",
  "policies": [
    {
      "serviceCode": "paid_pin",
      "banned": false,
      "overridePriceVnd": null,
      "opsVersion": "ops-svc-42",
      "validUntil": null
    }
  ]
}
```

### Inbound policy apply (Forum)

Forum already stores accepted policies in `forum_ops_service_policies` and rejects **stale** `opsVersion` (no roll-back).

Suggested follow-up OPS push (optional):

`POST /api/forum/local-pricing/ops-policies` (admin/internal) — not exposed until OPS ships signed policy delivery.

## Non-goals

- Do not replace Credit Package pricing (remains OPS `forum-pricing/1`).
- Do not let OPS execute Forum pin/SEO handlers.
- Do not overwrite Forum `base_price_vnd` when applying overrides.

## PBN UI behavior until OPS ships

| State | Behavior |
|-------|----------|
| No installation credential | Sync button hidden/disabled |
| Credential present, no OPS endpoint | Button labeled **Chưa hỗ trợ**; `POST …/sync-to-ops` → 501 |
| Compatible endpoint verified | Enable real sync (future task) |

## Required OPS changes (checklist)

1. Add `forum-service-sync/1` accept endpoint (above).
2. Persist per-forum service definitions separately from signed retail catalog.
3. Allow OPS admins to set override VND / ban per service per forum.
4. Return monotonic `opsVersion` for policy fan-out.
5. Document auth + idempotency + retry semantics.
6. Joint integration test with a Forum fixture (no production cutover without approval).
