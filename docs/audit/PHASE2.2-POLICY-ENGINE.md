# PBN Phase 2.2 — Policy Engine and Moderation Safeguards

Verified on **2026-10-22 (Asia/Bangkok)** in `D:\workspace-2026\pbn`, native Windows/Laragon PostgreSQL 17.2, Redis 16379, Node.js/pnpm. No Docker, production deployment, Central Server or Phase 2.3 work.

## Feature and acceptance matrix

| Capability | Result | Evidence / boundary |
|---|---|---|
| A baseline adoption and preservation | PASS | Restored rehearsal, exact catalog validation, table row hashes, metadata-only live adoption, idempotent rerun; `PHASE2.2-adoption-results.json` |
| Additive policy migration and empty bootstrap | PASS | A/B v2 and reruns; genuinely empty DB v1+v2; expected catalog checked before/after; `PHASE2.2-bootstrap-results.json` |
| Global/local ALLOW, REVIEW, BLOCK | PASS | Parser/unit assertions and real A/B APIs; local ALLOW cannot weaken global BLOCK |
| API enforcement and audit | PASS | Topic/reply create/edit; own/admin/registration profile names, bio/avatar; banner targets; discovered published pages; `PHASE2.2-api-results.json`, `PHASE2.2-fields-results.json` |
| Local rule administration and global read-only status | PASS | Existing dashboard `/dashboard/policy`; create/edit/disable/delete/search/category/type filters; real browser mutations |
| Moderation queue and resolution history | PASS | Existing `moderation_items`/adapters reused; policy decisions plus reviewer/resolution history; both approval paths recheck mandatory rules |
| Signed policy fixture synchronization | PASS | Ed25519 authentication + SHA-256, monotonic versioning, transaction/advisory locking, concurrent sync, invalid signature/replay tests; `PHASE2.2-security-results.json` |
| Bounded resumable scanning | PASS | Saved target/cursor; batch limit; database active-job uniqueness; SKIP LOCKED worker exclusion; dry run; newly mandatory rule hides existing fixtures; no body rewriting/deletion |
| Atomic writes and failed-operation safety | PASS | Request-scoped Drizzle transaction, deferred events; injected topic/post/case failures roll back; rejected publishing does not deduct credits; `PHASE2.2-integration-results.json` |
| Active uploaded markup bypass prevention | PASS | Admin HTML/SVG multipart/presign/confirm rejected and audited; PNG upload/static regression; `PHASE2.2-upload-results.json` |
| A/B runtime/auth/DB/Redis/media independence | PASS | Reused native isolation regression, including colliding user ID 7, real upload, browser sessions and B restart with A available; `PHASE2.2-isolation-results.json` |
| Vietnamese/English UI | PASS | Both locales in both forums; local rule UI round-trip; `PHASE2.2-browser-results.json`, screenshots under `screenshots/phase22/` |
| Registration/login, topic/reply, dashboard regression | PASS | Real requests and browser checks, including registration with independent test account |
| Export/restore with policy records | PASS | Fresh B export/restore: 64 tables, the source media set in final rehearsal; row hashes/counts, schema, sequences, versions/media matched; restored Admin/policy/dashboard login and foreign-token rejection; `PHASE2.2-restore-results.json` |
| Builds/lint/i18n | PASS with existing warnings | Both isolated production-check builds exit 0; lint exit 0 with 11 existing warnings; i18n 707 backend templates and 2,561 web keys per locale, zero errors |
| Dedicated profile website field | NOT APPLICABLE | Current schema/API has no website property. Existing link-bearing bio/avatar/name fields are checked |
| Live HTTP redirect destination proof | NOT TESTED / intentionally unavailable | No live redirect fetching is enabled. Verification-required rules always return REVIEW; no unverified destination is classified safe |
| Production threat-feed/legal accuracy, AV, load, VPS deployment | NOT TESTED | Development fixtures and bounded deterministic matching are not a production security certification |

## Migration hardening

The upstream Drizzle journal starts with a migration that reads legacy `user_credits` before creation, has incomplete/non-monotonic history, and cannot safely bootstrap an empty database. The prior `42P01` failure is retained as historical evidence. Upstream `apps/api/drizzle/` is unchanged.

A had an upstream `drizzle.__drizzle_migrations` ledger and the complete existing schema, while B had been created by the separate checksummed baseline and recorded `pbn_meta.schema_versions`. They had identical public catalogs: **586 columns, 178 constraints, 276 indexes**. A was schema-equivalent but not baseline-ledger-adopted.

`scripts/forum-adopt.mjs` verifies the immutable v1 SQL checksums, actual configured DB identity, exact catalog equality and existing ledger compatibility. It takes the same database-local migration advisory lock and SHARE locks on public tables, records per-table row counts/content checksums, and writes only `pbn_meta.schema_versions` and `pbn_meta.schema_adoptions` in one transaction. `ON CONFLICT` permits verified reruns without duplicate metadata. It certifies **baseline schema adoption**, not execution of missing upstream SQL. Existing upstream ledger rows are preserved.

A protected `pg_dump` was restored into `pbn_phase22_adoption_rehearsal` first. Rehearsal adoption and rerun passed. Live A adoption then matched all rehearsal public-table fingerprints, followed by a successful live rerun. A initially retained seven users, 57 categories, 117 topics, 122 posts and all Admin/RBAC/password/wallet data. No table was recreated or synchronized destructively. Later API tests add visibly named fixtures; those additions are distinct from the migration preservation result.

Version 2 creates five public tables: `policy_rules`, `policy_versions`, `policy_decisions`, `policy_syncs`, `policy_scans`. A custom partial unique index permits one pending/running scan per DB. `moderation_items` remains the sole moderation-case queue; no redundant case table is introduced. The Drizzle schema and snapshot include that index; rerunning generation reports no changes. Baseline v1 SQL and its checksum representation are unchanged. `.gitattributes` pins baseline SQL to LF so Windows checkout conversion cannot invalidate immutable hashes.

`forum.mjs migrate` now permits an already adopted A, checks applied version/hash continuity, verifies the expected public catalog **before** applying new SQL and **after** applying the final version, and executes each upgrade plus metadata atomically. Existing nonempty databases without an adopted ledger are rejected. Future versions require immutable appended manifest records and a reviewed `catalog-vN.json`; generate and rehearse on an isolated DB before running against a forum. Never use upstream `db:migrate`, destructive `db:push`, reset or seed to repair existing A/B.

### Recovery and rollback

- Failed adoption/upgrade transactions roll back metadata/DDL and release locks; retain the error and compare the catalog before retrying. Do not insert success rows manually.
- Adoption can be rerun only on the exact v1 schema. After upgrading to v2, use `forum.mjs migrate` for verified no-op reruns, not `forum-adopt.mjs`.
- Keep the protected pre-change dump and rehearsal DB; private artifacts remain under ignored `.local/phase22/` and `.local/exports/`. No dump or secret is committed.
- There is no automatic destructive down migration. To recover from an unwanted committed upgrade, stop the affected managed forum, restore its protected pre-change bundle into a **new** DB/media target, verify it, then explicitly arrange cutover. Never restore over or drop A/B automatically.
- Metadata-only adoption reversal is an operator recovery procedure: it is appropriate only before any forward migration, after backup and catalog verification. Do not remove a v1 ledger once v2 depends on it. This phase did not execute a reversal or delete any DB.

## Evaluation and write flow

1. Existing route authentication/preHandlers run. Each process has its fixed forum DB and secrets; no request field selects a forum.
2. A bounded two-connection policy-lock pool takes a DB-local shared advisory lock spanning evaluation through publication. The existing application pool remains maximum five. Rule mutations/sync take the corresponding exclusive transaction lock. Per-content advisory locks also serialize overlapping revisions before reading unchanged fields; this prevents concurrent title/body edits from combining into a blocked revision. This prevents policy changes racing publication without exhausting the main pool with lock-only clients.
3. Build the proposed complete topic/page/banner revision, retaining unchanged fields. Inspect title/body/tags, Markdown links/references/autolinks, HTML attributes, images, plain URLs and supported profile fields. `unified`, `remark-parse`, `remark-gfm` and `parse5` parse actual content; HTML inspection is not raw-HTML regex matching alone.
4. WHATWG URL/IDNA normalization handles host case, Unicode/Punycode, trailing dots/default ports, HTML entities, encoded HTTP URLs/path segments, fragments and common tracking parameters. Host rules use exact equality or a dot boundary; URL prefix rules also require the same origin and a path-segment boundary. Invalid/unsupported link schemes require review. Content over 200,000 characters is rejected conservatively.
5. Combine enabled rules deterministically: global scope first, descending priority then stable ID; effective BLOCK wins over REVIEW, then ALLOW. Local ALLOW never defeats any mandatory global BLOCK. Local duplicates by scope/type/value are rejected by the DB. No external network call is required for posting and no Redis policy cache is shared.
6. Persist decision ID, forum ID, actor/content reference where available, content SHA-256, matched rule IDs, action/reason and timestamp. Public rejection messages are safe Vietnamese/English text; detailed rule evidence is restricted to authorized dashboard users.
7. BLOCK returns HTTP 422 before content/credit/file writes. REVIEW sets topic and first-post/reply visibility pending from initial insertion, stages profile field values, or saves pages as drafts/banners inactive, then queues the existing moderation case. Missing initial global snapshot also requires REVIEW; approval is refused until a verified snapshot exists.
8. Publishing, related content/credit writes and queue records use one contextual Drizzle transaction. Existing imported services participate without changing core/module dependencies. Domain events run outside the completed transaction, only after commit. Decision-content references are updated in that same publishing transaction.
9. Moderation approval locks the queue/content, checks the current complete candidate against current policy, and cannot override BLOCK. Legacy topic/post approval endpoints receive the same recheck and atomic wrapper. REVIEW can receive an explicit authorized human approval; this does not claim redirect verification. Reviewer/resolution history is retained.

Text-signal rules contain versioned data arrays `subject`, `promotion`, optional `context`. A subject word alone does not imply prohibited activity. A configured subject plus commercial/referral solicitation can block; warning/news/educational context accompanying that promotion goes to REVIEW. This is deterministic context handling, not a legal classifier or an accurate general semantic moderation model.

## Outbound verification and active content

`verify_redirect` rules target configured exact hosts and always require REVIEW. The optional diagnostic helper restricts HTTP(S), credentials and ports, rejects private/loopback/link-local/reserved/mapped/IPv6 destinations conservatively, and bounds DNS lookup time. It performs **no HTTP request**, follows no redirects, sends no cookies/credentials, executes no page JavaScript and does not maintain a live crawler. DNS success is insufficient to label a redirect safe. A reliable future verifier must pin validated public IPs, revalidate every hop and enforce egress, rate, time/hop/size limits; that network worker is deliberately unavailable in this phase. Normal posting never waits on live external scans.

Active script/HTML advertisements are held inactive and cannot be approved until converted to an inspectable image format; no unsafe execution exception was added. Discovered active HTML pages similarly stay drafted until converted to Markdown/text, since static URL matching cannot prove dynamic HTML safe. New HTML/SVG/XML/script uploads are denied regardless of Admin wildcard file permissions. Public media categories accept raster images; ordinary permitted attachments retain the existing authenticated/download-only path. Multipart, presign and confirmation all enforce the same active-markup restriction and audit rejection. Legacy active markup files are preserved but served with attachment, nosniff and restrictive sandbox/CSP headers; IPX rejects active markup paths. Binary archives/PDF/Office attachments are not deeply analyzed or antivirus-scanned by this policy engine.

## API and dashboard

All new endpoints are under `/api/policy` and require the existing `dashboard.moderation` permission. Global snapshots cannot be supplied by browser request payloads or altered through local rule endpoints.

| Endpoint | Purpose |
|---|---|
| `GET /api/policy/` | Global/local rules and version/status, latest 20 sync/scan records, latest 100 decisions/resolutions |
| `POST /api/policy/rules` | Validate/create a local rule with server-generated local ID |
| `PUT /api/policy/rules/:id` | Replace a local rule, including enable/disable; global IDs return 404 |
| `DELETE /api/policy/rules/:id` | Delete a local rule; UI confirms first; mutation audited |
| `POST /api/policy/sync` | Apply only the operator-configured signed file provider |
| `POST /api/policy/scans` | Start bounded scan; dry run defaults true; second active job returns 409 |

`/dashboard/policy` uses the existing dashboard/sidebar, PageHeader, Button, Input and API client. Global rules/version/source/latest applied time and sync failures are read-only. Local rules support filter/search/editor/toggle/confirmed delete. Audit history shows rule reasons, content reference and timestamps; resolution history includes reviewer, result and resolution reason. `/dashboard/moderation` remains the shared review UI with its existing approve/reject endpoints and adapters for added page/banner targets. The existing `Time.jsx` received only the targeted relative-clock hydration fix exposed by regression. English/Vietnamese catalogs and safe API messages are maintained; diagnostic rule IDs/types/reasons remain operator data.

## Signed synchronization contract

The local file provider stands in for a future trusted source; **no Central Policy Server exists**. Transport is separate from verification. A future HTTPS source may return the same envelope and version metadata, but must not place trust keys under local Admin control.

```json
{
  "payload": "base64 of exact UTF-8 JSON payload bytes",
  "checksum": "SHA-256 hex of those decoded bytes",
  "signature": "base64 Ed25519 signature over those exact bytes"
}
```

Decoded payload shape: `{ "schemaVersion": 1, "version": 1, "rules": [...] }`. Global rule IDs use `g:`; supported type/category/action/value/reason/ID uniqueness are validated before application. Envelope/payload/rule-count limits apply. The Ed25519 public key is an operator-controlled PEM outside the payload. Checksum alone never authenticates a source. A lower version is rejected; an equal version with different checksum is rejected; identical equal-version sync is idempotent. Rules, version, sync-success record and rescan scheduling commit together under a DB-local exclusive lock. Failures retain the last valid rules/version and are logged. File-source read failures are also recorded. Normal writes continue from the last verified snapshot when the file provider is unavailable. No wall-clock expiry is enforced; operators must monitor synchronization staleness.

For local development run `node scripts/policy-fixture.mjs`. It generates an owner-protected ignored Ed25519 signing key/public key and signs the versioned reserved-domain fixture data in `scripts/fixtures/policy-development.json`. It configures A/B operator secret references and preserves any already signed newer snapshot on rerun. Restart each selected forum to load configuration. This development signing key belongs only to the local test provider; never distribute it to untrusted forum operators in production.

Operator-only `.local/forums/<id>/secrets.json` fields `policyTrustKeyFile` and `policySnapshotFile` become `POLICY_TRUST_KEY_FILE` and `POLICY_SNAPSHOT_FILE` inside that forum. They are not editable through the Admin API. Trust-key rotation is an explicit trusted operator operation outside this UI. The runtime supports `POLICY_SYNC_INTERVAL_MS` (default 300,000, minimum 60,000), `POLICY_SCAN_BATCH_SIZE` (default 25, range 1–100) and `POLICY_SCAN_INTERVAL_MS` (default 5,000, minimum 1,000). Per-forum child environment overrides may configure these values. Default settings are intentionally bounded for local PostgreSQL.

## Retrospective scanning

Each forum stores its own job row with dry-run flag, source number, primary-key cursor, scanned/affected totals, error and update timestamp. Sources are topics plus first post, replies, relevant profile fields, banners and discovered published pages. Each tick processes at most one bounded page in a transaction. Row locks with SKIP LOCKED prevent two workers processing one checkpoint, and a partial unique index prevents duplicate active jobs. An error rolls back that batch, persists its diagnostic and retains the checkpoint for retry/restart.

A changed global snapshot or local rule restarts the active job checkpoint (or schedules one), so an update arriving mid-scan cannot skip already traversed content. Mandatory BLOCK or REVIEW hides affected topics/replies, disables banners, drafts pages, or stages/removes visible profile values. Original topic/reply bodies are never rewritten or deleted. Hidden profile values are retained in case payload/snapshot, including when another staged proposal already exists. Cases show decision/scan evidence and reuse pending cases. Dry run records decisions/progress/affected counts without changing visibility or cases. Repeated scans are conservative and may reopen REVIEW for previously approved content; no permanent allow exception is implemented.

## Verification, fixes and remaining limits

Executable entrypoints (from repository root):

```powershell
node scripts/test-policy-unit.mjs
node scripts/test-policy-api.mjs
node scripts/test-policy-fields.mjs
node scripts/test-policy-concurrency.mjs
node scripts/test-policy-security.mjs
node scripts/test-policy-upload.mjs
node scripts/test-policy-bootstrap.mjs
node scripts/test-policy-integration.mjs
node scripts/test-policy-browser.mjs
node scripts/test-policy-isolation.mjs
node scripts/test-policy-restore.mjs
pnpm lint
pnpm i18n:check
node scripts/forum.mjs build forums/forum-a.json
node scripts/forum.mjs build forums/forum-b.json
```

Run bootstrap immediately before isolated integration testing: integration uses that newly created test DB. Live API/browser/isolation tests require the existing private Admin handoffs and A/B processes. They intentionally add separate fixtures; repeated bootstrap/restore runs retain new test databases/media instead of deleting/resetting anything. The isolation entrypoint reuses the prior-phase regression but writes new Phase 2.2 evidence and selects original A content because policy tests deliberately use equal fixture titles in both forums. Earlier audit evidence is not overwritten.

Verified auto-fixes included scanner SQL parameter inference, readiness checks after managed non-watching API restarts, test username length/required raw-content fields, the legacy approval bypass, transaction/event timing, concurrent review locks, uploaded active markup, and stable Windows SQL line endings, and the existing empty-update error on content-only topic edits. Concurrent title/body and unchanged-profile/first-post context are covered by `PHASE2.2-concurrency-results.json`. A faulty original isolation assertion mistook intentionally equal fixture titles for leakage; its comparison now selects original A content. All affected final checks pass; initial failed runs are not counted as final passes. A minute-boundary drift in the existing relative-time component also caused a homepage hydration error; `Time.jsx` now suppresses only the expected relative-clock text mismatch, and final browser/isolation/build checks were rerun.

Known existing messages: 11 ESLint unused-disable warnings and cookie-driven sitemap/robots `DYNAMIC_SERVER_USAGE` build messages; builds exit 0 and those routes remain dynamic. API is native JavaScript with no separate compilation build. Browser checks cover desktop operation in both locales, not exhaustive mobile/accessibility testing. No load/soak, wallet concurrency/financial certification, actual VPS move, live redirect scanning, real malicious third-party crawling, or production threat-feed/legal classification is claimed. Administrative metadata/configuration outside the enumerated content write paths and opaque binary attachments are not a general-purpose DLP/security scanner.

Production readiness: **development acceptance verified; production deployment not certified**. Supply a trusted reviewed real policy source, separately protect signing keys/least-privilege DB/OS access, monitor sync and scan health, define retention/appeal policy, assess legal rules with the operator, and provide isolated reliable verification if redirect automation is needed. Local DB/OS superusers remain outside the HTTP Admin trust boundary. Existing shared Laragon infrastructure is unchanged.

## Changed source groups and Git

- `scripts/forum-adopt.mjs`, `scripts/forum.mjs`, `.gitattributes`, `apps/api/baseline/{manifest.json,0001_keen_bulldozer.sql,catalog-v2.json,meta/}`: adoption, additive migration and future drift checking.
- `apps/api/src/db/{schema.js,policy-schema.js,index.js,write-context.js}`: policy data models and contextual transactions.
- `apps/api/src/services/policy/{engine.js,destination.js,sync.js,service.js,scan.js,upload.js}`, `plugins/policy.js`, `routes/policy/index.js`: local policy execution, authenticity, enforcement/audit and scanning.
- Topic/post/user/upload routes, moderation service, event bus and static plugins: existing publishing/pending integration, atomicity, approval guards and active-markup protection.
- `/dashboard/policy`, dashboard sidebar and web/API locale catalogs: administration and translations. Parser dependencies/lockfile are updated.
- `scripts/policy-fixture.mjs`, `scripts/policy-test-helper.mjs`, `scripts/test-policy-*.mjs`, reserved-domain fixture JSON, this report and Phase 2.2 evidence/screenshots: repeatable development verification.

Git finalization uses the existing feature branch and personal `origin` (`trung8356621/nodebbs`). Upstream NodeBBS is read-only; no force push, history rewrite, merge to main or attribution/license change. Runtime configuration, private keys, passwords, dumps, test artifacts and build caches remain ignored. The final commit SHA and push result are reported in chat after execution.
