# Phase 2 — Admin access and architecture review

Date: 2026-10-21. Environment: Windows, native Node.js, PostgreSQL Laragon 17.2 / `pbn_dev`, native Redis. Status: owner Admin access and main-screen audit completed; design proposed for review. Architecture implementation requires explicit approval.

## 1. Admin access — account created and login verified

Created a new owner account, ID **7**, username **trungtien1993**, email **trungtien1993@gmail.com**, after confirming both identity fields were unused. The username was derived from the email supplied by the owner. No existing demo/member account was promoted. Login: http://127.0.0.1:3100/auth/login. Admin: http://127.0.0.1:3100/dashboard.

Source findings:

- `apps/api/src/plugins/auth.js`: bcrypt password hashing, cost 10; password comparison; JWT with user ID; HTTP-only auth cookie; user deletion/ban checks and RBAC enrichment. Normal authentication must remain enabled.
- `apps/api/src/routes/users/index.js`: existing administrator-only account creation calls `fastify.hashPassword` and assigns the RBAC `admin` role when requested; duplicate username/email checks precede creation.
- `apps/api/src/plugins/rbac/service.js`, `inspect()`: existing `admin` role has all permissions. This is the highest **installation-local** administrator. There is no separate network-wide `super_admin` role in the audited source. Do not add one without Auth design approval.
- `users.role` and `user_roles` must agree; setting only the legacy `users.role` field does not establish correct RBAC. Existing `roles` and `permissions` are installation-local.
- Dashboard layout wraps the existing `RequireAdmin` component; backend permission checks remain the authority.

Provisioning used a local, ignored operator script and a Drizzle transaction, guarded by development mode, loopback/5432, actual database `pbn_dev` and PostgreSQL **17.2**. It inserted only the new user and existing RBAC admin-role association; `users.role=admin` agrees with `user_roles`. The password was generated from 32 cryptographically random bytes and hashed with the same bcrypt library/cost **10** as the existing Auth plugin; bcrypt comparison succeeded. No Auth logic, schema, verification bypass or alternative login mechanism was introduced. `isEmailVerified` remains false; normal existing login permits the account without fabricating mailbox verification.

Password handoff: `.local/pbn-owner-password.dpapi` is encrypted with Windows current-user DPAPI and its ACL grants only the current Windows owner (`T--RUNG\\trung`) access, without inherited permissions. `.local` is ignored by Git. Plaintext was handled only in process memory, never in source, command arguments, reports, screenshots or Git. The one-off provisioning and browser audit scripts are also ignored local operator artifacts. To copy the password using the same Windows account, run from workspace root:

```powershell
pwsh -NoProfile -File .\scripts\copy-pbn-admin-password.ps1
```

Paste into the normal login form. The helper copies to the clipboard without printing the password. After signing in, use `/profile/settings` → Security to choose a personal password with the existing change-password form. This DPAPI file will still contain the initial password after a user-initiated password change; it is not an automatic password manager. Another Windows account/machine cannot use the current-user encrypted file. No password is included in this report.

Real API login and browser form login both succeeded for the new account. Admin GET checks returned **200** for `/api/dashboard/stats`, `/api/roles`, `/api/ads/slots`, `/api/ads`, `/api/ledger/stats`, `/api/ledger/accounts`, `/api/shop/items`, `/api/moderation/queue/stat` and `/api/settings`. Negative checks on dashboard statistics, roles and ad slots returned **401** for anonymous requests and **403** for the existing ordinary member. That member was used only to test denial, never promoted or used as administrator. These prove access enforcement, not all destructive/mutation workflows.

Executed access precheck: anonymous `GET /api/dashboard/stats`, `/api/roles` and `/api/ads/slots` each returned **401**. Playwright Chromium confirmed an unauthenticated visit to `/dashboard` redirects to `/`, and `/auth/login` loads HTTP **200**. These are negative-access/login-page checks, not successful administrator login or a complete RBAC audit.

## 2. Admin UI inventory — observed runtime results

Playwright Chromium, desktop 1600×1000, Vietnamese UI, authenticated through the normal login form as the newly created owner. All **12** loaded routes (11 Admin screens plus personal settings) returned HTTP **200**, stayed on the requested authenticated URL, displayed non-empty main content and had no observed failed API responses or uncaught JavaScript page errors. Raw results: ignored `.local/phase2-admin-audit.json`. This is a read-only screen/access audit, not proof of complete mutation or financial workflows.

| Feature | Existing route | Source finding / verification boundary |
| --- | --- | --- |
| Dashboard | `/dashboard` | PASS: statistics loaded; 7 users, 57 categories, 117 topics and 5 replies |
| Users | `/dashboard/users` | PASS: user list and management controls load; no ban/delete/edit action executed |
| Roles/permissions | `/dashboard/roles` | PASS: role management screen loads; no permissions were modified |
| Categories | `/dashboard/categories` | PASS: imported hierarchy/category management list loads; no reordering or edits saved |
| Topics/replies | `/dashboard/topics`, `/dashboard/posts` | PASS: lists and management controls load; no demo content modified |
| Moderation/reports | `/dashboard/moderation`, `/dashboard/reports` | Moderation screen and queue/stat API PASS; report route source verified but not browser-tested in this run; approval/rejection not executed |
| Operation history | `/dashboard/oplogs` | Source verified; not browser-tested in this run |
| Wallet/ledger | `/dashboard/ledger` | PASS: overview, stats and account API access; no concurrency, credit-transfer or financial correctness claim from page loading |
| Shop | `/dashboard/shop` | PASS: item administration list loads; purchase/refund workflows not tested here |
| Pin management | Within `/dashboard/topics` | `isPinned` update checks `dashboard.topics`; no separate pin route. Paid pin handler is commented out in `shopService.js`, and `topics` has no implemented expiry field |
| Banners | `/dashboard/ads` | PASS: ad list/empty state and nine available slots load; no active advertisement created or sales/billing validated |
| Settings | `/dashboard/settings` | PASS: general-settings screen loads; additional security/provider editors exist in source, but provider credentials/external integrations were not changed or exercised |
| Other | `/dashboard/tags`, `/dashboard/files`, `/dashboard/pages`, `/dashboard/emojis`, `/dashboard/invitations`, `/dashboard/badges` | Existing upstream features; not a claim of complete end-to-end validation |

The audit did not save settings, delete records, grant credits or modify demo topics. Account and member logins update ordinary login metadata through existing Auth behavior. Read-only database verification confirmed 57 categories, 117 topics and 122 posts remain; owner ID 7 has both the legacy admin flag and the built-in RBAC admin association. No migration/build is needed: application code, Auth and schema are unchanged. The clipboard helper was parsed successfully by PowerShell; DPAPI decryption was exercised successfully by the real login checks.

Main screenshots (inputs/textareas masked during capture, including search boxes; colored rectangles are redactions, not UI defects):

- [Dashboard](screenshots/phase2/dashboard.png)
- [Users](screenshots/phase2/dashboard-users.png) and [Roles](screenshots/phase2/dashboard-roles.png)
- [Categories](screenshots/phase2/dashboard-categories.png)
- [Topics](screenshots/phase2/dashboard-topics.png) and [Replies](screenshots/phase2/dashboard-posts.png)
- [Moderation](screenshots/phase2/dashboard-moderation.png)
- [Ledger](screenshots/phase2/dashboard-ledger.png) and [Shop](screenshots/phase2/dashboard-shop.png)
- [Banner management](screenshots/phase2/dashboard-ads.png)
- [Settings](screenshots/phase2/dashboard-settings.png)
- [Personal settings](screenshots/phase2/profile-settings.png)

Additional read-only UI checks all PASS: opened the topic action menu and confirmed **Ghim chủ đề** is available (did not click the mutation), switched Ads to the slot list and confirmed `home_header_banner` is rendered, switched Roles to its Permissions tab, and opened personal Settings → Security. Screenshots: [Pin action menu](screenshots/phase2/dashboard-pin-menu.png), [Nine banner slots](screenshots/phase2/dashboard-ad-slots.png), [Permissions](screenshots/phase2/dashboard-permissions.png), [Password/security settings](screenshots/phase2/profile-security.png). A clean Dashboard recapture leaves the non-sensitive header search field visible. Detail-check results: ignored `.local/phase2-admin-detail-audit.json`. There are **16** screenshots total (12 main screens plus four detail captures).

Known boundaries: paid pin/expiry and a separate pin-management page are not implemented; banner sales, policy enforcement and billing-grade analytics are not established; provider integrations require actual configuration and separate validation. Some upstream database seed names remain Chinese, because stored role/currency/shop/slot data was not translated or rewritten during this audit. Mobile Admin layout and every nested settings/provider tab were not exhaustively verified. Do not interpret a successful list screen as full production readiness.

## 3. Multi-forum foundation — recommendation, not implemented

### Current constraints

The audited schemas have installation-wide users, unique usernames/emails, categories, topics, posts, RBAC, settings, moderation queue, notifications, files, ledger/shop and advertisement tables. No `forum_id`/`tenant_id` isolation is present in these core/forum schemas. `src/db/index.js` creates one module-global PostgreSQL pool from one database URL. Routes/services import that shared database directly. RBAC cache keys include `user:<id>:roles`, `role:<slug>:permissions` and `roles:display`, without forum identity. Cookies/JWT, uploads, workers, settings caches and provider configuration also need explicit boundaries.

Changing only hostname routing or adding a `forum_id` to topics would leave multiple leakage paths. This installation currently serves exactly one forum.

### Options

| Concern | Database per forum | Shared tables with forum keys |
| --- | --- | --- |
| Existing schema/API adaptation | Can retain installation-local schema initially | Every data access path, join, uniqueness rule, FK and job requires scoping |
| Data/admin separation | Dedicated database login per forum; local RBAC stays local | Tenant-scoped RBAC and database-enforced constraints/RLS required |
| Independent restore/export | Natural per-forum database plus media export | Selective extraction must traverse all dependent entities correctly |
| Standalone growth | Move database/media and deployment mapping | Extract/rekey scoped rows and prove integrity before cutover |
| Operational cost | More databases, migrations, backups and bounded pools | Fewer pools, more complex isolation verification |
| Resource/failure isolation | Same PostgreSQL instance still shares CPU/storage and availability | Even more shared operational blast radius |

**Proposed choice for approval: database per forum**, initially one native Fastify process and one Next.js process per forum, all using the same versioned source/build. This fits the current singleton services and standalone requirement with the smallest immediate schema risk. It is one common codebase, not duplicated divergent repositories. A shared process with a request-scoped pool/router can be reconsidered later only after auditing all singleton state.

Proposed deployment boundary:

```text
Verified domain -> reverse proxy / allowlisted forum registry
                  -> forum-specific Web process -> forum-specific API process
                     -> dedicated database + least-privilege database role
                     -> isolated Redis namespace/instance + media namespace
```

The future registry maps immutable forum IDs to verified domains, deployment targets, locale/theme configuration and secret references (never credentials in a public response). Unknown domains fail closed. Accept forwarded hosts only from a trusted proxy; clients cannot select database/tenant using arbitrary headers or request body fields. Distinct forum JWT secrets/audiences, host-only cookies and cache keys prevent cross-forum numeric user-ID collisions. Do not introduce shared-domain cookies or implicit cross-forum SSO in this phase.

Each forum has independent users, administrators, credits, moderation decisions, themes, config and provider credentials. A future network operator/control-plane identity is a separate design decision; the new local admin is not automatically that identity. Shared global policy is mandatory even when local administration is independent.

Future migration/operations plan, subject to approval: backup/restore rehearsal; forum registry and verified routing; create a second empty development database only after approval; per-forum secret/media/cache/job separation; versioned migrations orchestrated per database; isolation tests with identical numeric IDs across two forums; independent backup and restore; then domain cutover. Do not copy `pbn_dev` demo data into production. Preserve existing IDs/FKs within each database. Standalone export includes media and required settings, excludes reusable secrets, rotates keys and invalidates sessions at cutover; keep the same immutable forum ID for policy and audit continuity.

Shared-table alternative would require compound `(forum_id, id)` references or equivalent constraints, forum-scoped unique keys, scoped background jobs and RLS using a non-owner, non-superuser runtime role. PostgreSQL documents that superusers/BYPASSRLS and normally table owners bypass row policies, so adding RLS while retaining a privileged role is insufficient. [PostgreSQL 17 row security](https://www.postgresql.org/docs/17/ddl-rowsecurity.html).

## 4. Central Policy API — proposed contract only

No central service, table, migration, middleware or external content submission has been implemented. Versions below describe a future contract, not an existing NodeBBS endpoint.

### Rules and identity

Global mandatory denies form a non-overridable baseline. Each forum can add local domain/URL/content restrictions but cannot remove mandatory global restrictions. Effective denial is the union of global mandatory and local deny rules; no credit, wallet balance, purchased pin, advertiser tier or local admin approval can bypass it. Hard deny takes precedence over review, then allow. Mandatory content policy also applies to administrator edits and scheduled banners.

Use explicit rule IDs, reason codes, scope, match kind (`domain_exact`, `domain_and_subdomains`, `url_exact`, `url_prefix`, `content_signal`), action (`deny`, `review`), mandatory flag, activation/expiry and policy version. Local rule management requires forum-admin permissions and an audit trail. Only a separately authorized central policy maintainer can change global rules. Discussing a risky subject or mentioning a domain as plain text is not automatically promotional content: consider explicit links, calls to action, referral codes, incentives and placement context. Known phishing/malware destinations remain denied regardless of advertising intent; ambiguous discussion goes to review. Legal classification and jurisdiction-specific rule approval belong to the operator's review process.

### Endpoints

| Endpoint | Purpose |
| --- | --- |
| `GET /v1/policies/effective` | Signed effective global/local snapshot, policy/normalizer versions, ETag, valid-until and stale limits; forum inferred from service identity |
| `POST /v1/evaluations` | Evaluate the complete proposed revision, including title/body and extracted URLs; returns decision and evidence |
| `GET /v1/policies/changes?after=<cursor>` | Monotonic change cursor for cache refresh and rescan scheduling; authenticated per forum |
| `POST /v1/review-requests` | Submit contextual review/appeal with evidence; cannot override mandatory global deny |
| `POST /v1/audit-events:batch` | Idempotent delivery of local decision/enforcement outcomes via durable outbox |

Service-to-service TLS plus scoped service credentials (or mTLS) binds forum identity. A supplied `forumId` must match that identity; browser clients never call Central directly with a privileged credential. Enforce body/URL limits, deadlines, authentication, authorization and rate limits. Use an idempotency key per forum/revision/action; reuse with different content returns 409. Contract validation errors return 400/422, unauthorized 401/403, version/revision conflicts 409, throttling 429 and unavailable 503. A successfully evaluated deny is HTTP 200 with `decision=deny`, not a transport error.

Example request, synthetic fields only:

```json
{
  "schemaVersion": "1",
  "requestId": "uuid",
  "forumId": "forum-immutable-id",
  "operation": "topic.update",
  "target": { "type": "topic", "id": "117", "revision": "revision-id" },
  "actor": { "localUserId": "opaque-local-id", "roleClass": "member" },
  "content": {
    "format": "markdown",
    "title": "Example discussion",
    "body": "Proposed complete revision",
    "urls": [{ "value": "https://example.invalid/path", "placement": "body" }]
  },
  "contentHash": "sha256-of-canonical-complete-revision",
  "knownPolicy": { "global": "g-version", "local": "l-version" }
}
```

Example decision:

```json
{
  "decisionId": "uuid",
  "decision": "review",
  "reasonCodes": ["PROMOTION_CONTEXT_AMBIGUOUS"],
  "matchedRules": [{ "ruleId": "rule-id", "scope": "local", "mandatory": false }],
  "effectiveVersion": { "global": "g-version", "local": "l-version", "normalizer": "n-version" },
  "contentHash": "sha256-of-canonical-complete-revision",
  "expiresAt": "ISO-8601 timestamp"
}
```

An allow receipt is scoped to forum, target/revision, action, complete content hash and policy version; never reuse it for a changed URL/body, banner activation or a later revision. Values above are placeholders, not active URLs/credentials.

### Data flow and failure behavior

1. Existing Auth/RBAC validates the author/admin operation; read current revision and build the complete candidate revision.
2. Parse Markdown/HTML into structured text/links; include title, body, replies, banner text/markup, image/script source URLs and final destination fields. Normalize hostnames with a versioned URL parser/IDNA handling; compare domain-label boundaries, schemes, ports and URL paths consistently, reject ambiguous encodings and `javascript:`/unsafe schemes. Do not use a raw substring domain check or automatically fetch arbitrary links from the API process.
3. Evaluate against a signed, unexpired local policy snapshot; call Central when contextual review or unsupported rule types require it. Cache by forum, action, revision hash, normalizer and effective version. Unknown rule types, expired snapshots or missing mandatory policy must never silently allow publication.
4. On deny, reject the proposed revision with stable reason codes. On review or unavailable required checks, hold the new revision privately in the moderation path; preserve an already published revision unless that revision is itself blocked. Availability of ordinary known-safe writes may rely on a still-valid local snapshot; after its expiry hold writes instead of failing open. This is a design choice for approval, not behavior changed today.
5. For allow, commit the exact evaluated revision and decision reference under an optimistic revision check; recheck effective policy version before publication. Avoid keeping a DB transaction open over a Central network request. A changed revision/version requires reevaluation. Publish jobs must enforce the same gate.
6. Emit durable enforcement/audit events after commit, invalidate display caches when needed, and queue version-based rescans of existing content. URL/domain inverted indexes can prioritize impacted content. Apply newly mandatory denies to existing topic/post/banner visibility and invalidate caches promptly; local approval must not republish them. Redirect destinations can change without content edits, so use periodic rechecks in addition to change events.

Proposed integration points: topic create/update, first-post body edits, reply create/update, ad create/update/activation and scheduled serving. Admin moderation approve/release, imports and paid-pin purchase/renewal paths also need enforcement. Current manual moderation and the future mandatory policy are separate gates: both must permit publication. Existing wallet/ledger services should never perform the policy decision; reserve funds only after eligibility and finalize debit/publication coherently, with idempotent release/refund on denial or revision conflict.

Do not execute arbitrary advertisement HTML/scripts merely because extracted links passed domain checks. Existing `AdSlot.jsx` supports raw HTML and third-party script execution; a production banner policy must independently restrict active formats and require reviewed sandboxing/CSP, or initially permit only reviewed image ads. No renderer change was made here. Redirect exploration, if later implemented, belongs in an isolated worker with bounded hops/time, DNS/IP revalidation at each hop and no private/loopback/link-local access. [OWASP SSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html).

Audit events should capture decision ID, immutable forum ID, target/revision, local actor reference, rule IDs, effective version, content hash, action, review outcome, timestamps and enforcement result. Avoid plaintext passwords, tokens, full private bodies and unnecessary personal data; define retention, restricted access and append-only/tamper-evident storage before operation. Preserve review rationale and whether an action was global or local. [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html).

## 5. Banner slots available now

Source: `apps/api/src/scripts/init/ads.js`, `extensions/ads/schema.js`, `extensions/ads/components/AdSlot.jsx`, forum `SidebarLayout.jsx`, `HomeView.jsx`, `TopicView.jsx`. Reuse existing codes; do not rename them or create UI positions in this phase.

| Existing technical code | Current placement | Seed dimensions | Visibility |
| --- | --- | --- | --- |
| `home_header_banner` | Above list-layout content | 970×90 | Responsive main column |
| `home_footer_banner` | Below list-layout content | 970×90 | Responsive main column |
| `home_sidebar_top` | Above community right sidebar | 300×250 | `lg` and wider |
| `home_sidebar_bottom` | Below community right sidebar | 300×250 | `lg` and wider |
| `topic_list_inline` | Home feed insertion key 4 | 728×90 | Responsive list |
| `topic_detail_top` | Before topic content | 728×90 | Responsive main column |
| `topic_detail_bottom` | After reply section | 728×90 | Responsive main column |
| `topic_sidebar_top` | Above topic sidebar | 300×250 | `lg` and wider |
| `topic_sidebar_bottom` | Below topic sidebar | 300×250 | `lg` and wider |

`home_*` codes are reused by the shared list layout on category/tag/rank/category-list pages, not exclusively the home URL. These are suggested image dimensions, not fixed display widths; current sidebar is `w-64`, so verify actual creative scaling before accepting paid placements. Empty/error slots return no placeholder by default. Existing image, HTML and script formats, impression observer and click calls are upstream display hooks, not proof of billing-grade analytics or policy compliance. No separate mobile-only, header-navigation or footer-global slot is proposed as already implemented.

## 6. Next actions / approval boundary

1. Completed: owner identity collision check, new local admin provisioning, real login, admin API checks and member/anonymous denial checks.
2. Completed: requested main Admin screen audit and screenshots. Owner can now explore the UI and change the initial password. Review the documented workflow/coverage limits before planning functional changes.
3. Owner reviews database-per-forum deployment, independent identities, host/JWT/cache/media boundaries, operational cost and standalone export plan.
4. Owner reviews mandatory/local policy precedence, offline expiry behavior, contextual review rules, retention and banner active-format restrictions.
5. Only after explicit design approval prepare scoped implementation and migration plans. No multi-forum migration, Central Server, SEO-OPS integration or demo-data modification is authorized by this report.
