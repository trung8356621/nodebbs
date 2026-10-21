# PBN — Forum Network

Multi-forum platform based on NodeBBS, built with Next.js, Fastify and PostgreSQL.

PBN currently runs as a single forum installation. The network capabilities below are a roadmap, not implemented tenant isolation.

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
  drizzle/      Upstream SQL migration history
scripts/        Development helpers and verification tools
docs/audit/     Bootstrap and implementation audit reports
```

Core services and the forum module are composed statically. Ledger, rewards, shop, badges, emoji and advertisement extensions already exist upstream. One database connection pool currently serves one installation. There is no hostname-based tenant isolation or cross-forum Topic Registry yet.

## Local development — Windows + Laragon

**Docker is not used for development.** Original Docker assets are retained for upstream compatibility. Do not start, prune or remove containers or volumes as part of this workflow.

1. Open the existing Laragon installation and start PostgreSQL. Do not install another PostgreSQL instance or reset another project's data directory.
2. In `D:\workspace-2026\pbn`, run `pnpm install --frozen-lockfile`.
3. Copy `apps/api/.env.example` to `apps/api/.env` and `apps/web/.env.example` to `apps/web/.env` if local files do not already exist. Configure your own local database access and generate a random JWT secret. Never overwrite an existing local configuration blindly.
4. Create **only** the `pbn_dev` database if it does not exist, using Laragon's PostgreSQL tools and your local database role. Confirm `SELECT current_database()` returns `pbn_dev` before schema or seed operations.
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

### Database initialization and migration limitation

The upstream migration journal **fails on a fresh database**, because its first registered data migration reads the missing legacy table `user_credits`. Phase 1 used the README-supported schema-push workflow on the newly created `pbn_dev` database:

```powershell
pnpm --dir apps/api exec dotenvx run -- pnpm db:push
pnpm --dir apps/api seed
```

Schema, search extension/index initialization and seeds succeeded. This does **not** repair the migration history: zero historical migrations were recorded as applied. Do not run `db:migrate` against this bootstrapped database until a reviewed baseline/upgrade procedure is ready. Never run reset/clean commands against existing data. No schema migration is required for i18n.

### Start Web and API

Run each command in a separate terminal, after PostgreSQL and Redis are ready:

```powershell
Set-Location D:\workspace-2026\pbn
pnpm --dir apps/api dev
```

```powershell
Set-Location D:\workspace-2026\pbn
pnpm --dir apps/web exec next dev --turbopack -p 3100 --hostname 127.0.0.1
```

`pnpm dev` runs both applications through Turbo. The upstream Web script may listen beyond loopback; the explicit command above limits access to this machine. Use Ctrl+C to stop each foreground process. After restarting Windows, reopen Laragon, start PostgreSQL, start the dedicated Redis helper and run these two commands again. Re-running schema setup and seeds is unnecessary.

- Frontend: [http://127.0.0.1:3100](http://127.0.0.1:3100)
- API health: [http://127.0.0.1:7100/api](http://127.0.0.1:7100/api)
- API documentation: [http://127.0.0.1:7100/docs](http://127.0.0.1:7100/docs)

## Internationalization — Vietnamese and English

The interface supports **vi-VN** and **en-US** using next-intl. Vietnamese is the development default. The header language selector writes the `pbn-locale` cookie for one year and reloads the current URL. The cookie is host-scoped, allowing independent future forum installations to choose their own defaults. This is configuration preparation, not multi-tenant implementation.

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

Core forum flows run locally: registration/sign-in, categories/topics, topic creation, replies, admin statistics and manual pin/unpin. Native services, Web SSR and API proxy were verified. Phase 1.5 adds bilingual interface text, response messages, repository hygiene and project documentation; review is pending. Wallet concurrency/idempotency, paid pin expiry, outbound link policy and tenant isolation are not implemented by this phase.

| Phase | Status |
| --- | --- |
| Phase 1: Bootstrap NodeBBS | Completed |
| Phase 1.5: i18n / Git / README | In progress — implemented, awaiting review |
| Phase 2: Multi-forum architecture | Planned |
| Phase 3: Wallet / Paid Pin / Link Policy | Planned |
| Phase 4: Banner Management | Planned |
| SEO-OPS integration | Deferred |

These roadmap entries do not authorize automatic implementation. See [Phase 1 setup](docs/audit/PHASE1-SETUP.md), [feature matrix](docs/audit/PHASE1-FEATURE-MATRIX.md), [architecture audit](docs/audit/PHASE1-ARCHITECTURE.md), [blockers](docs/audit/PHASE1-BLOCKERS.md) and the [Phase 1.5 report](docs/audit/PHASE1.5-I18N-GIT-README.md) for evidence and limitations.
