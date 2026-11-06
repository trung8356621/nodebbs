# PBN — Final pre-VPS readiness audit

Date: 2026-11-06  
Scope: read-only audit of the working tree, plus one isolated production web build.  
Not done: source edits, database writes, restart of the dev servers on ports 3100/7100, VPS deploy, commit, push.

## How to read this report

| Label | Meaning |
|---|---|
| **THIS SESSION** | Measured now: source read, HTTP, or `SELECT`. |
| **SOURCE** | Code path read. Not executed end to end in this session. |
| **PRIOR REPORT** | Claim exists in `docs/audit/`. Not re-run here. Do not treat as a new pass. |
| **NOT TESTED** | No evidence in this session. |

Git `HEAD` is `86664ef` (`feat(pbn): add secure forum ingest API and searchable integration authors`). The working tree is dirty. The SSR hang fix and the SEO Active UI are in the working tree and are **not** in `86664ef`.

## Conclusion

**READY WITH CONDITIONS**

The code blockers from the first pass are fixed in the working tree and were rechecked. Nothing was committed. Deploying git `86664ef` is still wrong: that commit hangs topic SSR. Ship this working tree only after PO commits it.

Still open, and not changed in this pass: baseline ledger v6 vs manifest v7, no restore rehearsal, payment checkout gate vs `fixtureMode`, public Swagger, and one API process per forum.

## Remediation — 2026-11-06

No commit, push, migration, database write, or VPS deploy. The dev servers on ports 3100 and 7100 were not killed. A temporary Next standalone process on port 3199 was started from an isolated `.next-audit` build and then removed.

### What changed

| Blocker | Status in the working tree |
|---|---|
| P0-1 SSR hang in `86664ef` | Still uncommitted. The working tree keeps `getTopicData` on `request()` with no `React.cache()`. |
| P0-2 `trustProxy: false` | `trustProxyFromEnv()` trusts only `TRUSTED_PROXIES` (default `127.0.0.1,::1`). `true`, `*`, and `0.0.0.0/0` throw at startup. Cookie `Secure` uses `trustedProtocol()`, not Fastify's `request.protocol`, so an untrusted client cannot force HTTPS via `X-Forwarded-Proto`. |
| P0-3 default JWT | `assertRuntimeSecrets()` refuses a missing, short, or published secret in production, development, and test. `COOKIE_SECRET` may be omitted and then matches `JWT_SECRET`. Errors do not include the secret. |
| P1-1 soft 404 | Next proxy asks the API with the request cookie. API 404 rewrites to `/not-found-render`, which returns HTTP 404. API 5xx or a timeout stays on the topic page and is not turned into a 404. |

`TRUSTED_EDGE_PROXIES` is unset by default, so a browser cannot keep a forged `X-Forwarded-For`. Set it only for a same-host nginx that replaces that header with `$remote_addr`. In Docker, set `TRUSTED_PROXIES` to the web or nginx container address. Loopback alone does not see that container.

### Verification

| Check | Result |
|---|---|
| `node --test` runtime secrets | **PASS** 5 |
| `node --test` trusted proxy / spoofed `X-Forwarded-For` | **PASS** 5 |
| `node --test` proxy forwarded headers | **PASS** 3 |
| `forum-credit` unit tests | **PASS** 31 |
| `scripts/test-content-blacklist.mjs` | **PASS** 35 |
| `scripts/test-seo-links.mjs` | **PASS** |
| `scripts/test-topic-detail-visibility.mjs` | **PASS** 9 (source contract; live probe not set) |
| `next build --turbopack` | **PASS** exit 0 |
| Production SSR `/topic/201` | **PASS** HTTP 200 in 273ms, `ugc sponsored`, `data-seo-active` |
| Production SSR `/topic/199` | **PASS** HTTP 200, `ugc nofollow`, no SEO frame |
| Production SSR `/topic/99999999` | **PASS** HTTP 404 in 116ms |
| Production SSR topic 149 pending and 152 rejected | **PASS** HTTP 404, title text not in the HTML |
| Production SSR `/` and `/categories/general` | **PASS** HTTP 200 |
| API `GET /api/` on the existing process | **PASS** 200. That process was not restarted to load the new boot checks. |

### Not tested

- A live API 5xx during topic SSR. Source: the proxy rewrites only on HTTP 404; other failures fall through and the page rethrows.
- A logged-in author opening their own pending topic.
- nginx on a VPS. No production nginx file was edited.
- Docker image build, baseline migrate, and restore.

### Proposed commits (not created)

1. `fix(web): stop topic SSR hang and return HTTP 404 for hidden topics` — `apps/web/src/modules/forum/server.js`, `apps/web/src/lib/server/api.js`, `apps/web/src/app/(main)/topic/[id]/page.js`, `apps/web/src/proxy.js`, `apps/web/src/instrumentation.js`, `apps/web/src/instrumentation-node.js`, `apps/web/src/lib/proxy-forwarded-headers.js`, `scripts/test-topic-detail-visibility.mjs`.
2. `feat(web): show SEO active state on list and detail` — `SeoActiveMark.jsx`, `TopicCard.jsx`, `TopicHeader.jsx`, `TopicBody.jsx`, `TopicListContent.jsx`, `TopicContent.jsx`, `MarkdownRender/index.jsx`.
3. `feat(api): enforce content blacklist on write and approve` — `apps/api/src/services/policy/engine.js`, `service.js`, `apps/api/src/routes/policy/index.js`, dashboard policy/settings files, `ContentBlacklistSettings.jsx`, `scripts/test-content-blacklist.mjs`, `forum-ingest.test.js`.
4. `fix(api): trust only listed proxies and refuse default JWT secrets` — `apps/api/src/app.js`, `config/env.js`, `config/runtime-secrets.js`, `config/trusted-proxy.js`, their tests, `plugins/auth.js`, `forum-credit/crypto.js`, both `.env.example` files.
5. `docs: record pre-VPS readiness` — `docs/audit/PBN-PRE-VPS-READINESS-AUDIT.md`, `TOPIC-DETAIL-404-AFTER-MODERATION.md`, `CONTENT-BLACKLIST-REPORT.md`.

`apps/web/src/i18n/messages/*.json` and `namespaces.json` contain keys for both SEO Active and the blacklist UI. Split those keys before committing, or land them with the commit that needs them.

### Conditions still required before VPS

1. Commit the working tree. Do not deploy `86664ef`.
2. Inject `JWT_SECRET` of at least 32 private characters. Do not commit it.
3. Set `TRUSTED_PROXIES` to the real proxy address when the API is not reached via loopback. Set `TRUSTED_EDGE_PROXIES` only for a controlled nginx on the same host.
4. Set `COOKIE_SECURE=true` on the HTTPS site.
5. Reconcile baseline v6 vs v7 on a database copy before any migrate. Do not migrate `pbn_dev` blindly.
6. Run one restore into a new database name.
7. Leave payment flags unset. `fixtureMode` can still open an authenticated sandbox order without granting Credit.
8. Do not publish port 7100. Disable or stop proxying Swagger before a public launch.
9. Keep a single API process per forum.

## P0 — BLOCKER

### P0-1. Git HEAD still hangs topic SSR

1. **Mô tả.** `86664ef` still wraps topic SSR in `React.cache()` and `fetchData()`. That is the hang fixed earlier (`/topic/*` stalled until Cloudflare 524). The fix exists only as uncommitted edits.
2. **File.** `apps/web/src/modules/forum/server.js` → `getTopicData`. HEAD: `export const getTopicData = cache(async id => { return fetchData(...) })`. Working tree: `request()` with no `React.cache()`, 404 → `null`, other failures throw. Related: `apps/web/src/app/(main)/topic/[id]/page.js`, `apps/web/src/lib/server/api.js` (`AbortSignal`, 20s, `cache: 'no-store'`).
3. **Bằng chứng.** `git show HEAD:apps/web/src/modules/forum/server.js`. Working-tree production build (`next build --turbopack`, `output: 'standalone'`) then `node apps/web/server.js` on `127.0.0.1:3199` with `SERVER_API_URL=http://127.0.0.1:7100`:
   - `/topic/201` → **200** in 200ms, title of topic 201, `ugc sponsored`, `data-seo-active`.
   - `/` and `/categories/general` → **200**.
   - No SSR timeout on these routes. The temporary server was stopped after the check. Ports 3100 and 7100 were not restarted.
4. **Rủi ro.** `git pull` / image build from `86664ef` ships the hang. Topic HTML returns 0 bytes until the proxy times out (524).
5. **Hướng xử lý.** Ship the working-tree SSR patch in the revision that is built. Do not deploy `86664ef` as-is. This audit did not commit that patch.

### P0-2. `trustProxy` is hardcoded off

1. **Mô tả.** API always sets `trustProxy: false`. Comment in the same block says the opposite. Behind Next (`apps/web/src/proxy.js` rewrites `/api` to `SERVER_API_URL`) or nginx, every connection looks like the proxy.
2. **File.** `apps/api/src/app.js` (`trustProxy: false`). `apps/api/src/plugins/rateLimit.js` (`keyGenerator` uses `request.ip` unless a JWT user id is present). `apps/api/src/plugins/auth.js` `setAuthCookie` (`secure` follows `COOKIE_SECURE` or `request.protocol === 'https'`). `apps/api/src/config/env.js` (`COOKIE_SECURE` optional).
3. **Bằng chứng.** Source read. Local `.env` has `COOKIE_SECURE` unset and `HOST=127.0.0.1`. SSR allowlist is only `GET /api`, `GET /api/`, `GET /api/settings`. Topic SSR (`GET /api/topics/:id`) is not allowlisted. Default limit is 100 requests / 60s (`rate_limit_max_requests`).
4. **Rủi ro.** All anonymous users share `ip:127.0.0.1`. Topic SSR plus public reads can 429 the whole forum. `request()` throws on 429 and the topic page rethrows, so the failure mode is an error page, not a hang. Cookies will not get `Secure` when TLS ends at the proxy, because Fastify still sees HTTP.
5. **Hướng xử lý.** Trust only a known proxy hop, and key anonymous limits by the real client address. Set `COOKIE_SECURE=true` on HTTPS. Do not turn `trustProxy` on for the open internet without pinning the proxy. Until that lands, do not open the forum to public traffic.

### P0-3. Missing `JWT_SECRET` does not refuse to boot

1. **Mô tả.** If `JWT_SECRET` is unset, the API uses the literal `your-secret-key-change-this-in-production`. `FORUM_ID` mode requires a secret of at least 32 characters. Docker and PM2 do not set `FORUM_ID`, so that guard never runs.
2. **File.** `apps/api/src/config/env.js` (`jwtSecret` default). `apps/api/src/config/forum-runtime.js` (checks only when `FORUM_ID` is set). `apps/api/Dockerfile` `CMD ["node", "src/app.js"]` (no dotenvx, no `JWT_SECRET`). `apps/api/src/plugins/auth.js` signs with `env.security.jwtSecret`.
3. **Bằng chứng.** Source read. Local `apps/api/.env` has `JWT_SECRET` set (length 96) and `FORUM_ID` unset. The value was not printed. `.env` is gitignored; only `.env.example` is tracked, and its `JWT_SECRET` is empty.
4. **Rủi ro.** A container started from the Dockerfile without an env file forges and accepts tokens with a public secret. Cookie secret falls through to that same value (`COOKIE_SECRET` then `JWT_SECRET` then `cookie-secret-change-this`).
5. **Hướng xử lý.** Fail startup when `JWT_SECRET` or `COOKIE_SECRET` is missing or shorter than 32 characters, including when `FORUM_ID` is unset. On the VPS, inject both from a secret store. Do not rely on the example file.

## P1 — IMPORTANT

### P1-1. Missing and non-public topics return HTTP 200

1. **Mô tả.** The not-found screen renders quickly, but the status stays 200. A route that only calls `notFound()` does return 404.
2. **File.** `apps/web/src/app/(main)/topic/[id]/page.js` (`generateMetadata` returns a normal title when the topic is null, then the page calls `notFound()`). `apps/web/src/app/(main)/topic/[id]/not-found.js`. Contrast: `apps/web/src/app/not-found-render/page.js`.
3. **Bằng chứng.** **THIS SESSION**, production server on port 3199 and the same shape on dev port 3100:
   - `/topic/201` → 200, real title.
   - `/topic/99999999` → **200** in well under a second, title `Không tìm thấy chủ đề`. API `GET /api/topics/99999999` → **404** in ~30ms.
   - Topic 149 is `pending` in `pbn_dev` (read-only `SELECT`). Anonymous `GET /api/topics/149` → **404**. Page title is the not-found title. The pending title is not in the HTML.
   - Topic 152 is `rejected`. Anonymous API → **404**.
   - `GET /not-found-render` on dev → **404**.
4. **Rủi ro.** Crawlers index a soft 404. Monitoring that only checks status will show green. Content of pending/rejected topics was not public in this check. This is not the old hang.
5. **Hướng xử lý.** Call `notFound()` from `generateMetadata` when the topic is null, or otherwise commit the 404 before metadata returns 200. Re-check status on the production server.

### P1-2. Schema ledger is v6; manifest is v7

1. **Mô tả.** Baseline manifest current version is 7 and includes SQL `0005` through `0012`, each with a sha256. `pbn_dev` and `pbn_forum_c` ledgers stop at version 6. Payment and forum-network tables already exist on `pbn_dev`. `pbn_meta.forward_patches` on `pbn_dev` contains only `0012_forum_network.sql`.
2. **File.** `apps/api/baseline/manifest.json`. `scripts/forum.mjs` `migrate()` (applies any version missing from `pbn_meta.schema_versions` inside one transaction). `scripts/forum-network.mjs` `applyForwardPatches()` (skips when `max(version) >= 7`).
3. **Bằng chứng.** **THIS SESSION**, `SELECT` only. `pbn_dev` versions 1–6, `applied_at` from 2026-10-21 to 2026-10-22. `pbn_forum_c` versions 1–6. `to_regclass` found `pbn_payment_orders` and `forum_network_settings`. Checksums were not recomputed against the manifest JSON hash. **PRIOR REPORT** `PBN-FRESH-CHILD-E2E-REPORT.md` said child provisioning applied baseline v7. That does not match the ledger read today.
4. **Rủi ro.** The next `migrate()` on these databases will try to apply v7. `CREATE TABLE IF NOT EXISTS` may pass; other statements may abort the transaction. A failed migrate rolls back, but an operator can block provisioning or chase a false drift error. `pnpm db:migrate` is a second, divergent track: `apps/api/drizzle/` has 17 SQL files and `drizzle/meta/_journal.json` lists 5 entries.
5. **Hướng xử lý.** Do not run `migrate()` or `db:migrate` against `pbn_dev` until the ledger, catalog JSON, and live schema are diffed on a copy. Fresh children should keep using `scripts/forum.mjs`, not Drizzle Kit. Reconcile v7 as an explicit adoption step, on a copy first.

### P1-3. Default payment flags do not close checkout

1. **Mô tả.** `BANK_PAYMENT_ENABLED` defaults off and `mayGrantCredits` stays false. `BANK_PAYMENT_SANDBOX` defaults **on** when the master flag is off, and `fixtureMode` is true whenever sandbox is true. `createOrder` skips both the disabled check and the public-checkout check when `fixtureMode` is true.
2. **File.** `apps/api/src/extensions/bank-payment/config.js` `readEnvConfig`, `resolvePaymentConfig`. `services/orderService.js` `createOrder`. `services/reconcileEngine.js` `shouldGrantToLedger`. `routes/user.js` (auth required). `routes/webhook.js`.
3. **Bằng chứng.** **SOURCE.** Local `.env` leaves `BANK_PAYMENT_ENABLED`, `BANK_PAYMENT_PUBLIC`, `BANK_PAYMENT_SANDBOX`, and `BANK_PAYMENT_SANDBOX_GRANT` unset. Unauthenticated `POST /api/bank-payment/orders` → **401**. `orderService.js` does not call `ledger.grant`. Grant requires `mayGrantCredits`, which is `enabled && (!sandbox || sandboxGrant)`.
4. **Rủi ro.** A logged-in user can create a sandbox order while payment is “off”. A webhook can record a match without granting Credit. Grant happens if someone later sets `BANK_PAYMENT_ENABLED=true` and turns sandbox off, or sets `BANK_PAYMENT_SANDBOX_GRANT=true`. Admin `POST /api/ledger/admin/operation` can grant Credit with `dashboard.extensions`. That is an admin path, not a public bypass.
5. **Hướng xử lý.** Treat `fixtureMode` as insufficient to pass the public-checkout gate. Keep `BANK_PAYMENT_ENABLED` unset, `BANK_PAYMENT_PUBLIC` unset, and `BANK_PAYMENT_SANDBOX_GRANT` unset on the VPS. Do not put SePay live keys in the staging env.

### P1-4. Health checks do not prove the database

1. **Mô tả.** `GET /api/` returns `{ status: 'ok' }` and does not query Postgres or Redis. Docker API healthcheck uses that URL. Web healthcheck requests `/`, which can still render with empty fallbacks if the API is down.
2. **File.** `apps/api/src/routes/root.js`. `apps/api/Dockerfile` `HEALTHCHECK`. `apps/web/Dockerfile` `HEALTHCHECK`. `apps/api/src/plugins/redis.js` (ping failure is logged, not fatal).
3. **Bằng chứng.** **THIS SESSION:** `GET http://127.0.0.1:7100/api/` → 200 in ~20ms. **SOURCE** for what it checks.
4. **Rủi ro.** Orchestrator restarts only when the process dies. A dead database leaves the process “healthy”.
5. **Hướng xử lý.** Add a readiness route that checks `pool` and Redis with a short timeout, and point the healthcheck at it. Keep the public liveness URL separate if you do not want to expose dependency details.

### P1-5. OpenAPI is on the public origin

1. **Mô tả.** Swagger UI is registered with no production gate. Next proxies `/docs/json` to the API.
2. **File.** `apps/api/src/plugins/docs.js` (`routePrefix: '/docs'`). `apps/web/src/proxy.js`.
3. **Bằng chứng.** **THIS SESSION:** `GET http://127.0.0.1:7100/docs` → 200. `GET http://127.0.0.1:3100/docs/json` → 200.
4. **Rủi ro.** The public site publishes the API surface. Swagger UI is reachable if port 7100 is published (`Dockerfile` sets `HOST=0.0.0.0`).
5. **Hướng xử lý.** Disable Swagger when `NODE_ENV=production`, or do not proxy `/docs/json`. Bind the API to loopback and proxy only `/api` and `/uploads`.

### P1-6. Two schedulers, no leader lock

1. **Mô tả.** Pin expiry, SEO expiry, cleanup, policy scan, and ledger sync are `setInterval` inside the API process. There is no cluster leader lock. PM2 is configured with `instances: 1`.
2. **File.** `apps/api/src/plugins/cleanup.js` (2h). `apps/api/src/modules/forum/index.js` (pin/SEO every 60s, also the 2h cleanup task). `apps/api/src/plugins/policy.js` (scan about every 5s, in-process `scanning` flag). `pinService.js` `expire()` and SEO `expire()` use `FOR UPDATE SKIP LOCKED`. `apps/api/ecosystem.config.cjs`.
3. **Bằng chứng.** **SOURCE.** Expire paths do not call `ledger.grant`. Pin/SEO purchase idempotency is a unique `(user_id, idempotency_key)` plus an advisory lock. Bank webhooks dedupe on `(provider, provider_event_id)`.
4. **Rủi ro.** A second API process duplicates timers. Row locks make pin/SEO expire safe. Ledger sync outbox has no `SKIP LOCKED` (**SOURCE**), so two processes can push the same OPS batch. Activity rewards use a lookup, not a unique constraint.
5. **Hướng xử lý.** Keep one API process per forum. Do not switch PM2 to `instances: 'max'` until jobs have a lock. Do not “fix” expiry by editing live entitlements.

### P1-7. Backup tool exists; this audit did not restore

1. **Mô tả.** `scripts/forum-portable.mjs` can `pg_dump` (custom format, repeatable-read snapshot) and copy uploads, with sha256 checks. Restore refuses `database === 'pbn_dev'`, requires an empty upload dir, and creates a new database. There is no cron, no Docker volume, and no compose file.
2. **File.** `scripts/forum-portable.mjs` `exportForum`, `restoreForum`. `apps/api/Dockerfile` creates `/app/apps/api/uploads` and has no `VOLUME`.
3. **Bằng chứng.** **SOURCE.** **NOT TESTED** this session: no export, no restore. Local Postgres has many leftover `pbn_*` databases from older drills (`SELECT datname`). Those names are not a fresh restore proof.
4. **Rủi ro.** A container recreate without a mounted upload dir deletes media. A VPS disk failure without a tested dump loses the forum. Restoring onto `pbn_dev` is blocked by the script; a hand-run `pg_restore` is not.
5. **Hướng xử lý.** Before real users: mount a persistent upload directory, run `export` to a disk that is not the database disk, and restore into a **new** database name. Plan only — do not run it against `pbn_dev`.

### P1-8. Forum isolation is per process, and this process is not pinned

1. **Mô tả.** One process, one `DATABASE_URL`, optional Redis prefix, JWT `iss`/`aud` of `pbn:${FORUM_ID}`. Nothing in the core tables is a shared `tenant_id`. The guard runs only when `FORUM_ID` is set.
2. **File.** `apps/api/src/config/forum-runtime.js`. `scripts/forum.mjs` `runtime()` (separate ports, database name, `UPLOAD_ROOT`, cookie name). `apps/api/src/db/index.js`.
3. **Bằng chứng.** **SOURCE.** **THIS SESSION:** running API env has `FORUM_ID` unset. Databases `pbn_dev`, `pbn_forum_b`, `pbn_forum_c`, `pbn_forum_p` all exist. No request was sent across forums.
4. **Rủi ro.** Starting a second forum with the first forum’s `DATABASE_URL`, or omitting `FORUM_ID`, mixes data. The code will not stop that unless `FORUM_ID` is set and the database name matches.
5. **Hướng xử lý.** Start each forum only through `scripts/forum.mjs` (or an equivalent unit file that sets the same variables). One Postgres role per database. Do not point two app units at `pbn_dev`.

## P2 — LATER

### P2-1. `next/image` allows every host

`apps/web/next.config.mjs` `images.remotePatterns` uses `hostname: "**"` for http and https. A user-controlled image URL can make the image optimizer fetch arbitrary hosts. Restrict hosts before relying on `next/image` for user content.

### P2-2. Sitemap and robots log a dynamic-server error during build

`next build` exited 0. While collecting page data it logged `Dynamic server usage` for `/sitemap.xml` and `/robots.txt` because they read cookies. The route table still marks both as dynamic (`ƒ`). Noisy, not a failed build.

### P2-3. PM2 web config does not use the standalone server

`apps/web/ecosystem.config.cjs` runs `next start`. The Dockerfile runs `apps/web/server.js` from the standalone trace. Pick one path in the unit file so static files and `node_modules` match that path.

### P2-4. Local Postgres is crowded with drill databases

Dozens of `pbn_phase*` / `pbn_seo_test*` databases are still on this machine. They are not the VPS. Drop them only under a separate cleanup task. This audit did not drop anything.

### P2-5. JWT access token example is one year

`apps/api/.env.example` sets `JWT_ACCESS_TOKEN_EXPIRES_IN=1y`. Code default is `7d`. Shorten the production lifetime when rotating secrets.

## PASS — verified this session or directly in source

| Item | Evidence |
|---|---|
| Working-tree production web build | `next build --turbopack` exit 0 in ~29s. Routes `/`, `/categories/[id]`, `/topic/[id]` are dynamic. Standalone `server.js` started. |
| Production SSR, topic 201 | Port 3199, **200** in 200ms. No timeout. |
| Production SSR, home and category | Port 3199, **200**. |
| API liveness | `GET /api/` **200**. This does not prove Postgres. See P1-4. |
| API missing topic | `GET /api/topics/99999999` **404** ~30ms. |
| Pending/rejected not public | API 404 for 149 and 152. HTML does not contain the pending title. Status is still 200 (P1-1). |
| Required DB URL | `getRequiredEnv('DATABASE_URL')` throws before listen. |
| Local secret is set | `JWT_SECRET` length 96. `FORUM_ID` unset, so the short-secret guard is off (P0-3). |
| `.env` not in git | `git ls-files` shows only `apps/api/.env.example` and `apps/web/.env.example`. |
| Public topic read | `GET /topics` and `GET /topics/:id` use `optionalAuth`. Anonymous read of approved topics is intentional. |
| Topic 201 SEO | API `linkPolicy=paid`, `isPinned=false`, `approvalStatus=approved`. Production HTML has `ugc sponsored` and `data-seo-active`, not `ugc nofollow`. |
| Topic 199 ordinary | API `linkPolicy=ugc`, `isPinned=false`. Production HTML has `ugc nofollow`, no `data-seo-active`. |
| Link policy source | `contentLinkRel` in `apps/web/src/lib/content-link-policy.js`. API `effectiveLinkPolicy` in `pinService.js`. `paid`/`sponsored` → `ugc sponsored`; otherwise external links → `ugc nofollow`. |
| SEO/pin expiry does not grant Credit | `expire()` updates status only. Read model still requires `expires_at > statement_timestamp()`. |
| Payment grant default off | `mayGrantCredits` false while the master flag is unset. |
| Unauthenticated checkout | `POST /api/bank-payment/orders` → 401. |
| Blacklist on write and on approve | **SOURCE.** `policy.js` preHandler returns 422 `POLICY_BLOCKED`. `PolicyService.approval` re-inspects and throws 422 on `BLOCK`, including moderation approve. Ingest `POST /api/integrations/topics` is in the same hook. |
| Single-forum DB model | Separate databases exist. No shared tenant row in core. |

## NOT TESTED

| Item | Why |
|---|---|
| Docker image build | Not run. Web production path was `next build` + `node server.js` on the host. |
| API compile | There is no API build step. `node src/app.js` is the process. Startup of a second API was not attempted. |
| Deploy of git `86664ef` | Refused. That commit still contains the hang. |
| `next start` via PM2 | Not run. |
| Restore rehearsal | Script read only. Would need a new database name and an empty upload dir. Not executed. |
| Backup cron on a VPS | No VPS access. No cron in the repo. |
| Expired or revoked SEO losing `paid` | Would require changing entitlement rows. Not done. **SOURCE** says read-time `seoActive` drops when `expires_at` passes or status is not `active`. **PRIOR REPORT** covers earlier fixtures; not re-run. |
| Pin-only and SEO+pin together | No pinned topic was created. Topic 201 shows the two flags can differ (`isPinned false`, `linkPolicy paid`). |
| Free Mode expiry job | **SOURCE:** no timer. `isFreeMode()` is read-time. Not executed. |
| Blacklist 35-test file | **PRIOR REPORT** `CONTENT-BLACKLIST-REPORT.md`. Not re-run. |
| Fresh child provisioning | **PRIOR REPORT** only. Live `pbn_forum_c` ledger is v6, which disagrees with that report’s “v7” line. |
| Wallet, moderation, ingest, parent/child E2E | **PRIOR REPORT** only. |
| SePay live payment | Not performed. |
| Cross-forum request | Not sent. |

## Production build notes

Command, from `apps/web`, with `FORUM_NEXT_DIST=.next-audit` so the running dev server’s `.next` was not replaced:

`pnpm exec next build --turbopack` → exit 0.

An earlier attempt with an absolute `distDir` outside the app failed (`ENOENT`, path joined twice) and the resulting standalone tree could not load `next/dist/build/adapter/setup-node-env.external.js`. That failure is from the audit path, not from `distDir: '.next'`. The in-app dist produced a working `apps/web/server.js`.

The standalone process and the `.next-audit` directory were removed after the HTTP checks. Dev servers were left running.

`allowedDevOrigins` in `next.config.mjs` applies to `next dev`. It is not evidence for production hydration.

## VPS configuration (proposal only)

Nothing here was installed.

| Piece | Recommendation |
|---|---|
| TLS | Caddy or nginx on 443. Redirect HTTP to HTTPS. |
| Web | One systemd/PM2 unit per forum. `NODE_ENV=production`. Prefer the standalone `server.js`, and copy `.next/static` plus `public` the way `apps/web/Dockerfile` does. `HOSTNAME=127.0.0.1`. |
| API | One unit per forum, `instances: 1`. `HOST=127.0.0.1`. Do not publish 7100. `SERVER_API_URL=http://127.0.0.1:<apiPort>` on the web unit. |
| Env | `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `COOKIE_SECRET` (≥32), `COOKIE_SECURE=true`, `FORUM_ID`, `FORUM_DATABASE_NAME`, `REDIS_KEY_PREFIX=pbn:<id>:`, absolute `UPLOAD_ROOT`, `AUTH_COOKIE_NAME=pbn_<id>_auth`, `FORUM_ALLOWED_HOSTS`, `FORUM_WEB_ORIGIN`, `FORUM_PUBLIC_ORIGIN`, `CORS_ORIGIN` set to that origin only. Payment flags unset. |
| Postgres | Local socket or `127.0.0.1` only. One database and one role per forum. |
| Redis | `127.0.0.1` only, with the forum key prefix. Require it for any forum started with `FORUM_ID`. |
| Disk | Persistent directory for `UPLOAD_ROOT`. Separate disk or off-host copy for dumps. |
| Backup | Daily `node scripts/forum-portable.mjs export <forum.json> <dir>` while the unit is stopped, or a `pg_dump` plus a consistent media copy. Monthly restore into a new database name. |
| Logs | Journald or PM2 log rotate. Do not log `Authorization` or webhook bodies. |
| Health | After P1-4, probe readiness. Restart the unit on failure. `Restart=on-failure`, start limit so a bad env does not loop forever. |
| Monitor | Disk and memory alerts. Node 22. Watch anonymous 429s until P0-2 is fixed. |
| Schema | Do not run `db:migrate` or baseline `migrate()` on the live database until P1-2 is reconciled on a copy. |

## Deploy gate

Do not deploy until:

1. The topic SSR patch is in the revision that is built (it is not in `86664ef`).
2. `trustProxy` / client IP / `COOKIE_SECURE` is fixed, or the forum stays on a private network with a documented rate-limit ceiling.
3. Production env has long `JWT_SECRET` and `COOKIE_SECRET`, and startup fails closed without them.
4. Baseline v6 vs v7 is understood on a copy before any migrate.
5. A restore into a new database has been done once.
6. Payment env stays at the defaults above.

After those, the remaining label is **READY WITH CONDITIONS**, not an open public launch. Public checkout, a second API instance, and Swagger stay off.
