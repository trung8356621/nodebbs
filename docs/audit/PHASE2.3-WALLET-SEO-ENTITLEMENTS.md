# Phase 2.3 FINAL — Credit wallet and monthly SEO entitlements

Status: implementation and local acceptance PASS. This report supersedes the earlier paid-placement Phase 2.3 report. Verification uses native Windows/Laragon PostgreSQL 17.2, Redis 16379, and independent Forum A/B processes. No Docker, real OPS service or production deployment was used.

## Delivered behavior

| Requirement | Result | Evidence |
|---|---|---|
| Integer Credit, 1 Credit = 10,000 VND | PASS | One exported `CREDIT_VND` constant; catalog/quote carry conversion; owner and Admin display VND |
| Existing Wallet reuse and exact paid debit | PASS | Existing LedgerService and contextual database transactions; 20-way real PostgreSQL concurrency |
| Valid zero-price activation | PASS | Explicit persisted quote/confirmation, immutable purchase and entitlement/event; no zero ledger row |
| Signed, forum-specific external catalog | PASS | Ed25519/checksum, strict schema, monotonic snapshots, replay/conflict/downgrade rejection; independent A/B fixture keys |
| Future prices and Vietnam midnight | PASS | Production SQL selector at 23:59:59 and 00:00:00; actual near-future boundary and stale quote rejection |
| Monthly lifecycle and bounded renewal | PASS | Vietnam calendar clamp, exact old-end extension, expired renewal from now, signed renewal window |
| No placement or moderator-pin changes | PASS | Ordering uses `topics.is_pinned` only; SEO purchase never writes it; explicit moderator-pin regression |
| Reserved topics | PASS | Server permission, locked eligibility recheck, immediate suspension, preserved dates/history |
| Outbound rel and immutable authored body | PASS | DOM/no-JS SSR, reply isolation, independent editorial, escaped raw HTML, URL/token matrix |
| Expiry independent of worker | PASS | Database-time reads and one browser deadline; isolated restored monthly fixture with worker delayed |
| VI/EN owner and read-only price Admin | PASS | Chromium on both forums, both locales, screenshots |
| Migration, preservation and portable restore | PASS | Fresh v1–v6, reruns, protected A/B backup rehearsals and all-table export/restore fingerprints |
| Lint, localization, A/B builds | PASS | Zero lint errors (11 existing unused-directive warnings), 2,641 web keys/locale, 740 backend templates, both builds exit 0 |
| Real OPS / production readiness | NOT TESTED | Development receiver/mock only; see limits below |
| Payments, banners, placement auctions | NOT APPLICABLE | Excluded from this phase |

## Source and Wallet design

`apps/api/src/modules/forum/services/seo/` contains the conversion constant, strict signed-price receiver, effective read model and transactional SEO service. `db/seo-schema.js` adds seven dedicated tables: `ops_price_snapshots`, `seo_products`, `seo_quotes`, `seo_purchases`, `seo_entitlements`, `seo_events`, `ops_price_syncs`. Existing moderator pins, Shop, accounts, ledger, passwords, content, legacy purchases and audit rows are preserved. No legacy purchase is converted into a new SEO purchase.

Checkout reuses `LedgerService.getAccount/deduct/grant` and the existing AsyncLocalStorage transaction adapter. Durable user/idempotency uniqueness and a transaction advisory lock serialize retries; the hash binds topic and quote. A topic/content lock serializes purchases with edits, moderation and reservation. Shared policy and price locks prevent an accepted write from bypassing concurrent policy/snapshot changes. The wallet row is locked **before** selecting the final current price with database clock time, so waiting for funds cannot carry a pre-boundary quote across a price change.

Paid purchase, exact debit, purchase snapshot, monthly entitlement and audit event commit together. Deferred database triggers require a matching entitlement and exact Credit debit for each paid purchase and a purchase for every SEO debit. Free activations use the same ownership, moderation, policy, currency and renewal checks, skip only the debit, and record before/after balance unchanged. Negative/unsafe balances are constrained. Injecting failure in the final audit insert rolls everything back.

Committed retries return the original receipt, including after API restart or a lost browser response/reload. A different payload with the same key conflicts. Quote reuse with another key conflicts. Original transactions, purchases, price snapshots, quotes and audit events reject mutation/deletion. Entitlement identity, dates and original terms are immutable; closed terms cannot reactivate. Technical corrections require `dashboard.ledger`, an explicit reason and durable key: append a linked positive compensation for a paid error, close its entitlement, and preserve every original row. Free corrections create no fabricated ledger movement. Ordinary owners can deactivate without refund; hiding, editing and expiry never refund or extend terms.

## OPS receiver contract

Per-forum owner-protected configuration in the ignored secrets file:

- `opsPriceTrustKeyFile`: operator-installed Ed25519 public-key PEM path.
- `opsPriceSnapshotFile`: signed JSON envelope path.
- `opsPriceSourceId`: exact expected source identifier.

Runtime maps these to `OPS_PRICE_TRUST_KEY_FILE`, `OPS_PRICE_SNAPSHOT_FILE`, `OPS_PRICE_SOURCE_ID`, clearing inherited provider variables before selecting a forum. Ordinary Forum Admin has no price-edit or sync HTTP endpoint. `node scripts/forum-seo.mjs sync forums/forum-a.json` is an operator command. The native file provider verifies on startup and at five-minute intervals, using the existing pool. Checkout does not access that file or the network.

The envelope is `{payload, checksum, signature}`: canonical base64 of exact UTF-8 JSON bytes, lower-case SHA-256 hex of those bytes, and base64 Ed25519 signature over those same bytes. Maximum decoded size is 1 MB. Payload:

```json
{
  "schemaVersion": 1,
  "version": 2,
  "forumId": "forum_a",
  "sourceId": "operator-ops",
  "issuedAt": "2026-10-22T00:00:00Z",
  "validUntil": "2026-11-02T00:00:00+07:00",
  "products": [
    {
      "id": "seo-monthly",
      "priceVersion": 2,
      "type": "seo_entitlement",
      "name": "Monthly SEO",
      "durationMonths": 1,
      "listPriceCredit": 5,
      "salePriceCredit": 0,
      "enabled": true,
      "effectiveAt": "2026-10-22T00:00:00+07:00",
      "endsAt": "2026-11-01T00:00:00+07:00",
      "renewalWindowDays": 7,
      "discount": {"amountCredit": 5, "percentage": 100}
    },
    {
      "id": "seo-monthly",
      "priceVersion": 3,
      "type": "seo_entitlement",
      "name": "Monthly SEO",
      "durationMonths": 1,
      "listPriceCredit": 5,
      "salePriceCredit": 5,
      "enabled": true,
      "effectiveAt": "2026-11-01T00:00:00+07:00",
      "renewalWindowDays": 7
    }
  ]
}
```

Example only; no production business price is hardcoded. Required fields cannot be omitted or coerced. Timestamps require valid ISO date/time and an explicit offset; impossible dates are rejected. Snapshot version and price versions are positive integers; at most 200 product intervals; duration 1–12 months; integer prices 0–1,000,000,000; list >= sale; renewal window 0–14 days. Optional end must exceed start. Intervals for one stable ID cannot overlap. Optional discount metadata has only label, exact amount and/or an exact integer percentage; no invented original price, coupon or local campaign calculation.

Import validates target forum, configured source, key type, signature, checksum, schema, timestamp freshness and monotonic version under a database lock, then inserts atomically. Explicit imports reject replay; periodic file-provider checks may return an authenticated exact-version/checksum no-op without another snapshot or success-audit row. Lower versions and same-version/different-content are rejected. Failed sync attempts are diagnostic records; the last accepted snapshot is never overwritten.

Only the latest accepted snapshot is eligible for **new** purchases, and only while `validUntil` is in the future. Missing, disabled, not-yet-effective, ended or expired pricing is unavailable; there is no fallback to an older price or accidental free activation. Previously purchased terms remain valid independently of later price/source expiry. Replacing a snapshot never changes original purchase prices.

## Quote and time semantics

Quotes are immutable server-side rows, bound to user/topic/product and exact price/snapshot version. They last at most 300 seconds and are clipped by the current interval end and snapshot validity. The browser persists the pending quote and idempotency key in origin/user/topic-specific session storage; a lost response can be retried after reload. A new version, boundary or expired quote returns 409 and requires another explicit confirmation, never a silent charge increase.

Times are `timestamptz`, compared by database statement/clock timestamps; display and calendar arithmetic use `Asia/Ho_Chi_Minh`. `pbn_seo_add_months` adds calendar months in that local zone, preserving local time and clamping to the target month's last valid day. January 29–31 clamp to February 28 or leap-year February 29; February 29 plus one month becomes March 29. A subsequent renewal extends from that actual clamped end, rather than reconstructing an unavailable original day.

First purchase starts at the authoritative accepted transaction time. An eligible active renewal starts at the existing maximum active end; an expired renewal starts now. The signed renewal window applies identically at every price, including zero. Its 14-day maximum and minimum one-month duration prevent immediate repeated accumulation of future free months.

Effective SEO requires an active term whose start <= database time < expiry, owner matching the topic author, approved/visible topic and first post, eligible author, and `seo_purchase_allowed=true`. Reserving a topic immediately suspends its effective SEO, preserves the original calendar and history, and issues no refund. Unreserving resumes only any still-valid term. Moderation hiding likewise suppresses effect without altering financial history.

## Rendering, caching and runtime cost

Ordinary outbound HTTP(S) topic links receive `ugc nofollow`; effective SEO receives `ugc sponsored`; advertising classification remains sponsored. Explicit independent noncommercial editorial review retains only `noopener noreferrer`. Admin role, ownership and reservation do not confer editorial status. Any new SEO or legacy commercial history prevents the editorial exception, including a zero-price activation. Editing reviewed title/body resets editorial approval. Replies/quotes use their own ordinary UGC policy; navigation/header/footer are not rewritten.

`content-link-policy.js` supplies the shared native-anchor rendering used by SSR and hydration, keeps exact-origin/relative internal links separate, and preserves security tokens. Existing Markdown sanitization continues to reject unsafe schemes and escape raw HTML; permitted raw HTML is not enabled in this repository, so an authored HTML rel cannot override classification. Policy-engine tests cover encoded destinations, Unicode/punycode, redirects and unsafe schemes. Stored authored bodies/URLs are never rewritten on activation or expiry.

Topic/post/search/SEO API responses and existing SSR fetch paths use no-store. Open content uses one deadline timer, clamped to both server remaining time and browser absolute time, with visibility-change checks and no polling. Fresh database/SSR reads disregard overdue active flags before reconciliation. There is no cached commercial entitlement in Redis or shared mutable forum singleton.

The existing minute timer reconciles at most 50 legacy and 50 SEO rows, with `FOR UPDATE SKIP LOCKED` and unique expiry events. Startup/task housekeeping and Admin/operator reconciliation are bounded; correctness never waits for them. Topic/status/expiry, latest-product interval, quote-owner and audit chronological indexes support reads. No new permanent worker, microservice or connection pool was added. A shutdown-helper PID-reuse cycle found during real restart tests was fixed using creation-time checks and a visited set before stopping only verified managed process trees.

## API and UI

| Route under `/api/seo` | Permission / purpose |
|---|---|
| `GET /products` | Public current verified catalog, conversion and timezone |
| `GET /topics/:topicId` | Authenticated owner balance and immutable purchase/entitlement history |
| `POST /topics/:topicId/quotes` | Owner; `{productId}`; authoritative current quote |
| `POST /topics/:topicId/purchase` | Owner; `{quoteId,idempotencyKey}`; atomic confirmation |
| `POST /topics/:topicId/cancel` | Owner; no refund |
| `GET /admin` | `dashboard.shop`; read-only schedule/snapshots/syncs/purchases/entitlements/events |
| `PUT /admin/topics/:topicId/eligibility` | `editorial.classify`; `{allowed,reason}`; operator reservation |
| `POST /admin/purchases/:id/correct` | `dashboard.ledger`; `{reason,idempotencyKey}` |
| `POST /admin/reconcile` | `dashboard.shop`; bounded housekeeping |

All bodies reject extra authoritative fields. Ordinary users cannot set price, duration, balance, owner or reservation. Existing editorial classification remains at the protected legacy review route; it does not sell an exception. Superseded placement checkout and local plan writes return 410. Their historical rows/correction tools remain readable; SEO never translates those rows into new entitlements or ranking.

`SeoEntitlementPanel.jsx` replaces the previous placement panel: owner-only list/sale price, legitimate discount, VND, calendar duration, explicit final confirmation/free label, status/end, renewal notice, no-refund deactivation and history. `/dashboard/seo` shows centralized configuration read-only and authorized reservation/correction controls. `/dashboard/pins` redirects there. Existing Wallet displays SEO transaction types and immutable references. VI/EN translation dictionaries and namespace mapping are complete.

## Verification and evidence

Repeatable local scripts and sanitized results:

- `test-seo-bootstrap.mjs` → `PHASE2.3-SEO-bootstrap-results.json`: fresh baseline v1–v6, catalog verification, no-op rerun.
- `test-seo-integration.mjs` → `PHASE2.3-SEO-integration-results.json`: signed-price negatives, zero/paid concurrency, exactness/rollback, immutability/correction, policy and moderation, reservation, free editing, manual pin independence, month edges, renewal/expiry, concurrent housekeeping, exact midnight and real price-boundary/stale-quote tests.
- `test-seo-api.mjs` → `PHASE2.3-SEO-api-results.json`: actual registration/login, isolated funding, independent prices (A 3 Credit, B 4 Credit), 0-price activation, paid debit, own-only authorization, foreign Admin token rejection, local-price-write rejection, process restart/retry, editorial restrictions and blocked edit.
- `test-seo-links.mjs` → `PHASE2.3-SEO-link-unit-results.json`: rel token and internal/external origin matrix. `test-policy-unit.mjs`: 37 existing policy/security assertions pass.
- `test-seo-browser.mjs` → `PHASE2.3-SEO-browser-results.json`: Chromium on A/B, VI/EN, actual form login, explicit 0/paid checkout, exact balances/history, DOM and no-JS SSR, independent editorial/replies/raw HTML, reserved topics, read-only Admin. Rapid initial attempts hit the unchanged rate limiter; the repeatable suite is paced and completed without page errors.
- `test-seo-manual-edit-browser.mjs` → `PHASE2.3-SEO-manual-edit-browser-results.json`: actual moderator pin/unpin from topic and dashboard while SEO remains active, then owner edit/save without charge or changed term.
- `test-seo-browser-retry.mjs` → `PHASE2.3-SEO-browser-retry-results.json`: withholds a committed paid purchase response, reloads, explicitly retries the persisted quote/key, and verifies identical receipt, balance and purchase count.
- `test-seo-preservation.mjs` → `PHASE2.3-SEO-preservation-results.json`: restores protected pre-change A/B backups into separate databases, upgrades/reruns, verifies original row hashes and live original rows. Only authentication activity fields and topic view counters are excluded from live comparisons. The new topic flag is excluded only from the pre-migration topic hash projection.
- `test-seo-restore.mjs` → `PHASE2.3-SEO-restore-results.json`: source stopped for consistent export, all table hashes/counts/schema/sequences/versions/media verified on restore, restored real Admin login/routes, source-token isolation, commercial history immutability, no-op migration.
- `test-seo-expiry-browser.mjs` → `PHASE2.3-SEO-expiry-browser-results.json`: actual near-expiry browser renewal, real deadline DOM/no-JS SSR downgrade while worker is delayed, and expired browser renewal. Dated one-calendar-month terms are inserted at creation **only in the isolated restored test database**, explicitly labeled test fixtures; no live or legacy history is synthesized or rewritten.
- Sanitized screenshots: `docs/audit/screenshots/seo-final/` (A/B VI/EN owner free/paid and Admin, restored active/expired deadlines). Protected credentials, signing keys, backups and portable bundles remain ignored under `.local/`.

Both Forum A (`3100/7100`, `pbn_dev`) and B (`3200/7200`, `pbn_forum_b`) retain separate database, JWT/cookie names, provider keys, prices and existing Redis namespace. A's Admin token is rejected by B and vice versa; a user's quote/wallet is local to the authenticated database. New dedicated fixture accounts receive test funding through the existing ledger; original account balances and stored passwords are unchanged. Existing configured registration/content rewards remain active and are included in balance baselines.

Both independent production builds exit 0. Existing dynamic sitemap/robots generation diagnostics are emitted during build, with those routes correctly remaining dynamic; no build failure. Lint has 0 errors and 11 existing unused-disable warnings. Full historical Phase 2.2 end-to-end suite was not rerun wholesale; relevant signed trust, BLOCK, moderation, permission, rendering and policy concurrency boundaries are covered here, with historical Phase 2.2 evidence retained.

## Git and operational limits

Branch: `chore/pbn-phase1-5-i18n`. Personal origin: `https://github.com/trung8356621/nodebbs.git`. Starting HEAD: `351da992e2637b3530e2b5d9eea3188f4ed35560`. Source commit message: `feat(pbn): add credit wallet and monthly SEO entitlements`. Final exact SHA and remote/clean-tree verification are reported in the completion message; no self-referential commit hash is embedded in this document. `audit-seo-release.mjs` checks staged paths for credentials/private artifacts and validates every staged migration checksum against the manifest before committing. Historical v1–v4 SQL/catalog bytes are unchanged; v5/v6 are additive.

Production deployment, real OPS key distribution/rotation, real campaign operations, production backup/disaster-recovery, high-volume VPS load/clock-failure testing and non-Chromium browser coverage are **NOT TESTED**. An operator must install a trusted source, maintain signed snapshot validity, monitor failed imports and use real production backup/access controls before launch. The shipped 0/3/4-Credit sources are development fixtures, not a production price policy. Long outages intentionally disable new checkout after snapshot expiry; existing bought terms still honor their calendar. Maximum snapshot validity is 366 days, with the development fixture using 30 days.

No next phase, upstream push, force push, merge to main, payment system, real OPS deployment or production deployment is included.
