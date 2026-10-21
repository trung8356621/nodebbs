# PBN — Phase 2.1B: Multi-forum implementation and portability

Verified: **2026-10-22, Asia/Bangkok**. Workspace: `D:\workspace-2026\pbn`. Environment: native Windows/Node.js, Laragon PostgreSQL **17.2**, dedicated PBN Redis at `127.0.0.1:16379`. No Docker or production deployment.

**Acceptance: PASS for the implemented development scope.** Forum A and Forum B run concurrently from the same source with separate Web/API processes, databases, authentication, caches and media. Forum B was exported and restored into another database, then verified through real login, API and Web requests. The earlier Phase 2.1 audit-stop outcome is superseded by this implementation.

## Running forums

| Forum | Web | API | Database | Default identity |
| --- | --- | --- | --- | --- |
| A | http://127.0.0.1:3100 | http://127.0.0.1:7100/api | `pbn_dev` | Existing NodeBBS name/data retained; Vietnamese; blue |
| B | http://127.0.0.1:3200 | http://127.0.0.1:7200/api | `pbn_forum_b` | PBN Forum B; English; purple |
| Restore rehearsal | Tested at `127.0.0.1:3300` | Tested at `127.0.0.1:7300/api` | `pbn_forum_b_restore` | B identity/data retained, new runtime secrets |

A/B remain running. The restore rehearsal's Web/API processes were stopped after successful verification; its database and media are retained. `pbn_bootstrap_check` is an additional retained empty-data database used to verify the finalized migration runner. The earlier `pbn_phase21_migration_audit_20261021` is also retained. No database was deleted.

Admin A is the existing owner **ID 7**, `trungtien1993`. Its password hash and RBAC admin association were preserved and normal login succeeded. Forum B has an independently provisioned **ID 1**, `forum_b_admin`, with its own random password and RBAC association. No global super-admin was introduced.

## Architecture and code

`forums/forum-a.json`, `forums/forum-b.json` and `forums/forum-b-restore.json` are a minimal, operator-controlled registry. Records contain immutable forum ID, database name/reference, fixed ports/hostname, name, logo, locale, primary color, description and status. There are no credentials in these files. Registry loading rejects duplicate IDs, databases or ports. An optional validated `publicOrigin` supports a future domain/reverse-proxy binding without modifying source; the applications bind to loopback.

`scripts/forum.mjs` provides `configure`, `create-db`, `migrate`, `seed`, `identity`, `admin`, `provision`, `start`, `stop` and `build`. A process selects its connection once at startup. No HTTP body, query or hostname selects a database. `apps/api/src/config/forum-runtime.js` validates fixed database identity, namespace, cookie, secret lengths, absolute upload path and pool budget. Inherited forum environment keys are cleared before constructing each child environment.

| Boundary | Implementation |
| --- | --- |
| DB and wallet | Separate `DATABASE_URL` per API; complete unprefixed schema per DB. Pool maximum **5** per API, reused for its process lifetime and closed through the existing DB plugin. No cross-database queries/FKs, shared content tables or `site_id`. |
| Authentication | Independent cryptographically generated JWT/cookie secrets, JWT issuer and audience `pbn:<forum_id>`, host-only HTTP-only cookies named `pbn_<forum_id>_auth`. Verification applies through the shared JWT plugin, including existing direct QR signing. Logout and SSR forwarding use the configured cookie name. |
| Same-IP cookies | Browsers share a hostname across ports, so both cookie names can be transmitted. Each forum reads only its own cookie; renamed/copied tokens still fail signature/audience verification. Two-cookie coexistence was tested. Separate public hostnames can be configured later. |
| Redis | `keyPrefix: pbn:<forum_id>:` is set on the actual ioredis client, covering cache helpers, direct permission counters, pipelines, online tracking and other keyed operations. No global Redis flush was used. |
| Uploads | Storage provider, multipart temporary staging, static serving and IPX all use the same per-process `UPLOAD_ROOT`. A reserves its existing `apps/api/uploads` root to preserve media URLs; every other forum gets `.local/forums/<id>/uploads`. Only A may select legacy storage. |
| Frontend | Fixed `SERVER_API_URL` per Web; correct forum cookie/locale forwarding for SSR. Existing components read separate DB settings. Root primary/ring CSS variables supply forum color. Existing UI layouts/components remain. |
| Locale | Independent default locale and locale cookie `pbn_<forum_id>_locale`; Vietnamese/English catalogs remain intact. |
| Build/cache | Dev directories `.next-forum_a`, `.next-forum_b`; build-check outputs `.next-forum_a-production`, `.next-forum_b-production`. Build config stamps prevent starting a built instance with mismatched config. Builds succeeded while the independent dev outputs were serving. |
| Jobs/provider state | API process-local schedulers, locks, provider maps, settings caches and online-stat caches now belong to one fixed forum. There is no dynamic mutable tenant state. |
| Logs/processes | `.local/forums/<id>/api.log`, `web.log`, `processes.json`. Background Node processes hide their Windows windows. Startup refuses occupied ports. Stop validates PBN command paths and stops only its managed process tree, supervisors first, waiting for shutdown. |
| Host/origin | Exact configured hosts only; unknown application hosts return **421**. Foreign Web Origin returns **403**. Forum-mode API does not trust forwarded hosts. |

Runtime secrets and generated passwords are stored only under ignored `.local/forums/<id>/`, protected using Windows owner-only ACLs. Secrets do not appear in process command arguments, tracked config, public evidence or frontend assets. Existing local `.env` supplies the development connection reference when first configuring a forum; `PBN_DATABASE_URL` and `PBN_REDIS_URL` can supply operator overrides. Credentials are never hard-coded into scripts.

## Migration: root cause and replacement workflow

The upstream journal has **5 entries for 17 SQL files**, begins with `0003_handy_lightspeed`, omits base/legacy creation files and has non-monotonic timestamps. Its first data-copy segment references `user_credits`, `credit_transactions` and `credit_system_config` before they exist in a fresh DB. The prior isolated replay failed in **statement segment 7**, `42P01: relation "user_credits" does not exist`, and was rolled back. Later entries also overlap table creation; sorting filenames or adding `IF EXISTS` does not repair this history safely.

**All upstream SQL/journal/snapshots under `apps/api/drizzle/` remain unchanged.** The separate `apps/api/drizzle.baseline.config.js` generated `apps/api/baseline/0000_simple_guardsmen.sql` from the complete composed schema: core, forum and all existing extensions. Drizzle creates tables before adding foreign keys, including cyclic dependencies. `extra.sql` adds `pg_trgm` and the four existing GIN search indexes. Generated snapshots/journal, immutable SHA-256 manifest and a schema catalog fingerprint are versioned alongside the baseline.

The independent runner:

1. Verifies the configured actual target database; refuses `pbn_dev` writes.
2. Requires an empty database for first baseline application; refuses adopting arbitrary existing tables.
3. Takes a database-local advisory transaction lock with a 10-second lock timeout.
4. Verifies immutable SQL checksums and ordered migration records.
5. Applies schema/index SQL and records version/checksum in `pbn_meta.schema_versions` in one transaction.
6. On rerun, verifies the stored checksum and skips applied records. Unknown/gapped/newer applied histories are rejected. Baseline v1 is checked for schema drift before commit.

The manifest supports future `{ "migrations": [<unchanged v1 record>, <v2 record>, ...] }` entries. Each record has its own increasing version, file list and hashes; v1's original checksum representation is retained. Generate/review forward SQL and append a new immutable record; do not edit applied SQL or use `db:push` as the migration workflow. No v2 business/schema change was introduced in this phase.

**Executed PASS:** fresh `pbn_forum_b` baseline and no-op rerun; finalized runner repeated on genuinely empty `pbn_bootstrap_check`: **58 public tables, 0 users**, committed v1, rerun no-op. Restored B also accepts the same no-op migration.

Version 1 manifest checksum: `9efcd5dbdc2427e0c8cb5512e93349a6921f31871d689df7af55a8959b665c97`.

### Existing Forum A transition

No baseline, seed, schema adoption or business write was run on `pbn_dev`. Read-only catalog comparison found exact equality with B's baseline: **586 columns, 178 constraints and 276 indexes**. A's existing upstream migration ledger remains untouched; the new ledger was deliberately not fabricated on A. Portable export can recognize A as **catalog-equivalent to baseline v1, not ledger-adopted** and include that explicit status in its manifest.

Before any future upgrade of A: export/restore A to another database, rehearse a reviewed ledger-adoption operation against the verified baseline, then separately authorize live adoption. The current CLI blocks migration/seed/admin/identity writes to `pbn_dev`. This is an explicit preservation boundary, not a claim that upstream migrations ran successfully.

## Actual isolation tests

Evidence: [isolation results](PHASE2.1B-test-results.json), [bootstrap results](PHASE2.1B-bootstrap-results.json), [schema comparison](PHASE2.1B-schema-comparison.json), [final checks](PHASE2.1B-final-checks.json). API and Playwright tests executed against real native services; no mocked database/cache was used.

| Test | Result and observed evidence |
| --- | --- |
| Both homepage/API pairs | PASS — 3100/7100 and 3200/7200 HTTP 200; browser pages render |
| Separate accounts/Admin | PASS — normal own-forum login/Admin API succeeds; foreign credentials return 401 both ways |
| Cross-forum tokens/cookies | PASS — bearer and renamed/copied cookies return 401 on auth/me, Admin stats, roles and ledger; both cookie names together resolve correct identities |
| Unauthorized cross writes | PASS — foreign-token user creation and topic PATCH return 401 both directions |
| Content/user separation | PASS — API creates B member/topic/reply and pins topic; SQL and public API checks find no B identities/content in A and no A identities/content in B |
| Colliding numeric IDs/RBAC | PASS — owner A ID 7 and ordinary B ID 7 produce different real `user:7` cache values; B member remains 403 on Admin |
| Redis isolation | PASS — actual auth/RBAC cache prefixes and same-named sentinel keys remain independent |
| Media isolation | PASS — real multipart PNG upload lands in B's staging/provider/file table; B API/Web serves it, A API/Web returns 404; no A file/row is created |
| Theme/name/default language | PASS — A Vietnamese/blue/existing name; B English/purple/PBN Forum B; observed in browser and API |
| Frontend isolation | PASS — B's actual browser login reaches B dashboard; B browser session cannot enter A dashboard; proxy/SSR cross-cookie checks deny access |
| Unknown hosts/browser Origin | PASS — native HTTP Host tests return 421 on both Web/API pairs; A Origin sent to B returns 403 |
| Restart B | PASS — A's managed process IDs remain unchanged; **18 authenticated health samples, all 200**, while B stops/restarts |
| B migration versus A | PASS — no-op B migration leaves A business counts and upstream ledger unchanged |
| Existing A data/Admin | PASS — 7 users, 57 categories, 117 topics, 122 posts, 7 user-role associations; wallet/transaction/ad/file counts remain 0; owner password hash and Admin RBAC preserved |

Initial verification exposed a Node-fetch Host-header test limitation, a Next shutdown/port-release race, and anonymous test-probe throttling. Native HTTP fixed the Host probe; process shutdown now waits and stops supervisors first; restart monitoring uses normal authenticated Admin requests to avoid the existing anonymous rate limit. The final recorded matrix passed after these corrections.

Screenshots: [A homepage](screenshots/phase21b/forum_a-home.png), [B homepage](screenshots/phase21b/forum_b-home.png), [B Admin](screenshots/phase21b/forum_b-dashboard.png). Some seed category/role/currency names remain upstream Chinese data; they were not rewritten as part of UI localization.

## Portable forum export/restore

`scripts/forum-portable.mjs` uses native `pg_dump`/`pg_restore` from Laragon. `PBN_PG_BIN` can override the binary directory. Connection credentials go through child environment variables, never command-line arguments or the exported public configuration.

Export requires stopping the selected managed forum for DB/media consistency. It opens a read-only repeatable-read transaction, exports its PostgreSQL snapshot, uses that same snapshot for the dump and row fingerprints, and copies only that forum's media. It writes:

- `forum.dump`: complete database, including migration metadata, sequences and business data.
- `media/`: forum-local media, with path traversal/symlink checks.
- `forum-public.json`: allowlisted forum identity/configuration, no secrets.
- `manifest.json`: dump/config/media SHA-256, per-table row counts/content hashes, schema/constraint/index hash, sequences and schema-version status.

Restore verifies every artifact checksum before creating a **new** database. It rejects existing database/media targets, restores transactionally with `--no-owner --no-privileges`, then compares all row contents/counts, schema/constraints/indexes, sequences, version and media checksums. Failed/partial targets are retained for diagnosis, not dropped or reused automatically. Fresh local runtime secrets are configured separately; no source forum secret is exported as runtime configuration. No Central API is needed to serve requests.

**Executed:** `pbn_forum_b` → `.local/exports/forum-b-phase21b` → `pbn_forum_b_restore`. Immediate post-restore equality covered **59 tables including the migration ledger** and **3 media files**. Separate checks confirmed **5 users, 3 roles, 5 role associations, 3 topics, 6 posts including replies, 3 wallet accounts, 3 ledger transactions, 3 banners, 3 file records**, pinned state and all settings. Real restored Admin login, dashboard, topics, ledger, ads, homepage, theme, locale and media succeeded. Restore-issued tokens were rejected by both A and source B.

Full evidence: [restore results](PHASE2.1B-restore-results.json). Source B remains intact. The private bundle includes normal database private data such as password hashes and any future provider settings; it must remain protected. It is excluded from Git and was not uploaded. SHA-256 verifies integrity, not encryption or sender authenticity.

For a standalone move: transfer the versioned source and protected bundle, configure the target forum and fresh secrets, restore to a new DB/media root, verify the manifest, bind the target domain, then run `identity` if the canonical site URL must change. Preserve the immutable forum ID when replacing the source runtime; this rehearsal used a different ID solely to run a temporary clone beside its source. Never delete the source as part of restore.

## Commands and handoff

Run from `D:\workspace-2026\pbn`, with the existing PostgreSQL and PBN Redis services active. Do not run these start commands again while the instances are already running.

```powershell
# Normal restart; no migration/seed needed
node scripts/forum.mjs stop forums/forum-a.json
node scripts/forum.mjs start forums/forum-a.json
node scripts/forum.mjs stop forums/forum-b.json
node scripts/forum.mjs start forums/forum-b.json

# Separate build verification outputs
node scripts/forum.mjs build forums/forum-a.json
node scripts/forum.mjs build forums/forum-b.json

# New forum: copy/edit a config with UNIQUE id/database/ports first
node scripts/forum.mjs provision forums/forum-c.json
node scripts/forum.mjs start forums/forum-c.json

# Existing baselined forum migration; never target pbn_dev
node scripts/forum.mjs migrate forums/forum-b.json

# Private password handoff, no password printed
pwsh -NoProfile -File scripts/copy-forum-admin-password.ps1 -ForumId forum_b
# Existing A helper remains unchanged
pwsh -NoProfile -File scripts/copy-pbn-admin-password.ps1
```

New-forum provisioning refuses to overwrite an existing database/Admin handoff. The individual `configure`, `create-db`, `migrate`, `seed`, `admin` commands allow explicit continuation after inspecting a partial provisioning attempt. Configuration changes require restarting that forum; changes affecting a built instance require rebuilding it. `identity` updates only the selected new/restored forum's site settings; it refuses A.

For another backup/restore rehearsal, choose a **new export directory** and **new target database/config**; the already tested paths/database are intentionally protected against overwrite:

```powershell
node scripts/forum.mjs stop forums/forum-b.json
node scripts/forum-portable.mjs export forums/forum-b.json .local/exports/forum-b-next
node scripts/forum.mjs start forums/forum-b.json
# Prepare a new unique target config; do NOT pre-create its database
node scripts/forum.mjs configure forums/forum-b-next-restore.json
node scripts/forum-portable.mjs restore forums/forum-b-next-restore.json .local/exports/forum-b-next
node scripts/forum.mjs start forums/forum-b-next-restore.json
```

Automated acceptance entrypoints: `node scripts/test-forum-isolation.mjs` and `node scripts/test-forum-restore.mjs`. The isolation test creates additional fixtures only in B; restore comparison should run against a freshly restored snapshot before subsequent source/target writes. Both require the local private test credentials and actual services. They are not a production/load/security certification.

## Builds, checks and remaining boundaries

- Both per-forum Next production-check builds exited **0**. Existing `DYNAMIC_SERVER_USAGE` messages from cookie-based robots/sitemap handlers remain; those routes are classified dynamic. API is native JavaScript and has no separate build task.
- ESLint exited **0**; full-source lint reports the same **11 pre-existing unused-disable warnings**. Finalized new scripts have no lint errors. `pnpm i18n:check` passed with **0 errors**. `git diff --check` passed.
- Secret scans found no live JWT/cookie/Admin secrets in Git-visible files or built frontend assets. Actual database URLs are absent from client assets. Local secrets, dumps, logs, uploads and all per-forum build directories are ignored. No commit/push was performed.
- A's new migration ledger is not adopted; read-only schema equivalence is verified as described above. No future live migration of A is authorized by this result.
- Development uses the existing Laragon database role/Redis server. Separate processes/databases/namespaces are application isolation, not protection from a compromised Windows account or PostgreSQL superuser. No OS/VPS isolation or production role hardening was deployed.
- Scheduler/provider state is process-local; multi-hour expiry behavior and every external provider integration were not exhaustively exercised. Existing wallet concurrency/idempotency and paid-pin/link-policy limitations remain unchanged.
- Export/restore was tested locally, not on a real VPS. No Central Server, Billing Server, SEO-OPS, Central Policy API or Phase 2.2 implementation was added.
