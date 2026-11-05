# PBN Monetizable Service Inventory

**Audit type:** READ-ONLY source audit (no DB mutation, no migration, no commit/push/deploy)  
**Machine:** DESKTOP (`T--rung`)  
**Repo:** `D:\workspace-2026\pbn` (`nodebbs-forum`)  
**Branch observed:** `chore/pbn-phase1-5-i18n`  
**Date:** 2026-11-04  
**Business rule:** PBN owns service logic + charge timing; OPS owns all prices, VND conversion, discounts, commercial policy. PBN must not invent money prices. Historical purchase economics stay locked.

---

## Executive summary

PBN already runs a **wallet SoT** (`sys_accounts` / `sys_transactions`) plus two OPS contracts:

| Contract | Role on PBN |
|----------|-------------|
| `forum-credit/1` | Enrollment, credit orders to OPS, inbound `credit-granted`, ledger outbox reconciliation |
| `forum-pricing/1` | Signed catalog sync (Ed25519 trust-pinned), SEO / paid pin / credit package / freeLaunch projection |

**OPS-priced commercial SKUs in catalog today (fixture + code):**

| Catalog type | Example codes | Spend / grant | User UX | Completeness |
|--------------|---------------|---------------|---------|--------------|
| `seo_entitlement` | `seo-monthly`, `seo-monthly-paid` (+ alias `seo_audit_basic`) | Local wallet deduct `seo_purchase` | Topic panel DONE | **DONE** |
| `paid_pin` | `pin_24h`, `pin_7d` | Local wallet deduct `pin_purchase` | UI MISSING (API DONE) | **PARTIAL** |
| `credit_package` | `pack_100`, `pack_500` | OPS order → inbound grant `ops_credit_grant` | Admin order only | **PARTIAL** |
| `freeLaunch` policy | (not a SKU code) | OPS free grant → `ops_credit_grant` | Admin order only | **PARTIAL** |

**There is no dedicated service registry / discovery protocol** that lists all monetizable service codes independently of the pricing snapshot. Catalog projection (`viewFromSnapshot`) is the closest mechanism.

Non-OPS wallet movers still exist (tips, lottery, attachment P2P, optional reply fee, admin grant/deduct). Engagement auto-grants are **retired (410)**. Shop decoration / legacy `topic_pin` shop buy paths are **retired (410)**.

---

## A. Source audit — transaction pipeline

```
OPS (money + catalog authority)
  │ creditPackages / freeLaunch  →  credit/orders  →  credit-granted
  │ seoServices / paidPins       →  signed snapshot (forum-pricing/1)
  ▼
forum-pricing/1 ──Ed25519 verify (local trust registry)──► ops_forum_pricing_snapshots
  │
  ▼
PBN local wallet (LedgerService grant/deduct/transfer)
  │ SEO / pin deduct here; package/free credits arrive via grant
  ▼
ops_forum_ledger_outbox ──ingest──► OPS reconciliation copy
  (idempotent: eventId, transactionId, sequenceNumber)
```

### Wallet SoT

- **Service:** `apps/api/src/extensions/ledger/services/ledgerService.js` — `grant`, `deduct`, `transfer`, `getAccount`
- **Currency:** `credits` (`DEFAULT_CURRENCY_CODE`)
- **Engagement block:** `apps/api/src/extensions/ledger/engagement.js` — rejects automatic engagement grant types with 410

### OPS credit in / outbox

| Concern | Location | Key symbols |
|---------|----------|-------------|
| Contract constants | `apps/api/src/extensions/forum-credit/constants.js` | `FORUM_CREDIT_CONTRACT`, `TX_TYPE_OPS_CREDIT_GRANT` |
| Enrollment | `.../forum-credit/services/enrollmentService.js` | `EnrollmentService` |
| Inbound grant | `.../forum-credit/services/receiverService.js` | `applyCreditGranted` (idempotent on `eventId`) |
| Package / free orders | `.../forum-credit/services/creditOrderService.js` | `createPackageOrder`, `createFreeGrantOrder` |
| Admin routes | `.../forum-credit/routes/admin.js` | package + free order endpoints |
| Outbox | `.../forum-credit/services/ledgerSyncService.js` | `enqueueFromTransaction`, `processDue`, hooks on grant/deduct |
| Schema | `.../forum-credit/schema.js` + baseline `0005_forum_credit.sql` | connections, deliveries, orders, outbox |

### OPS pricing catalog

| Concern | Location | Key symbols |
|---------|----------|-------------|
| Contract / SKU aliases | `apps/api/src/extensions/forum-pricing/constants.js` | `FORUM_PRICING_CONTRACT`, `SEO_SKU_CODES`, `SEO_SKU_ALIASES`, `PAID_PIN_MIGRATION_STATUS` |
| Validate | `.../forum-pricing/validate.js` | durationMonths 1–12, renewalWindowDays 0–14 required |
| Ed25519 | `.../forum-pricing/crypto.js` | `verifyForumPricingSnapshot` |
| Trust pinning | `.../forum-pricing/trust.js` | local key registry (`FORUM_PRICING_TRUST_*`) |
| Sync | `.../forum-pricing/services/syncService.js` | `syncFromOps`, `ingestSnapshot`, getters |
| Catalog view | `.../forum-pricing/services/catalogView.js` | `viewFromSnapshot`, `findPackage`, `findSeoService`, `findPaidPin` |
| Facade | `.../forum-pricing/index.js` | `fastify.forumPricing.*` |
| Fixtures | `contracts/forum-pricing/v1/snapshot.example.json` | example SKUs only — **not live prices** |

### Hardcoded / admin-entered prices (status)

| Source | Status |
|--------|--------|
| OPS signed `forum-pricing/1` catalog | **Authority** for packages, SEO, pins, freeLaunch, `vndPerCredit` |
| Forum-admin pin product CRUD / monetary edits | **Disabled** → 410 `OPS_PRICING_AUTHORITY` |
| Shop `topic_pin` / decoration buy | **Blocked** (`rejectDecorationCommerce` / pin redirect) |
| `CREDIT_VND = 10000` in `seo/constants.js` | Legacy fixture/bootstrap only; runtime uses snapshot `vndPerCredit` |
| `DEFAULT_QUOTE_TTL_SECONDS = 900` / `QUOTE_SECONDS = 300` | Local TTL defaults if catalog omits TTL — **not** unit prices |
| Legacy file envelope `ops_price_snapshots` / `seo_products` | Fallback when HTTP pricing view absent/expired |
| Lottery / tip / attachment / reply-fee amounts | **Not OPS catalog** (P2P or local currency config) |

---

## B. Service registry — current state

### What exists today

1. **Verified OPS snapshot** stored locally (`ops_forum_pricing_snapshots`).
2. **Projection** into typed lists: `products` (SEO), `creditPackages`, `paidPins`, `freeLaunch`.
3. **Lookup APIs:**
   - Public: `GET /api/seo/products`, `GET /api/seo/credit-packages`, `GET /api/pins/products`
   - Admin: `GET /api/ops/forum/pricing/catalog`, `GET /api/ops/forum/pricing/status`
4. **Local SEO SKU alias map only** (`seo_audit_basic` → `seo-monthly-paid`). Not a general registry.
5. **Pin migration flag** `PAID_PIN_MIGRATION_STATUS = 'OPS_CATALOG'`.

### What does **not** exist

- No stable cross-cutting `serviceCode` registry module separate from pricing SKUs.
- No PBN → OPS “announce services / features” sync (capability manifesto).
- No first-class detection pipeline for “new / renamed / retired service” beyond snapshot diff of published versions.
- No grep hits for `service registry`, `discoverService`, `SERVICE_SKU`, etc.

### Additive proposal (do **not** implement in this audit)

Keep `forum-credit/1` and `forum-pricing/1` unchanged as money/trust planes. Add an optional **capability / service discovery** envelope that OPS can ignore until ready:

```text
forum-services/1  (proposed, additive)

PBN → OPS (on enroll / periodic heartbeat):
  {
    "schemaVersion": "forum-services/1",
    "productKey": "pbn",
    "installationId": "...",
    "forumId": "...",
    "services": [
      {
        "serviceCode": "seo_entitlement",
        "opsCatalogField": "seoServices",
        "skuNamespace": "seo-*",
        "chargePlane": "local_wallet",
        "pricingContract": "forum-pricing/1",
        "creditContract": "forum-credit/1",
        "features": ["quote_lock", "renewal_window", "duration_months"],
        "status": "active" | "partial" | "retired"
      },
      ...
    ],
    "pbnBuild": "<git sha or package version>"
  }

OPS → PBN (optional ack):
  { "ack": true, "unknownServiceCodes": [], "retiredServiceCodes": [] }
```

**Compatibility rules:**

- Discovery must never carry unit prices, VND, or discounts (those stay in `forum-pricing/1`).
- Pricing snapshot remains sole commercial authority for enabled SKUs.
- New PBN services ship as `status: partial` until OPS publishes matching catalog rows.
- Renames use alias maps on PBN (like `SEO_SKU_ALIASES`) + OPS republish; discovery reports both codes.
- Retirement: PBN marks `retired`; purchase routes fail closed; historical entitlements/purchases untouched.

---

## C. Service reports

Completeness legend: **DONE** = business path live end-to-end · **PARTIAL** = core logic present but UX/ops gap · **MISSING** = not implemented · **RETIRED** = explicitly disabled.

---

### C1. `seo_entitlement` — SEO topic entitlement (renew / upgrade / activate)

| Field | Value |
|-------|-------|
| **serviceCode** | `seo_entitlement` |
| **OPS catalog field** | `seoServices[]` |
| **SKU codes (fixture + constants)** | `seo-monthly` (0-credit free launch plan), `seo-monthly-paid`; alias `seo_audit_basic` → `seo-monthly-paid` |
| **Name / description** | Monthly SEO entitlement on a topic (link policy / SEO window); renew inside OPS `renewalWindowDays` |
| **Function** | Owner quotes → confirms purchase → entitlement months stacked via `pbn_seo_add_months` |
| **Unit** | 1 entitlement × `durationMonths` (OPS 1–12); price in Credits |
| **Fee trigger** | Owner confirms purchase against unexpired open quote; `totalCredits > 0` → deduct; `0` skips deduct |
| **Logic** | `SeoService` (`quote`, `purchase`, `renewal`, `cancel`, `correct`, `expire`, `eligible`) |
| **Price storage** | Prefer verified `forumPricing` catalog; else legacy `ops_price_snapshots` + `seo_products`. Locked into `seo_quotes` / `seo_purchases.price_snapshot` |
| **Credit move** | `ledger.deduct` type `seo_purchase`; admin technical refund `seo_correction` grant |
| **Quote / purchase lock** | `seo_quotes`: `unit_price`, `quantity`, `total_credits`, `price_version`, `credit_vnd`, `price_snapshot`, `expires_at`, `status`. Purchase consumes quote economics even if catalog moved. Idempotency `(userId, idempotencyKey)` + payload hash |
| **Eligibility / quota** | Topic owner; approved topic; policy `seo_purchase`; `seo_purchase_allowed` or RBAC override; renewal window vs active entitlement |
| **Files / functions** | `apps/api/src/modules/forum/services/seo/service.js`; routes `.../routes/seo/index.js`; schema `.../db/seo-schema.js`; UI `SeoEntitlementPanel.jsx`; constants `forum-pricing/constants.js`, `seo/constants.js` |
| **Runtime class** | **Active commercial service** |
| **Completeness** | **DONE** (API + UI + quote lock + OPS catalog preference) |

**Notes / gaps**

- Dual catalog stores (HTTP `ops_forum_pricing_snapshots` vs legacy file `ops_price_snapshots`) — SEO falls back to legacy.
- OPS machine quote (`POST /api/ops/forum/pricing/quotes` → `createOpsQuote`) is **admin-only** and **not** wired into SEO purchase (local `seo_quotes` is the lock used by UX).
- Cancel / expire: **no refund** by design; correction is admin technical path only.

---

### C2. `paid_pin` — Paid topic pin (ghim bài)

| Field | Value |
|-------|-------|
| **serviceCode** | `paid_pin` |
| **OPS catalog field** | `paidPins[]` |
| **SKU codes (fixture)** | `pin_24h`, `pin_7d` |
| **Name / description** | Time-boxed paid pin entitlement on a topic; stacks on existing active pin end |
| **Function** | Owner purchases OPS SKU → wallet deduct → `pin_entitlements` |
| **Unit** | `durationHours` from OPS → `durationSeconds`; price Credits |
| **Fee trigger** | Successful `PinService.purchase` after eligibility |
| **Logic** | `PinService.plans/purchase/cancel/correct/expire/eligible` |
| **Price storage** | OPS catalog only via `forumPricing.getPaidPin`; Forum-admin price edits disabled |
| **Credit move** | `ledger.deduct` type `pin_purchase`; correction `pin_correction` grant |
| **Quote / purchase lock** | **Soft only:** client may send `expectedPrice` / `expectedDuration`; no durable quote row like SEO. Purchase row stores `price`, `ops_sku_code`, `pricing_version`, `pricing_authority` |
| **Eligibility** | Topic owner; approved content; policy `pin_purchase` |
| **Files / functions** | `apps/api/src/modules/forum/services/pinService.js`; routes `.../routes/pins/index.js`; schema `.../db/pin-schema.js`; `PaidPinPanel.jsx` **re-exports SEO panel only** |
| **Runtime class** | **API active; user UI missing** |
| **Completeness** | **PARTIAL** |

**Notes / gaps**

- Dashboard `/dashboard/pins` redirects toward SEO admin historically; monetary pin admin CRUD returns 410.
- Legacy `shop_items.topic_pin` must not be sold via shop (`buyItem` rejects / decoration 410).

---

### C3. `credit_package` — Credit top-up (VND → Credits via OPS)

| Field | Value |
|-------|-------|
| **serviceCode** | `credit_package` |
| **OPS catalog field** | `creditPackages[]` |
| **SKU codes (fixture)** | `pack_100`, `pack_500` |
| **Name / description** | Paid top-up: user pays VND on OPS; PBN wallet receives Credits after `credit-granted` |
| **Function** | Admin creates order echoing OPS package economics → OPS confirms payment → inbound grant |
| **Unit** | Package: `credits` + `priceVnd` from OPS; quantity 1 |
| **Fee trigger** | Money collected on OPS (not local deduct). Local Credits increase only on granted event |
| **Logic** | `CreditOrderService.createPackageOrder` → `opsClient.createCreditOrder`; `ReceiverService.applyCreditGranted` |
| **Price storage** | OPS catalog (`amountVnd` / `creditsGranted` echoed for tamper check). Never invented on PBN |
| **Credit move** | Inbound `ledger.grant` type `ops_credit_grant` |
| **Quote / purchase lock** | Optional OPS `quoteId` on order body; order idempotency `(installationId, idempotencyKey)` + `orderReference` |
| **Files / functions** | `creditOrderService.js`, `receiverService.js`, admin forum-credit routes, ops-connection dashboard |
| **Runtime class** | **Admin/OPS path active; no end-user storefront** |
| **Completeness** | **PARTIAL** |

Public `GET /api/seo/credit-packages` lists packs; create order requires `dashboard.extensions`.

---

### C4. `free_launch` — Free credit grant policy

| Field | Value |
|-------|-------|
| **serviceCode** | `free_launch` |
| **OPS catalog field** | `freeLaunch` `{ enabled, creditsToGrant, maxPerLocalUser }` |
| **SKU codes** | None (policy object). Zero-VND package may also map to `orderKind=free_grant` |
| **Name / description** | Non-revenue Credit grant under OPS free-launch policy |
| **Function** | Admin free order → OPS → `credit-granted` with `isFreeLaunch` / `amountVnd=0` |
| **Unit** | Credits integer from OPS policy |
| **Fee trigger** | No VND; Credits granted on delivery |
| **Logic** | `createFreeGrantOrder`; rejects client `creditsToGrant` mismatch (`price_tamper`) |
| **Price storage** | OPS `freeLaunch` only |
| **Credit move** | `ops_credit_grant` |
| **Completeness** | **PARTIAL** (admin-only; `maxPerLocalUser` enforcement is OPS-side — PBN echoes policy, does not invent grants) |

---

### C5. Wallet movers that are **not** OPS monetization SKUs

These change Credit balances but are **outside** `forum-pricing/1` commercial catalog. Listed for inventory completeness.

#### C5a. `reward_tip` (user tip / 打赏)

| Field | Value |
|-------|-------|
| **serviceCode** | `reward_tip` (proposed discovery code; not in OPS catalog) |
| **Function** | User → user transfer on post/topic |
| **Unit** | Credits; amount chosen by tipper within local min/max config |
| **Credit move** | `ledger.transfer` type `reward_post` |
| **Price authority** | Local rewards config — **not OPS** |
| **Files** | `apps/api/src/extensions/rewards/routes/index.js` |
| **Completeness** | **DONE** (non-OPS feature) |

#### C5b. `admin_wallet_adjust`

| Field | Value |
|-------|-------|
| **serviceCode** | `admin_wallet_adjust` |
| **Function** | Admin grant/deduct |
| **Credit move** | `admin_grant` / `admin_deduct` |
| **Files** | `rewards/routes/index.js` |
| **Completeness** | **DONE** (ops escape hatch; not commercial SKU) |

#### C5c. `lottery`

| Field | Value |
|-------|-------|
| **serviceCode** | `lottery` |
| **Function** | Freeze stake, grant winners, refunds |
| **Credit move** | `lottery_freeze`, `lottery_refund`, winner grants, etc. |
| **Price authority** | Lottery creator config — **not OPS** |
| **Files** | `apps/api/src/modules/forum/services/lotteryService.js` |
| **Completeness** | **DONE** (community feature) |

#### C5d. `attachment_purchase`

| Field | Value |
|-------|-------|
| **serviceCode** | `attachment_purchase` |
| **Function** | P2P buy paid attachment (`pointsCost` set by uploader) |
| **Credit move** | `transfer` `attachment_purchase` (+ refund types) |
| **Price authority** | Content owner — **not OPS** |
| **Files** | `attachmentService.js` |
| **Completeness** | **DONE** (P2P) |

#### C5e. `post_reply_fee` (conditional)

| Field | Value |
|-------|-------|
| **serviceCode** | `post_reply_fee` |
| **Function** | If currency config `post_reply_amount` is **negative**, reply deducts Credits |
| **Credit move** | `ledger.deduct` type `post_reply` |
| **Price authority** | Local `sys_currencies` config — **not OPS** |
| **Files** | `modules/forum/routes/posts/index.js` |
| **Completeness** | **PARTIAL** (config-driven; engagement grant path retired, but deduct fee still possible) |

#### C5f. Engagement auto-grants / invite / check-in — **RETIRED**

| Field | Value |
|-------|-------|
| **serviceCode** | `engagement_rewards` |
| **Status** | **RETIRED** — `rejectEngagementCredit` 410 on grant types: `check_in`, `post_topic`, `post_reply`, `receive_like`, `invite_user`, `register*`, badge/achievement rewards; rewards engagement routes 410 |
| **Files** | `ledger/engagement.js`, `rewards/services/rewardService.js` (`rejectRetiredCheckIn`), register invite grant blocked at ledger |

#### C5g. Shop decoration / legacy shop pin — **RETIRED**

| Field | Value |
|-------|-------|
| **serviceCode** | `shop_decoration` / legacy `shop_topic_pin` |
| **Status** | **RETIRED** 410 via `rejectDecorationCommerce`; non-GET shop mutations 410; `topic_pin` buy redirected to pin purchase |
| **Files** | `shop/commerce.js`, `shop/services/shopService.js`, `shop/routes/index.js` |
| **Seed leftover** | `scripts/init/shop.js` `DEFAULT_SHOP_ITEMS` may still contain hardcoded seed prices — **not live commerce** |

---

## D. Compatibility with current protocols

### D1. `forum-credit/1`

| Aspect | Status |
|--------|--------|
| Enrollment + machine credential | Implemented |
| Inbound ping + `credit-granted` ACK after durable commit | Implemented |
| Order create with echo tamper fields | Implemented |
| Delivery idempotency on `eventId` | Implemented |
| Outbox idempotency on `transactionId` / unique `eventId` / `sequenceNumber` | Implemented |
| Wallet SoT remains PBN | Affirmed |

**Adding discovery:** attach capability payload to enroll/verify or a new optional path; do not alter grant/event schemas.

### D2. `forum-pricing/1`

| Aspect | Status |
|--------|--------|
| Snapshot schema + Ed25519 signature | Implemented |
| Trust pinning (local registry; sync `publicKey` alone not trusted) | Implemented (`trust.js`) |
| Catalog fields: packages, seoServices, paidPins, freeLaunch, vndPerCredit | Validated + projected |
| Offline: last verified snapshot retained | Sync failure retains prior |
| Quote survival (protocol): newer version must not reprice open quote | SEO local quotes enforce this; OPS quotes exist but unused by SEO UX |
| Historical purchase lock | SEO: `seo_purchases.price_snapshot` + accounting checks; Pin: stored `price` on entitlement; Packages: OPS order + delivery amounts |

**Adding discovery:** keep prices exclusively in pricing snapshots. Discovery announces *which* service codes PBN can charge; OPS enables SKUs in catalog separately.

### D3. Historical price locks — matrix

| Service | Lock mechanism | Gap |
|---------|----------------|-----|
| SEO | Durable `seo_quotes` + copied into `seo_purchases` | Strong |
| Paid pin | Soft `expected*` + entitlement `price` at purchase | No pre-purchase quote TTL row |
| Credit package | OPS order + delivery record | Local order stores echoed amounts; money confirm on OPS |
| Free launch | OPS policy at order time | — |

### D4. Ledger / outbox idempotency

- Hook wraps `ledger.grant` / `ledger.deduct` when enrolled; nested receiver TX enqueues explicitly.
- Cleanup task `forum-credit-ledger-sync` + admin retry.
- Duplicate outbox insert on `transactionId` → no-op.

### D5. Safe additive discovery (summary)

1. Do not bump `forum-credit/1` or `forum-pricing/1` schemaVersions for discovery alone.
2. Introduce optional `forum-services/1` (or embed `capabilities` under enroll metadata OPS can ignore).
3. PBN continues fail-closed on missing OPS SKU (`PRICE_UNAVAILABLE`).
4. Alias tables for renames; never rewrite historical purchase snapshots.
5. UI may list discovery “coming soon” services without exposing inventable prices.

---

## E. Service matrix

| serviceCode | OPS field / SKU | Charge plane | Price SoT | Quote lock | Credit Δ type | User UI | Admin UI | Status |
|-------------|-----------------|--------------|-----------|------------|---------------|---------|----------|--------|
| `seo_entitlement` | `seoServices` / `seo-monthly*` | Local deduct | OPS catalog | Strong (`seo_quotes`) | `seo_purchase` | Topic panel | `/dashboard/seo` | **DONE** |
| `paid_pin` | `paidPins` / `pin_*` | Local deduct | OPS catalog | Soft (`expected*`) | `pin_purchase` | Missing | API / 410 admin price | **PARTIAL** |
| `credit_package` | `creditPackages` / `pack_*` | OPS VND → grant | OPS catalog | Optional OPS quote | `ops_credit_grant` | Missing | ops-connection + API | **PARTIAL** |
| `free_launch` | `freeLaunch` | OPS grant | OPS policy | N/A | `ops_credit_grant` | Missing | ops-connection | **PARTIAL** |
| `reward_tip` | — | P2P transfer | Local min/max | N/A | `reward_post` | Rewards UX | — | DONE (non-OPS) |
| `admin_wallet_adjust` | — | Admin | Operator | N/A | `admin_grant`/`deduct` | — | Rewards admin | DONE |
| `lottery` | — | Freeze/grant | Lottery config | N/A | `lottery_*` | Forum lottery | — | DONE (non-OPS) |
| `attachment_purchase` | — | P2P transfer | Uploader `pointsCost` | N/A | `attachment_purchase` | Attachment UX | — | DONE (non-OPS) |
| `post_reply_fee` | — | Local deduct | Currency config | N/A | `post_reply` | Implicit | Currency admin | PARTIAL |
| `engagement_rewards` | — | — | — | — | blocked 410 | Retired | — | **RETIRED** |
| `shop_decoration` | — | — | Seed leftovers | — | blocked 410 | Retired | — | **RETIRED** |

---

## F. Gaps to close (recommended order; no implementation in this audit)

1. **Paid pin UX** — restore a real pin purchase panel (do not leave `PaidPinPanel` as SEO re-export); keep prices from OPS catalog only; consider durable pin quotes mirroring SEO for historical lock parity.
2. **End-user credit package storefront** — user-facing order create (today admin-only) while OPS remains payment authority.
3. **Unify pricing authority path** — prefer HTTP `ops_forum_pricing_snapshots` everywhere; document/retire legacy file envelope once all forums enrolled.
4. **Wire or explicitly deprecate OPS machine quotes** for SEO — today SEO UX uses local DB quotes only.
5. **Service discovery contract (`forum-services/1`)** — additive manifesto PBN → OPS for SKU/feature drift detection.
6. **Clarify non-OPS wallet fees** (`post_reply_fee`, tips, lottery, attachments) in commercial policy so OPS reporting does not treat them as catalog SKUs.
7. **Pin quote lock** — optional `pin_quotes` table for parity with SEO historical lock semantics.

---

## G. Proposed PBN → OPS contract sketch (additive)

### G1. Keep as-is

- `forum-credit/1` — money delivery + ledger reconciliation  
- `forum-pricing/1` — signed commercial catalog + quotes/orders economics  

### G2. New optional: `forum-services/1`

**Purpose:** tell OPS which monetizable *capabilities* this PBN build supports, without prices.

**Transport ideas (pick one later):**

- Extra JSON field on enroll/verify responses OPS may ignore  
- `POST /api/v1/forum/installations/:id/services/announce`  
- Embed in ledger sync metadata heartbeat (least preferred)

**Minimal service record:**

| Field | Meaning |
|-------|---------|
| `serviceCode` | Stable PBN code (`seo_entitlement`, `paid_pin`, …) |
| `opsCatalogField` | `seoServices` \| `paidPins` \| `creditPackages` \| `freeLaunch` \| `null` |
| `skuCodes` | Known local aliases / expected OPS codes (informational) |
| `chargePlane` | `local_wallet` \| `ops_order_grant` \| `p2p_transfer` \| `retired` |
| `features[]` | e.g. `quote_lock`, `renewal_window`, `idempotent_purchase` |
| `status` | `active` \| `partial` \| `retired` |
| `pricingContract` | `forum-pricing/1` or `none` |
| `creditContract` | `forum-credit/1` or `none` |

**Ops reaction (optional):** mark unknown codes; warn when OPS catalog enables SKU whose `serviceCode` is `retired`/`missing` on PBN.

---

## H. Source reference index

### Contracts / docs

- `contracts/forum-credit/v1/`
- `contracts/forum-pricing/v1/` (`protocol.md`, `signing.md`, `snapshot.example.json`, quote/order fixtures, `failure-matrix.md`)
- `docs/forum-credit-protocol-handoff.md`
- `docs/forum-pricing-protocol-handoff.md`
- `docs/PBN-OPS-FORUM-CREDIT-INTEGRATION.md`
- `docs/PBN-OPS-FORUM-PRICING.md`
- `docs/PBN-OPS-FORUM-PRICING-HARDENING.md`
- `docs/PBN-OPS-FORUM-PRICING-RECONCILIATION.md`
- Prior audits: `docs/audit/PHASE2.3-WALLET-SEO-ENTITLEMENTS.md`, `PHASE2.3-WALLET-PAID-PIN.md`

### Baselines

- `apps/api/baseline/0005_forum_credit.sql`
- `apps/api/baseline/0006_forum_pricing.sql`
- `apps/api/baseline/0007_forum_pricing_ops.sql`
- `apps/api/baseline/0008_forum_pricing_hardening.sql`

### Core implementation

- `apps/api/src/extensions/ledger/**`
- `apps/api/src/extensions/forum-credit/**`
- `apps/api/src/extensions/forum-pricing/**`
- `apps/api/src/modules/forum/services/seo/**`
- `apps/api/src/modules/forum/services/pinService.js`
- `apps/api/src/modules/forum/routes/{seo,pins}/**`
- `apps/web/src/modules/forum/components/topic/SeoEntitlementPanel.jsx`
- `apps/web/src/modules/forum/components/topic/PaidPinPanel.jsx`
- `apps/web/src/app/dashboard/ops-connection/page.js`
- `apps/web/src/app/profile/wallet/page.js`

---

## I. Audit constraints respected

- READ-ONLY investigation of source and contracts  
- No DB writes, migrations, commits, pushes, or deploys  
- No new services or price levels invented beyond codes already present in source/fixtures  
- Fixture SKUs (`pack_100`, `pin_24h`, …) documented as **contract examples**, not asserted as production OPS catalog contents for any live forum

---

*End of inventory.*
