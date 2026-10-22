# PBN — Forum Network

Multi-forum platform based on NodeBBS, built with Next.js, Fastify and PostgreSQL.

PBN runs independent fixed Forum A/B installations with separate databases, sessions, caches and media. Phase 2.2 adds per-forum policy enforcement, signed global snapshots, local rules, moderation and migration-ledger adoption.

## Upstream and license

This project is based on [NodeBBS](https://github.com/aiprojecthub/nodebbs), by wengqianshan / qianshan w. Bootstrap upstream commit: `9dbac4be53cdc9ea58bb84854ffadb661e945c87` (NodeBBS 2.4.0). Git history and upstream attribution are retained. PBN-specific work does not imply authorship of the upstream source.

The source is distributed under the MIT License. The original **Copyright (c) 2025 qianshan w** notice and complete terms remain in [LICENSE](LICENSE). Preserve these notices when redistributing substantial portions. The upstream English documentation remains in [README.en.md](README.en.md); its deployment instructions may differ from this project's native development workflow.

## Technology stack and architecture

- Web: Next.js 16 App Router, React 19, Tailwind CSS 4, Radix UI and next-intl.
- API: Fastify 5, JWT/OAuth, PostgreSQL, Drizzle ORM and Redis.
- Tooling: Node.js 22+, pnpm 10.33.0, Turborepo, ESLint and Playwright.
- Local environment verified with Node.js 24.18.0, PostgreSQL Laragon 17.2 and native Redis 5.0.14.1. Upstream recommends PostgreSQL 16 and Redis 7; broader compatibility with the existing Redis version remains to be tested.

```text
apps/web/       Next.js pages, shared components, forum UI and extension UI
apps/api/       Fastify plugins, core routes, business modules and extensions
  src/db/       Drizzle schema composition
  src/modules/  Forum routes, services and schema
  src/i18n/     Response message catalogs (no database content translation)
  drizzle/      Preserved upstream SQL migration history
  baseline/     Versioned fresh-forum schema and checksummed migration manifest
forums/         Public fixed-instance configurations (no credentials)
scripts/        Development helpers and verification tools
docs/audit/     Bootstrap and implementation audit reports
```

Core services and the forum module are composed statically. Ledger, rewards, shop, badges, emoji and advertisement extensions already exist upstream. Each forum runs its own Web/API processes and database pool from the same source. Forum A/B isolation and portable export/restore are verified; there is no dynamic in-process tenant resolver or Central Server. See the [Phase 2.1B report](docs/audit/PHASE2.1-MULTI-FORUM.md).

## Local development — Windows + Laragon

**Docker is not used for development.** Original Docker assets are retained for upstream compatibility. Do not start, prune or remove containers or volumes as part of this workflow.

1. Open the existing Laragon installation and start PostgreSQL. Do not install another PostgreSQL instance or reset another project's data directory.
2. In `D:\workspace-2026\pbn`, run `pnpm install --frozen-lockfile`.
3. Copy `apps/api/.env.example` to `apps/api/.env` and `apps/web/.env.example` to `apps/web/.env` if local files do not already exist. Configure your own local database access and generate a random JWT secret. Never overwrite an existing local configuration blindly.
4. Preserve existing `pbn_dev` and its owner Admin. Provision a new database through the versioned forum workflow below; do not repeat the historical Phase 1 schema-push setup.
5. Start a dedicated native Redis process using `powershell -File scripts/start-pbn-redis.ps1`. The helper defaults to the Redis executable already installed in Laragon; supply `-RedisExe` if its path differs. An occupied port is rejected for manual ownership verification.

| Service | Local address | Scope |
| --- | --- | --- |
| PostgreSQL Laragon | `127.0.0.1:5432` | Database `pbn_dev`; confirm the actual Laragon port |
| Redis PBN | `127.0.0.1:16379`, DB 0 | Dedicated process; persistent files in ignored `.local/redis/` |
| Fastify | `127.0.0.1:7100` | Native Node.js development server |
| Next.js | `127.0.0.1:3100` | Native Node.js development server |

Check port ownership before starting services. Never stop all Node, Redis or PostgreSQL processes to resolve a conflict.

### Environment variables

| Application | Variable | Purpose |
| --- | --- | --- |
| API | `DATABASE_URL` | Your local PostgreSQL connection to `pbn_dev`; keep access details only in `.env` |
| API | `REDIS_URL` | Dedicated Redis endpoint, port 16379, DB 0 |
| API | `JWT_SECRET` | A locally generated random secret |
| API | `NODE_ENV`, `HOST`, `PORT` | Development, loopback address, port 7100 |
| API | `CORS_ORIGIN` | Explicit local Web origins |
| Web | `SERVER_API_URL` | `http://127.0.0.1:7100` |
| Web | `PORT` | 3100; pass the same port when invoking Next.js |
| Web/API | `FORUM_DEFAULT_LOCALE` | Default locale for this installation: `vi-VN` or `en-US` |
| Web | `NEXT_PUBLIC_FORUM_DEFAULT_LOCALE` | Matching fallback for standalone browser utilities; build-time configuration |

No credentials are required in this README. `.env`, runtime logs, local accounts, uploads, backups and smoke artifacts are ignored. `.env.example` templates remain tracked.

### Versioned new-forum bootstrap

The upstream migration journal is preserved but cannot bootstrap an empty database. Use the separate checksummed baseline and fixed-instance scripts. Forum A has now completed schema-validated baseline adoption after a restore rehearsal; A/B use baseline v2. Existing nonempty databases require verified adoption before versioned upgrades. Do not run upstream db:migrate, db:push, reset or seed on A/B. See the [Phase 2.2 migration and recovery procedures](docs/audit/PHASE2.2-POLICY-ENGINE.md).

For an entirely new forum, copy a config in forums/ and give it a unique ID, database and ports, then run:

~~~powershell
node scripts/forum.mjs provision forums/forum-c.json
node scripts/forum.mjs start forums/forum-c.json
~~~

Secrets are generated into owner-protected, ignored .local/forums/<id>/ files. The existing local API environment supplies development connection references; PBN_DATABASE_URL/PBN_REDIS_URL can override them. Provisioning refuses to overwrite an existing database or Admin. See the [full migration and portability procedures](docs/audit/PHASE2.1-MULTI-FORUM.md).

### Start/restart the two configured forums

After PostgreSQL and dedicated PBN Redis are ready, use these commands from the repository root. They launch hidden background processes and independent logs/build caches; do not start a second copy of an already running instance.

~~~powershell
node scripts/forum.mjs start forums/forum-a.json
node scripts/forum.mjs start forums/forum-b.json
# Stop only the selected managed forum before restarting it:
node scripts/forum.mjs stop forums/forum-b.json
node scripts/forum.mjs start forums/forum-b.json
~~~

Forum A: [Web](http://127.0.0.1:3100), [API](http://127.0.0.1:7100/api). Forum B: [Web](http://127.0.0.1:3200), [API](http://127.0.0.1:7200/api). Logs and process state: .local/forums/<id>/. The upstream pnpm dev commands remain legacy single-installation entrypoints; use forum.mjs for the verified isolated configuration. No migration/seed is needed on normal restart.

## Internationalization — Vietnamese and English

The interface supports **vi-VN** and **en-US** using next-intl. Vietnamese is the development default. The header language selector writes a forum-specific locale cookie for one year and reloads the current URL. Forum A defaults to Vietnamese; Forum B defaults to English. Legacy single-instance mode retains pbn-locale.

There are no locale URL prefixes, routing rewrites or language-specific sitemap/canonical variants. The existing route paths are retained. Server Components resolve the locale per request; Client Components share the same provider. Dictionaries under `apps/web/src/i18n/messages/` are organized into auth, forum, common, admin, profile, wallet, shop, ads, badges and rewards namespaces, with matching keys and English fallback.

Utilities accept a translator for server rendering rather than changing global locale state. Backend response catalogs localize application-owned message/error envelopes and known generated notifications using the cookie or explicit supported `Accept-Language`. Status codes, field names, technical identifiers, database values and user content remain unchanged. Existing category names, products, badges, roles, currency names and administrator-authored content retain their stored language; they are data rather than automatic translation targets.

When adding interface text, add the same key and interpolation parameters to both catalogs and update the namespace map. Keep original-language text only in the source-message catalog for migration/reference, not in UI components. `pnpm i18n:check` checks parity, interpolation, ICU formatting, key references, backend catalog coverage and hard-coded Chinese interface strings. Developer logs in UI modules use English; comments are not treated as interface text.

## Verification commands

```powershell
pnpm lint
pnpm i18n:check
pnpm build
pnpm exec playwright install chromium
pnpm smoke:i18n
```

Browser smoke requires running local services and local smoke account access, as described by the script. Artifacts are saved under ignored `.local/`. Production build output is verification only; no production deployment is performed. The audit report distinguishes executed browser/API checks from integrations that were not tested.

## Current status and roadmap

Core forum flows run locally: registration/sign-in, categories/topics, topic creation, replies, admin statistics and manual pin/unpin. Native services, Web SSR and API proxy were verified. Phase 1.5 adds bilingual interface text, response messages, repository hygiene and project documentation; review is pending. Phase 2.1B verifies independent per-forum processes/databases/auth/cache/media and a portable B restore. Phase 2.2 verifies local/global outbound policy, moderation, signed synchronization, resumable scanning and migration adoption. Phase 2.3 adds atomic Credit purchases, paid-pin renewal/expiration and classified outbound links.

| Phase | Status |
| --- | --- |
| Phase 1: Bootstrap NodeBBS | Completed |
| Phase 1.5: i18n / Git / README | In progress — implemented, awaiting review |
| Phase 2.1B: Separate-process multi-forum foundation and portable DB | Implemented and tested locally |
| Phase 2.2: Policy engine and migration hardening | Implemented and verified locally; see the audit report |
| Phase 2.3: Wallet / Paid Pin / expiring SEO policy | Implemented and verified locally; see audit report |
| Phase 4: Banner Management | Planned |
| SEO-OPS integration | Deferred |

These roadmap entries do not authorize automatic implementation. See [Phase 1 setup](docs/audit/PHASE1-SETUP.md), [feature matrix](docs/audit/PHASE1-FEATURE-MATRIX.md), [architecture audit](docs/audit/PHASE1-ARCHITECTURE.md), [blockers](docs/audit/PHASE1-BLOCKERS.md) and the [Phase 1.5 report](docs/audit/PHASE1.5-I18N-GIT-README.md) for evidence and limitations.

## Policy and moderation — Phase 2.2

Open `/dashboard/policy` inside each forum for read-only global policy status, local rule management, audit/resolution history and resumable content scans. Existing `/dashboard/moderation` handles held content. Global mandatory BLOCK rules cannot be overridden by a local rule or administrator approval.

Policy checks run in the forum API, with no per-post Central Server call. Configure an operator-trusted Ed25519 public-key/signed-snapshot file provider before ordinary publishing; an installation without its first verified snapshot holds submissions for review. For reserved-domain development fixtures, run `node scripts/policy-fixture.mjs` and restart the selected managed forums. This helper keeps signing keys and source references in ignored owner-protected local directories and preserves newer snapshots. No Central Policy Server or production threat feed is deployed.

Verification-required redirects remain pending until explicit review; no live redirect scanning is claimed. Script/HTML ads stay inactive until converted to an inspectable image; active HTML pages stay drafted until converted to Markdown/text. Active HTML/SVG/XML/script uploads cannot bypass Admin wildcard permissions; raster uploads and existing download-only attachments remain supported. Existing active media is preserved with safe download headers.

Publishing/content/credit/queue writes share a transaction; domain events run after commit. Policy locking uses a bounded extra two-connection pool per forum beside the existing maximum-five application pool. See [Phase 2.2 implementation, configuration, tests and production limits](docs/audit/PHASE2.2-POLICY-ENGINE.md).

## Credit wallet and monthly SEO entitlements — Phase 2.3 FINAL

Topic owners explicitly confirm an authorized monthly SEO package on their topic page. **1 Credit = 10,000 VND** (`apps/api/src/modules/forum/services/seo/constants.js`); Credit is integer-only. Valid zero-price packages create purchase/entitlement history without a fake ledger debit. Paid packages reuse the existing Wallet/ledger. Calendar-month renewal is allowed only within the signed product's renewal window. Editing is free; deactivation, hiding and expiration do not refund or extend the term.

SEO changes eligible topic outbound links to `ugc sponsored`. Ordinary links remain `ugc nofollow`; independently reviewed, noncommercial editorial links retain security tokens. Replies retain their own UGC policy. Raw topic HTML remains escaped. **SEO does not move, sort or pin topics.** Existing moderator pins remain independent. Reserved topics (`seo_purchase_allowed=false`) cannot buy; reservation immediately suspends an existing term's effect without rewriting its history or dates.

`/dashboard/seo` shows read-only products, schedules, source versions/sync diagnostics, purchases and entitlements. Pricing is controlled exclusively by signed, forum-targeted OPS-style snapshots. No local price editor, real OPS service, payment gateway, banner checkout or placement auction is implemented. `/dashboard/pins` redirects to this page; the superseded placement purchase and local plan-write API routes return 410. Historical purchases remain preserved, with explicit editorial-review and technical-correction APIs retained.

After a protected backup, migrate each forum and restart its managed process:

```powershell
node scripts/forum.mjs migrate forums/forum-a.json
node scripts/forum.mjs migrate forums/forum-b.json
node scripts/forum-seo.mjs sync forums/forum-a.json
node scripts/forum-seo.mjs reconcile forums/forum-a.json
```

Configure owner-protected `opsPriceTrustKeyFile`, `opsPriceSnapshotFile`, and `opsPriceSourceId` in each forum's ignored secrets file. `node scripts/seo-price-fixture.mjs` creates independent **development-only** signed sources for A/B; it preserves existing fixture keys and snapshots. Restart after changing source references. The file provider checks every five minutes; checkout uses only verified local database snapshots. Effective intervals and snapshot expiry are evaluated with database time, without a midnight cron or external checkout call. No valid current price means no purchase. API/SSR reads use no-store; open topics have a single expiry deadline timer. Housekeeping processes at most 50 due SEO rows per run.

See [Phase 2.3 FINAL implementation, contract and verification](docs/audit/PHASE2.3-WALLET-SEO-ENTITLEMENTS.md). The earlier [paid-placement report](docs/audit/PHASE2.3-WALLET-PAID-PIN.md) is historical and superseded by FINAL. Test fixtures fund only dedicated accounts; do not run development acceptance helpers against production.
