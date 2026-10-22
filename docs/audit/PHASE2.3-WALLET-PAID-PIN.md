# Phase 2.3 — Wallet hardening, paid topic pins and expiring outbound link policy

Date: 2026-10-22. Native Windows/Laragon PostgreSQL 17.2 and Redis; no Docker or production deployment.

**Implementation acceptance: PASS, subject to final Git release record below.** All listed behavior was exercised locally. Phase 2.4 was not started.

## Scope and architecture

Repository: `D:\workspace-2026\pbn`, branch `chore/pbn-phase1-5-i18n`. Personal origin is `https://github.com/trung8356621/nodebbs.git`; upstream NodeBBS remains unchanged. Existing licensing and attribution remain intact.

The existing Shop `shop_items` model stores pin plans (`type=topic_pin`); the existing `sys_accounts`/`sys_transactions` ledger stores Credit balances and movements. Credit is the existing **`credits`** currency, distinct from `gold`. No parallel wallet or inventory-based pin entitlement was introduced. The old Shop topic-pin use handler was commented out; actual moderator pinning was the boolean `topics.is_pinned`.

Forum-owned additions are `pin_entitlements`, append-only `pin_events`, and explicit `topic_link_classifications`. They live in the forum module, with the existing composition-root schema export. Core services do not import forum business services. The existing cleanup registry invokes the same bounded expiration service as its one-minute timer, Admin action and operator command.

Both forums' existing Credit setting was enabled through the existing administrator currency API. Existing currency names, configuration and original balances were retained. Existing configured earning rewards consequently run for future eligible activity; they were not redesigned. Only dedicated fixture accounts were funded or charged by this phase's tests.

## Financial guarantees

- Safe positive integer amounts, account row locks and conflict-safe account initialization protect existing ledger grants/debits/transfers. Transfers acquire account locks in consistent user order. Existing Shop purchase and gift writers also lock the same wallet row, reject frozen accounts and check safe arithmetic. The database disallows negative or unsafe-range balances.
- A purchase holds the existing shared policy lock and topic content lock, rechecks the owner, author and topic/first-post publication state, then runs the existing Policy Engine against title plus body. Global/local policy mutation and ordinary content edits cannot race this check.
- Product configuration is locked and read on the server. The owner UI sends the confirmed price/duration; changed terms return 409. No client-supplied price controls the debit.
- Debit, ledger entry, immutable terms, entitlement and purchase event commit together. Policy inspection uses the ambient transaction connection to avoid connection-pool starvation during concurrent purchases. No extra purchase connection pool was added.
- A unique `(user_id,idempotency_key)` constraint and operation lock ensure retries return the committed purchase. A SHA-256 fingerprint rejects conflicting topic/product/confirmed-term payloads with 409. The browser retains an unresolved key in origin-isolated session storage across reloads.
- Every purchase records topic, owner, product, price, duration, ledger transaction, before/after balance, operation key, database dates and status. Ledger metadata identifies the owner action and entitlement. Database triggers prohibit rewriting/deleting paid ledger history, purchase terms or audit events.
- Cancellation closes remaining paid entitlements without returning Credit. A separately authorized technical correction requires an explicit reason, creates one compensating ledger entry linked to the original transaction, and preserves original history. Repeat corrections cannot double-credit the same purchase. There is no ordinary refund/proration endpoint.

## Placement, renewal and expiration

New terms start from the database clock after the debit, immediately before durable entitlement/event insertion. Renewals serialize on the topic and extend from the greatest unexpired end; expired purchases start a new term from the database clock. Previous receipts remain intact. Edits neither charge nor change dates. Moderation hiding preserves history and calendar expiration; it does not refund, pause or extend paid time.

Existing NodeBBS provides one boolean moderator pin level. Paid and manual pins share that existing pinned ordering band, followed by the selected existing sort and deterministic topic ID tie-break. Paid entitlement creation never overwrites the manual flag. Admin/manual pin controls now read `adminPinned`, while public ranking reads `manual OR database-active-paid`. A manual pin alone grants neither paid nor editorial link attributes.

Effective activity requires an active row whose start is at or before the database statement time and whose end is strictly after it. Ranking and link classification use that predicate, so a delayed worker cannot preserve expired privileges. The reconciler claims at most 50 due rows using `FOR UPDATE SKIP LOCKED`, closes them and records one unique expiration event. Concurrent workers, repeated runs and restarts are safe.

Default interval: 60,000 ms; optional `PBN_PIN_EXPIRE_INTERVAL_MS` requires restarting the selected process. No heavyweight queue or central billing service was introduced. Operator command:

```powershell
node scripts/forum-pins.mjs reconcile forums/forum-a.json
```

## Outbound link policy and rendering audit

| Content | Mandatory external HTTP(S) rel, plus `noopener noreferrer` |
| --- | --- |
| Ordinary user topic | `ugc nofollow` |
| Active paid topic | `ugc sponsored` |
| Genuine explicitly reviewed independent editorial topic | No UGC/commercial tokens |
| Advertising/sponsored classification | `ugc sponsored` |
| Reply, including a reply under a paid topic | `ugc nofollow` |
| Expired/cancelled paid topic | `ugc nofollow`, unless independently classified advertising |

There is no invented `dofollow` token and no automatic Admin/author/editorial exception. `editorial.classify` is privileged, seeded for administrators and excluded from the default user permission set. Any paid purchase history prevents editorial classification forever. Advertising classification is sticky in the review API. Title or first-post body edits clear editorial approval inside database triggers. Hidden/pending/deleted content is ineligible for a new editorial approval or paid purchase.

The shared Markdown anchor component emits rel in server-rendered HTML, before hydration. Exact-origin and relative internal links remain separate. HTTP(S) case, protocol-relative URLs, origin scheme and port boundaries were tested. Existing URL sanitization and raw-HTML escaping remain in place. Authored Markdown, raw content, titles and URLs are not rewritten. Author-supplied raw `rel` cannot override mandatory attributes because topic raw HTML is escaped.

Surface inventory:

- Topic first-post detail: authoritative API classification, canonical origin and expiration passed into the shared renderer.
- Replies and reply quotes: independent default UGC rendering; no inheritance from paid parents.
- Profile reply preview: replaced `dangerouslySetInnerHTML` with the safe UGC renderer. User activity excludes first posts; topic-list/search previews emit plain text and internal topic links.
- Existing image advertisement anchor: explicitly sponsored through the same rel utility. No banner purchase/allocation was implemented.
- JSON content responses: source text, not emitted HTML; rel mutation is not applicable.
- Permitted raw topic HTML: **not applicable**; this installation does not enable raw topic HTML. Browser tests prove raw anchors/scripts remain escaped. Phase 2.2 executable HTML ads and HTML pages remain inactive/drafted pending conversion; their security restrictions were retained.

Content API responses use private/no-store headers; SSR API fetches default to no-store. Fresh HTML and ranking therefore re-evaluate database time. Open body links and list badges use one deadline timer per rendered topic, without polling. The timer clamps against absolute expiry as well as the supplied server time so returning to an old navigation snapshot cannot restart a full term. Client behavior only downgrades display; server reads remain authoritative.

## UI and tested URLs

Default plans: 1 day for 10 Credit; 7 days for 50 Credit. Prices/durations/order/enabled flags are configurable in the Shop-backed Admin screen.

| Surface | Forum A | Forum B |
| --- | --- | --- |
| Tested owner topic fixture | http://127.0.0.1:3100/topic/154 | http://127.0.0.1:3200/topic/72 |
| Wallet/history | http://127.0.0.1:3100/profile/wallet | http://127.0.0.1:3200/profile/wallet |
| Plans/purchases/events/editorial/corrections | http://127.0.0.1:3100/dashboard/pins | http://127.0.0.1:3200/dashboard/pins |
| Existing policy dashboard | http://127.0.0.1:3100/dashboard/policy | http://127.0.0.1:3200/dashboard/policy |

Owner controls appear only for the authenticated topic owner. They include balance, enabled plans, explicit non-refundable confirmation, renew/cancel, current end and purchase history. Existing wallet transaction badges/descriptions now identify paid pins and technical corrections in Vietnamese/English; the default internal currency displays as Credit. Admin plan management uses `dashboard.shop`; technical corrections use `dashboard.ledger`; editorial review uses its separate permission.

Fixture credentials/tokens remain only in ignored owner-protected `.local/phase23/live-fixtures.json`. Existing Admin credentials were not reset. Temporary 60-second/admin-workflow plans are disabled after verification; their purchase/audit history is retained.

## Migrations and data preservation

Immutable existing v1/v2 SQL, checksums and catalogs were retained. Additive v3 creates the new forum tables, wallet check, immutable-history/editorial-reset triggers, independent permission and default Shop plans. The first rehearsal caught the distinct `gold`/`credits` codes; additive v4 corrects only new topic-pin plan currency references. Applied migrations were not silently rewritten. Version-specific v3/v4 catalogs and generated Drizzle snapshot are included.

Fresh v1–v4 bootstrap and no-op rerun passed. Protected pre-change A and B dumps were restored to isolated databases and upgraded/rerun; every pre-existing business row was byte-for-byte identical across migration. Live original credentials, roles, categories, topic/post bodies, Shop rows, wallets and transactions were also compared. Only expected authentication activity (`last_seen_at`, `last_login_ip`, `updated_at`) and topic view counters were excluded from live comparisons; migration comparisons excluded nothing.

A consistent stopped-source B export restored all **67 tracked tables** and **13 media files** to a new native PostgreSQL database. Row contents/counts, schema, sequences, migration checksums and media matched. Restored paid history and immutable event triggers, no-op migrations, real Admin login/dashboard/policy/pins and cross-forum token rejection passed. The restore clone was stopped; diagnostic databases and protected backups remain local and ignored. A/B remain managed at their original ports/databases.

## Executed evidence and reproducibility

Live fixture scripts assume the existing native forums, configured signed development policy snapshot, protected local credentials and running PostgreSQL/Redis. They create dedicated test users/content. Integration/bootstrap scripts target newly created isolated databases. The preservation script additionally requires the protected pre-change dumps; export/restore stops B temporarily and restores to a new database. Do not run live fixture scripts on production.

| Command / evidence | Result |
| --- | --- |
| `node scripts/test-pin-bootstrap.mjs` / `PHASE2.3-bootstrap-results.json` | PASS: genuinely fresh v1–v4 migration and no-op rerun |
| `node scripts/test-pin-integration.mjs` / `PHASE2.3-integration-results.json` | PASS: real PostgreSQL two-way insufficient funds, 20 distinct and 20 duplicate concurrent attempts, concurrent internal grants, stale quotes, manual/paid separation, free edits, rollback, policy/eligibility, immutable history, corrections, delayed expiry and Shop/gift races |
| `node scripts/test-pin-api.mjs` / `PHASE2.3-api-results.json` | PASS: real A/B login/purchase/retry/conflict/ownership, no-store, policy and editorial permission/history checks |
| `node scripts/test-pin-timeout.mjs` / `PHASE2.3-timeout-results.json` | PASS: real HTTP caller timeout followed by retry, one debit and one entitlement on A/B |
| `node scripts/test-pin-links.mjs` / `PHASE2.3-link-unit-results.json` | PASS: external/internal URL and exact-token matrix |
| `node scripts/test-policy-unit.mjs` | PASS: 37 existing policy/security assertions |
| `node scripts/test-pin-browser.mjs` / `PHASE2.3-browser-results.json` | PASS: Chromium owner/admin A/B × VI/EN; actual DOM and no-JavaScript SSR |
| `node scripts/test-pin-admin-browser.mjs` / `PHASE2.3-admin-browser-results.json` | PASS: actual plan create/edit/order/disable, editorial review, compensating correction and bilingual wallet |
| `node scripts/test-pin-manual-browser.mjs` / `PHASE2.3-manual-pin-browser-results.json` | PASS: real sidebar and moderator dashboard toggle manual pin while paid placement remains active |
| `node scripts/test-pin-wallet-browser.mjs` | PASS: canonical Credit and generated reward labels in VI/EN; no legacy Chinese interface text in fixture wallet |
| `node scripts/test-pin-browser-retry.mjs` / `PHASE2.3-browser-retry-results.json` | PASS: lost committed browser response, reload, same-key retry without another charge or duration |
| `node scripts/test-pin-expiry-browser.mjs` / `PHASE2.3-expiry-browser-results.json` | PASS: real 60-second expiration with one-hour-delayed worker; open DOM, fresh API/ranking and no-JavaScript SSR all downgrade before reconciliation |
| `node scripts/test-pin-isolation.mjs` / `PHASE2.3-isolation-results.json` | PASS: bearer/cookie/renamed cookie/Origin/purchase/wallet/users/Redis/homepage isolation |
| `node scripts/test-pin-preservation.mjs` / `PHASE2.3-preservation-results.json` | PASS: restored pre-change A/B upgrade/rerun and original live data preservation |
| `node scripts/test-pin-restore.mjs` / `PHASE2.3-restore-results.json` | PASS: full portable export/restore, trigger enforcement, login and isolation |
| `pnpm i18n:check` | PASS: 2,600 web keys/locale, 730 backend templates/locale |
| `pnpm lint` | PASS: zero errors; 11 existing unused-disable warnings |
| `node scripts/forum.mjs build forums/forum-a.json` and B equivalent | PASS: isolated production verification builds; no deployment |
| `git diff --check` | PASS |

Browser suites were rerun after fixing a missing Next client boundary. A cold-development HMR initialization failure was resolved by the stable-source rerun. A final combined browser run reached the existing request limit; verification respected its reset and retried without weakening rate limiting. Fresh final runs passed. Production builds retain the known dynamic robots/sitemap diagnostic, then finish successfully as dynamic routes.

Screenshots: [owner VI](screenshots/phase23/forum_a-vi-VN-owner.png), [owner EN](screenshots/phase23/forum_b-en-US-owner.png), [Admin VI](screenshots/phase23/forum_a-vi-VN-admin.png), [Admin EN](screenshots/phase23/forum_b-en-US-admin.png), [Admin operations](screenshots/phase23/forum_b-admin-workflow.png), [wallet VI](screenshots/phase23/forum_b-vi-VN-wallet.png), [wallet EN](screenshots/phase23/forum_b-en-US-wallet.png), [active before expiry](screenshots/phase23/forum_b-active-before-expiry.png), [expired with worker stalled](screenshots/phase23/forum_b-expired-worker-stalled.png). Owner and Admin screenshots were visually inspected for usable layout.

## Limits and release record

This is local development verification, not production operations certification or a large-network load test. Only Chromium was exercised. Live fixtures, diagnostic databases, private dumps and secrets are retained locally and excluded from Git. Existing dynamic robots/sitemap build diagnostics and 11 lint warnings remain. Raw topic HTML is intentionally unsupported; executable ad/page formats remain restricted by Phase 2.2. No external money, withdrawal, deposit, ordinary refund, subscription, banner purchasing, Central Billing Server, SEO-OPS or production deployment was implemented.

Source commit, personal-origin push and clean-tree verification are recorded after the final release checks. The final response supplies the exact resulting HEAD SHA. Staged source review is recorded in `PHASE2.3-source-review.json`; final runtime and charge/entitlement integrity are recorded in `PHASE2.3-final-runtime-results.json`.
