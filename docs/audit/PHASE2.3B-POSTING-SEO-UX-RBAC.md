# Phase 2.3B — Category posting, compact SEO checkout, Wallet activity and internal access

Status: local implementation and targeted acceptance PASS. Starting commit: `bb6a71d504fef47e9add105e9c8c36fdf63f5d84`. Scope is UX and narrow access-control/reward correction; no new Wallet, pricing authority, user-level engine, payment system, auction, Docker or production deployment.

## Reused functions and domain boundaries

The implementation reuses `CategoryView`, `/create`, `CreateTopicContent`, `RequireAuth`, `TopicForm`, its category selector and the existing backend posting/RBAC/policy checks. SEO still uses the signed local OPS-style snapshots, immutable quotes, `SeoService`, existing contextual database transactions and `LedgerService`. Wallet retains its account/ledger table and adds an SEO activity view sourced from the existing purchase/entitlement/event tables. Role management uses the existing roles, permissions, role_permissions and user_roles tables and existing protected Admin assignment APIs.

No schema change or parallel user-level column is added. Baseline SQL/catalog versions remain immutable v1–v6. Existing A/B accounts, credentials, balances, immutable ledger/purchase rows and legacy inventory are retained.

## A. Category posting

`CategoryPostButton` always renders near the category title/sort controls, including for guests and users without posting permission. It uses the existing Button/Link components and `/create?categoryId=<actual numeric database ID>`. It does not parse category names or implement a permission mirror.

`CreateTopicContent` validates that query value as a positive safe integer and passes it as existing TopicForm initial data. The global header CTA remains unchanged. Guest users reach the existing sign-in guard while keeping the category query. Authenticated users submit through the existing topic API; backend rejection text is surfaced by the existing form error handling. Global BLOCK/REVIEW and moderation handling remain authoritative.

The button uses a stacked layout/full width on narrow screens and an inline layout on larger screens. Browser tests check its 375px bounds, exact query ID, actual topic creation and resulting stored category ID, guest sign-in prompt, and an authenticated restricted role receiving the backend 403 reason. Test content about uniforms/backpacks is accepted; reserved SEO state does not create industry/category restrictions.

## B. Compact SEO checkout

`SeoEntitlementPanel` now shows only entitlement status/end, compact Credit balance, current plan selector/name/duration, real sale price and applicable list-price discount, VND equivalent, Activate/Renew, explicit quote confirmation, contextual error and Wallet link. The entire topic-page history table, price-version display, sync/source information and sprawling product cards are removed from the reading surface. Their records are unchanged.

Multiple current products use one compact selector. Known development fixture IDs/source receive a localized Monthly SEO display name; actual signed bytes, product IDs, prices, durations, discounts and versions are untouched. Unknown/real OPS product names remain source-authored. No local marketing rule or alternative pricing source is created.

The existing origin/user/topic-specific pending quote and idempotency key remain in session storage. A lost committed response can be explicitly retried; the server returns the same receipt. An expired/changed quote clears that pending quote and offers **Get a new quote**, followed by another explicit price confirmation. Zero-price activation skips only the debit and never creates a zero ledger row.

## C. Wallet history

`/profile/wallet#seo-activity` is the primary user-facing SEO history section. Existing Credit balance/account cards and ledger transactions remain, including historical rewards. New `SeoActivity` shows actual free and paid purchases, monthly terms/status, renewal indication, topic reference, original transaction reference or free activation, and expandable immutable purchase/version/event references.

New authenticated `GET /api/seo/me?page=1` is a read adapter over existing commercial tables: 20 owner purchases per page, owner count, and at most 100 events bounded to the displayed purchase IDs. It adds no commercial table. Owner scoping comes from the authenticated user; a client-supplied user ID cannot select another wallet. Existing price/time constants remain centralized. SEO API responses remain private/no-store.

Rejected quotes/permissions and aborted transactions have no completed purchase or debit and do not appear as invented transactions. There are no new failed-operation rows unless an actual existing auditable event exists. Free activations appear in this SEO activity section and keep null transaction IDs.

## D. Actual activation diagnosis

Before implementation, a dedicated newly registered Forum A user created separate owned topics and called the actual signed-fixture quote/purchase endpoints:

| Product | Quote | Purchase | Immediate second quote |
|---|---:|---:|---:|
| `seo-monthly` (0 Credit) | 200 | 200 | 409 |
| `seo-monthly-paid` (3 Credit on A) | 200 | 200 | 409 |

The second quote returned the actual localized reason: **Chưa đến thời gian gia hạn được cho phép**. This is an intentional renewal-window rejection, not a missing real OPS dependency. The old UI discarded that reason and displayed its catch-all message. The applicable fixture source was valid and both initial activations succeeded.

The original historical click has no retained correlation ID/request trace, so its exact historical cause cannot be proved. This report does not invent one. `PHASE2.3B-activation-diagnosis.json` preserves the exact endpoint outcome, product/topic references and safe response; protected local backend logs were inspected. Expected client rejections had no separate renewal log match and no unexpected SEO-failure log match; only these aggregate facts are recorded, with no headers/tokens/credentials.

The SEO route now supplies safe stable failure codes for renewal window, reservation, ownership, unavailable pricing, insufficient/frozen Credit, invalid/conflicting quote, requote, policy/moderation and authentication. The compact panel translates each known cause. Unexpected 500s are logged privately and return a neutral public message; SQL/runtime details are not shown. This fixes the loss of actionable feedback without changing rejection into permission/billing bypass.

Browser expiry verification inserts an already-expired quote **at creation for a dedicated fixture account**, retaining the real authorized price snapshot. It does not alter an immutable quote or fabricate a financial purchase. The browser receives that quote once; the actual purchase API rejects it, shows the requote action, then normal quote creation and explicit confirmation succeed without a failed-attempt debit.

## E. Existing RBAC: Internal User

New capability: `seo.reserved_override`. New non-default, non-public role: `internal_user` / Internal User. Its default grant is only this capability; ordinary posting continues through the user's existing standard role. The role is assigned/removed by the existing protected Admin role-management API/UI, never purchased or self-selected.

The capability is explicitly granted, not inherited from the Admin shortcut or automatically added to standard/default roles. Fresh RBAC seeding and the additive existing-database setup both enforce this. Generic RBAC Admin shortcuts exclude this particular capability. Commercial checks read the existing role/permission tables directly so effective SQL reads and checkout share the same expiry/revocation semantics, rather than relying on a possibly stale auth-role cache. Only unconditional explicit grants qualify; the capability has no conditional permission editor. Existing user-role expiration remains supported.

The only bypass is `seo_purchase_allowed=false` on an **owned** topic. Owner, first-post/topic approval/visibility, author eligibility, mandatory policy, authenticated quote/version, renewal window, Credit availability/balance and exact debit checks remain. The same capability predicate is used by quote/confirmation, owner eligibility/history and the SQL effective-entitlement read model; renewal uses the same checkout path. No paid-to-editorial override is introduced, and commercial history still prevents independent editorial classification.

Revocation or role expiry immediately removes future reserved checkout rights and suppresses a still-active reserved term on fresh API/SSR reads. The original calendar, ledger and purchase remain unchanged; no refund or extension occurs. Regrant resumes only the still-valid remainder. Open already-loaded pages follow ordinary navigation/refresh for role changes; no new realtime worker/polling is added. Regular topics remain eligible without the capability.

Verified: Level 1 regular owned/free and paid access; Level 1 reserved denial; Level 2 reserved owned success; other-owner denial; insufficient balance on a reserved topic; Global BLOCK on a reserved topic; role revoke/expiry/regrant; no self-assignment; no automatic Admin/default grant; foreign forum Admin/JWT rejection; commercial editorial exception denial.

## F. Credit reward audit and correction

All listed engagement grants used **the same `credits` currency/account as SEO**, where 1 Credit = 10,000 VND. The old root layout also mounted `AutoCheckIn`, which could request the default 10-Credit daily award automatically. Merely hiding its Wallet status would not stop minting.

| Existing path | Change |
|---|---|
| Daily check-in base/streak and badge bonuses | Root AutoCheckIn removed; GET/POST check-in return 410; direct checkIn service rejects before updating streak or granting |
| Topic/reply/received-like awards | Reward event listeners no longer register automatic grants |
| Registration | No separate base registration grant was found; account creation remains zero. Tests verify registration plus posting produces zero new Credit |
| Invitation registration award | New invitation award path disabled; original balances and ledger retained |
| Badge/achievement commercial effects | Metadata retained for compatibility; no active check-in/grant path consumes it; public badge tooltips no longer advertise these money effects |
| Ordinary tipping/reward action | UI rewards gate off, POST reward retired; legacy `/profile/rewards` redirects to Wallet |
| Operator funding/technical corrections | Existing protected grants/deductions and separate compensating SEO corrections remain |
| Existing lottery payouts/refunds | Source audit found pre-funded creator debits/escrow releases and rollback refunds, not unsolicited engagement minting; existing accounting retained, no new lottery behavior added |

The additive setup sets existing check-in/streak/topic/reply/like/invite/registration amount keys to zero without modifying account balances. A shared LedgerService guard rejects known automatic commercial reward types, `reward_event` references and reward-extension grant sources even if legacy configuration is raised again. This is defense in depth, not a second currency.

No new reward ledger entries or zero-value fake entries are written. Historical rewards remain visible in ledger history; readonly legacy rank/streak/history endpoints and inactive source components/metadata are retained. Operator funding is available through the existing protected ledger operations; no deposit/payment integration is added. Lottery accounting was source-audited, not subjected to a new full lottery acceptance suite in this task.

## Setup, source and schema

For existing installations run `node scripts/setup-posting-seo-ux.mjs` once after backup, then restart the selected native forum. It idempotently adds only the new role/capability/default grant and zeros the legacy automatic reward amounts; it assigns no existing users and performs no schema reset. Existing A/B were updated this way. Fresh RBAC provisioning uses the normal seeder with the new configuration.

Changed source groups: category CTA/create initial data; compact SEO component/client error code; owner SEO history/error adapter; explicit RBAC SQL helper/read-model/eligibility/config/seeding; ledger reward guard and retired reward listeners/routes/check-in; Wallet SEO activity and removal of check-in/tipping promotion; badge money-effect presentation. No baseline SQL/catalog, OPS signature receiver, authored topic storage, Shop retirement or broad theme rewrite is changed.

## Verification and evidence

- `diagnose-seo-ux.mjs` → `PHASE2.3B-activation-diagnosis.json`: pre-change actual free/paid API outcome and safe log inspection.
- `test-posting-seo-api.mjs` → `PHASE2.3B-api-results.json`: A/B real auth/posting, zero engagement Credit, operator funding, exact free/paid/idempotent checkout, scoped internal permissions, revocation, policy and owner-only Wallet history.
- `test-posting-seo-bootstrap.mjs` / `test-posting-seo-integration.mjs` → `PHASE2.3B-SEO-*-results.json`: fresh v1–v6 and rerun; signed price negatives/boundaries; 20-way PostgreSQL overspend/idempotency tests; rollback; immutable corrections; month-end/renewal/expiry/manual-pin regressions. Historical catalogs are compared rather than regenerated.
- `test-posting-rbac-seed.mjs` → `PHASE2.3B-rbac-bootstrap-results.json`: normal fresh seeder grants the capability only to Internal User, not Admin/default roles.
- `test-posting-seo-browser.mjs` → `PHASE2.3B-browser-results.json`: actual category publishing with exact preselection, guest and restricted behavior, narrow viewport, real free/paid confirmations, exact balances, compact panel/no history table, Wallet activity, reserved error, actual expired-quote rejection/requote, VI/EN A/B.
- `test-posting-internal-browser.mjs` → `PHASE2.3B-internal-browser-results.json`: actual internal reserved activation, revoke/role expiry/regrant and unchanged purchased end on both forums.
- `test-posting-seo-retry.mjs` → `PHASE2.3B-browser-retry-results.json`: a committed paid response is lost, then reload/reselection/confirmation returns the same receipt and balance without a duplicate term.
- `test-posting-badge-smoke.mjs` → `PHASE2.3B-badge-regression-results.json`: earned badge still equips and renders the associated localized frame with reward UI disabled.
- `test-posting-seo-preservation.mjs` → `PHASE2.3B-preservation-results.json`: original account/role/wallet/ledger/SEO/shop/inventory row hashes retained; direct automatic grant and check-in service guards. Only authentication/update timestamps are excluded.
- `test-posting-seo-restore.mjs` → `PHASE2.3B-restore-results.json`: source stopped during consistent export; all 74 table hashes/counts, schema, sequences, versions and 13 media artifacts matched on restore. Restored login, scoped role effect/revocation, reward retirement, financial immutability and source/clone isolation pass; clone stopped and protected artifacts retained.
- Existing Policy unit/security suite: 37 assertions PASS. Full historical Phase 2.2/2.3A/lottery suites were **NOT TESTED wholesale**; the relevant targeted policy, Wallet, SEO, role and badge boundaries are distinguished here.
- Screenshots: `docs/audit/screenshots/phase23b/`: A/B VI/EN category CTA/mobile CTA, free/paid panel, Wallet, reserved and posting-denial cases; actual Internal User/revoked cases.

Lint PASS: zero errors, 11 pre-existing unused-disable warnings. i18n PASS: 2,715 web keys per locale, 743 backend templates, zero errors and zero hardcoded Chinese UI strings. Independent A/B native production builds PASS; existing dynamic sitemap/robots build diagnostics and native Next standalone advisory remain nonfatal. Browser batching respects unchanged request-rate limits; no security setting was relaxed.

## Operational state, Git and limits

Forum A: `http://127.0.0.1:3100` / API 7100 / `pbn_dev`. Forum B: `http://127.0.0.1:3200` / API 7200 / `pbn_forum_b`. Native local compiled processes remain independent, with existing JWT/cookie/Redis/database isolation. Protected backups, credentials and signing keys remain ignored under `.local/`; only sanitized evidence is committed.

Personal branch: `chore/pbn-phase1-5-i18n`, origin `https://github.com/trung8356621/nodebbs.git`. Commit message: `fix(pbn): streamline posting SEO checkout and internal access`. `audit-posting-seo.mjs` verifies staged private-artifact/secret exclusions and historical baseline checksums before commit. Exact final SHA, successful personal-origin push and clean-tree verification are reported in the completion message; no force push, upstream push or merge.

Real OPS operations, production deployment/load, real payment processing, non-Chromium browser coverage and realtime push on role changes are **NOT TESTED / outside scope**. No next phase is started. The original historical activation request remains uncorrelated; the reproduced renewal-window rejection and the fixed loss of error context are documented precisely above.
