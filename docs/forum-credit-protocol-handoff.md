# Forum Credit Protocol Handoff — OPS-SERVER → PBN (Fastify)

**Status:** OPS-SERVER foundation hardened (rotation secrets, product key seed, HTTP E2E).  
**Contract version:** `forum-credit/1` (unchanged paths; rotation storage clarified)  
**Product code / key:** `pbn` (resolve by **key**, not hard-coded id)  
**Date:** 2026-11-03  

This document is the source of truth for the PBN/NodeBBS Fastify receiver. Do **not** invent alternate paths or reuse SEO-OPS H1 / Domain Anchor / entitlement APIs.

---

## 1. Architecture (actual)

```
OPS Admin
  └─ create Forum Installation (forumId immutable)
  └─ issue one-time Enrollment Key
PBN Forum
  └─ POST /api/v1/forum/enrollments/consume → machine credential (once)
  └─ stores credential per forum (never shared across forums)
OPS
  └─ Credit Order (per installation + localUserId + orderReference)
  └─ confirmPaid | confirmFreeGrant
  └─ durable Delivery Event → POST PBN /ops/v1/forum/events/credit-granted
  └─ requires JSON { "ack": true }  (HTTP 200 alone ≠ applied)
PBN
  └─ grants Credit wallet once (idempotent on eventId)
  └─ POST ledger events back to OPS for reconciliation copy
```

**Hard rules**

- 1 Installation = 1 Forum; 1 Forum = 1 active machine credential.
- No product-wide Bearer shared across all forums.
- No SEO Entitlement / H1 / Domain Anchor / domain quota for PBN.
- OPS does **not** mutate Forum wallet balances; it stores ledger copies only.
- `commercial_mode` (free|paid) ⊥ `deployment_mode` (shared|dedicated).
- Free 0 VND → `confirmed_free` audit; `paidAt` stays null; not revenue.

---

## 2. Auth

| Caller | Auth |
|--------|------|
| Enrollment consume | One-time `enrollmentToken` in JSON body |
| Forum machine APIs | `Authorization: Bearer <forum_machine_credential>` **and** URL `installationId` must match that credential |
| Admin delivery process | Admin session cookie |

Headers Forum should send/accept:

- `x-ops-product-code: pbn`
- `x-ops-forum-id: <forumId>`
- `x-ops-installation-id: <installationId>`
- `x-ops-api-contract: forum-credit/1`
- `x-ops-event-id: <eventId>` (on delivery)

---

## 3. Endpoints (OPS-SERVER)

### Admin (session cookie)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/forum/installations` | Create Forum Installation |
| `GET` | `/api/v1/forum/installations` | List Forums |
| `POST` | `/api/v1/forum/installations/:id/enrollments` | Issue one-time enrollment key |
| `POST` | `/api/v1/forum/credit/orders/:orderId/confirm` | `{ "mode":"paid"\|"free", "creditsToGrant": N }` |
| `POST` | `/api/v1/forum/credit/deliveries/process` | Retry due deliveries |

### Enrollment

`POST /api/v1/forum/enrollments/consume`

```json
{
  "enrollmentToken": "fenr_...",
  "connectionUrl": "https://forum.example.com",
  "clientVersion": "1.0.0"
}
```

Response:

```json
{
  "installationId": "finst_...",
  "forumId": "forum-alpha",
  "apiContractVersion": "forum-credit/1",
  "credential": "<plaintext once>",
  "credentialVersion": 1
}
```

Reuse of token → `409 enrollment_token_used`.

### Connection

- `GET /api/v1/forum/installations/:installationId/connection`
- `POST /api/v1/forum/installations/:installationId/connection` (verify)

### Credit order (Forum → OPS)

`POST /api/v1/forum/installations/:installationId/credit/orders`

```json
{
  "localUserId": "42",
  "orderReference": "pbn_ord_1001",
  "amountVnd": 100000,
  "creditsToGrant": 100,
  "idempotencyKey": "idem_1001"
}
```

Free launch: `amountVnd: 0` → `orderKind: free_grant`.

### Delivery ACK (optional explicit)

`POST /api/v1/forum/credit/deliveries/:eventId/ack`

```json
{ "installationId": "finst_...", "ack": true }
```

Preferred path: respond to push delivery with `{ "ack": true }`.

### Ledger sync (Forum → OPS)

`POST /api/v1/forum/installations/:installationId/credit/ledger/events`

```json
{
  "events": [
    {
      "eventId": "led_evt_1",
      "transactionId": "tx_1",
      "localUserId": "42",
      "transactionType": "grant",
      "creditDelta": 100,
      "sequenceNumber": 1,
      "eventTimestamp": "2026-11-03T00:00:00.000Z",
      "relatedOrderReference": "pbn_ord_1001",
      "correlationId": "corr_1"
    }
  ]
}
```

`GET .../credit/ledger/events?afterSequence=1&limit=100` — replay cursor.

Cross-forum `forumId` mismatch → `403 cross_forum_denied`.

---

## 4. Endpoints PBN Fastify must implement

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/ops/v1/forum/ping` | Connection verify; Bearer = this forum credential |
| `POST` | `/ops/v1/forum/events/credit-granted` | Apply credit **once** per `eventId`; respond `{ "ack": true }` only after durable apply |

### Credit-granted payload (OPS → Forum)

```json
{
  "schemaVersion": "forum-credit/1",
  "eventId": "fc_evt_...",
  "eventType": "forum.credit.granted",
  "forumId": "forum-alpha",
  "installationId": "finst_...",
  "localUserId": "42",
  "orderReference": "pbn_ord_1001",
  "orderId": "fcord_...",
  "orderKind": "paid_topup",
  "amountVnd": 100000,
  "currency": "VND",
  "creditsToGrant": 100,
  "isFreeLaunch": false,
  "confirmedAt": "2026-11-03T00:00:00.000Z"
}
```

**ACK contract**

- Persist apply keyed by `eventId` (and/or `orderId`) before ACK.
- Duplicate delivery → return `{ "ack": true }` again (idempotent), **do not** add credit twice.
- Reject wrong forum / wrong credential → HTTP 401/403; OPS marks rejected/failed and may retry.
- HTTP 200 without `{ "ack": true }` is treated as **not applied**; OPS retries.

Free launch: `amountVnd: 0`, `isFreeLaunch: true`, `orderKind: free_grant`. Still real audit; not a paid receipt.

---

## 5. Credential rotation

1. Admin `POST /api/v1/forum/installations/:id/credentials/rotate` prepares rotation.
2. Response includes plaintext credential **once in HTTP only**.
3. OPS stores the new secret **encrypted** in `forum_credentials` (`status=pending`).  
   `forum_credential_rotations` does **not** contain `plaintext_secret_once` (removed / never persisted).
4. Forum stores new credential locally.
5. Forum `POST .../credentials/rotate/confirm` with **new** Bearer + `rotationId`.
6. Old credential revoked only after confirm.

### Product catalog seed

- Migrations seed `products` with `key=pbn` only when neither `key=pbn` nor conflicting overwrite is required.
- If `key=pbn` already exists with a non-canonical `id`, that existing id is kept.
- Runtime resolves Forum `product_id` via **key=`pbn` first** (`DrizzleForumProductResolver`), not a hard-coded id.

---

## 6. What PBN owns vs OPS

| Concern | Owner |
|---------|--------|
| Credit wallet balance | PBN |
| Credit package pricing | PBN |
| Local users | PBN |
| Real-money payment confirmation | OPS |
| Delivery outbox / retry | OPS |
| Ledger source of truth | PBN |
| Ledger reconciliation copy | OPS |

---

## 7. Explicit non-goals (this handoff)

- Live payment gateway
- ZYVAVU
- Changing SEO-OPS Order / H1
- Shared product Bearer for all forums
- OPS directly writing Forum DB wallets
