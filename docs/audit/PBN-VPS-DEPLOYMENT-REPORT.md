# SEO-PBN-SYSTEM — VPS Deployment & Verification Report

**Date:** 2026-11-08 (Asia/Ho_Chi_Minh)  
**Target Domain:** `https://cholinktonghop.com`  
**VPS Host:** `221.132.16.15` (Ubuntu 24.04.3 LTS, Kernel `6.8.0-71-generic`, x86_64)  
**Management Plane:** aaPanel (`Website -> Sites`, `siteId = 2`, `cholinktonghop.com`) + Isolated Docker Compose (`pbn-cholinktonghop`)  
**Launch Mode:** Free Launch Mode (`free_mode.enabled = true`, `expiresAt = 2027-01-08T04:29:20.485Z`)  
**Final Verdict:** **DEPLOYED — VERIFIED**

---

## 1. Deployed Git SHA & Source Verification

| Field | Value |
|---|---|
| Repository | `https://github.com/trung8356621/nodebbs` |
| Branch | `chore/pbn-phase1-5-i18n` |
| Deployed Git SHA | `6816ca55c03c787de16e914d3c626dde23d31e1c` |
| Commit Title | `fix(pbn): resolve pre-VPS blockers and finalize forum readiness` |
| Image Build Strategy | Built locally from clean `6816ca5` tree (`pbn-api:6816ca5`, `pbn-web:6816ca5`) and transferred to VPS via `docker save` / `docker load` (zero Next.js build load on VPS RAM) |

### Pre-Deploy Code & Unit Verification (`6816ca5`)

| Verification Check | Result |
|---|---|
| SSR hang fix (`getTopicData` uses `request()` without `React.cache()`) | **VERIFIED** |
| Soft 404 fix (`proxy.js` -> `/not-found-render` + `generateMetadata` `notFound()`) | **VERIFIED** |
| Trusted Proxy security (`trustProxyFromEnv()`, `trustedProtocol()`, `TRUSTED_EDGE_PROXIES`) | **PASS (13/13 unit tests)** |
| JWT & Cookie secret fail-closed validation (`assertRuntimeSecrets()`) | **PASS** |
| Content Blacklist (`BLOCK` / `REVIEW` on write & approve) | **PASS (35/35 assertions)** |
| SEO Active UI (`SeoActiveFrame`, `SeoActiveBadge`, `contentLinkRel`) | **PASS** |
| Topic detail visibility & SSR contract (`scripts/test-topic-detail-visibility.mjs`) | **PASS (9/9 assertions)** |

---

## 2. VPS Deployment Architecture & aaPanel Integration

```
Public Internet
   │  HTTPS (TLS 1.3 / HTTP/2)
   ▼
Cloudflare Edge Proxy (cholinktonghop.com)
   │  HTTPS to Origin 221.132.16.15:443
   ▼
Host Nginx (managed by aaPanel Website #2: cholinktonghop.com)
   ├─ SSL: Let's Encrypt (/www/server/panel/vhost/cert/cholinktonghop.com/fullchain.pem)
   ├─ Running Directory: /www/wwwroot/cholinktonghop.com/public (isolates repo/secrets/backups)
   ├─ Cloudflare Real IP: scoped in proxy/cholinktonghop.com/*.conf (CF-Connecting-IP -> X-Forwarded-For)
   ├─ Security Blocks: 404 on /docs, /repo, /backups, /secrets, /data, /docker-compose.yml, /.env, /.git
   └─ Reverse Proxy: http://127.0.0.1:3100
         │
         ▼
Docker Bridge Network: pbn-cholinktonghop_default (172.29.88.0/24, gateway 172.29.88.1)
   ├─ pbn-cholink-web      (172.29.88.13, host 127.0.0.1:3100->3100)  Next.js 16 Standalone
   ├─ pbn-cholink-api      (172.29.88.12, host 127.0.0.1:7100->7100)  Fastify 5 ESM Runtime
   ├─ pbn-cholink-postgres (172.29.88.10, host 127.0.0.1:5434->5432)  PostgreSQL 16.13 Alpine
   └─ pbn-cholink-redis    (172.29.88.11, internal 6379/tcp)          Redis 7.4.8 Alpine
```

### Directory Layout on VPS (`/www/wwwroot/cholinktonghop.com`)

| Path | Mode / Owner | Purpose |
|---|---|---|
| `/www/wwwroot/cholinktonghop.com/public` | `0755 www:www` | aaPanel webroot (`root` in Nginx vhost) — only `.well-known` ACME challenge lives here |
| `/www/wwwroot/cholinktonghop.com/docker-compose.yml` | `0600 root:root` | Isolated Docker Compose stack definition (`pbn-cholinktonghop`) |
| `/www/wwwroot/cholinktonghop.com/.env` | `0600 root:root` | Runtime secrets & DB credentials (never exposed over HTTP) |
| `/www/wwwroot/cholinktonghop.com/repo` | `0700 root:root` | Provisioning/migration scripts & baseline SQL (`6816ca5`) |
| `/www/wwwroot/cholinktonghop.com/data/uploads` | `0755 1001:1001` | Persistent uploaded media mounted at `/app/apps/api/uploads` |
| `/www/wwwroot/cholinktonghop.com/backups` | `0700 root:root` | Database dumps (`pg_dump -Fc`), media archives, and `SHA256SUMS` |
| `/www/wwwroot/cholinktonghop.com/secrets` | `0700 root:root` | Operator handoff metadata (`admin.json`, mode `0600`) |

---

## 3. Services, Containers, Ports & Domains

### PBN Containers (`pbn-cholinktonghop`)

| Container Name | Image | Internal IP | Host Port Binding | Restart Policy | Status |
|---|---|---|---|---|---|
| `pbn-cholink-web` | `pbn-web:6816ca5` | `172.29.88.13` | `127.0.0.1:3100->3100/tcp` | `unless-stopped` | `Up (healthy)` |
| `pbn-cholink-api` | `pbn-api:6816ca5` | `172.29.88.12` | `127.0.0.1:7100->7100/tcp` | `unless-stopped` | `Up (healthy)` |
| `pbn-cholink-postgres` | `postgres:16-alpine` | `172.29.88.10` | `127.0.0.1:5434->5432/tcp` | `unless-stopped` | `Up (healthy)` |
| `pbn-cholink-redis` | `redis:7-alpine` | `172.29.88.11` | Internal `6379/tcp` only | `unless-stopped` | `Up (healthy)` |

*Note:* Static IPv4 addresses and `extra_hosts` mappings (`pbn-postgres`, `pbn-redis`, `pbn-api`, `pbn-web`) are configured inside `docker-compose.yml` so Alpine `musl` libc resolves internal container hostnames directly via `/etc/hosts` without external UDP DNS latency.

### Existing Production Containers (Preserved & Untouched)

| Container Name | Image | Host Port Binding | Status |
|---|---|---|---|
| `ops-server-app` | `ops-server-app` | `127.0.0.1:3002->3000/tcp` | `Up 11 hours (healthy)` |
| `seo-ops-semantic-semantic-api-1` | `seo-ops-semantic-semantic-api` | `127.0.0.1:8088->8088/tcp` | `Up (healthy)` |
| `seo-ops-semantic-semantic-worker-1` | `seo-ops-semantic-semantic-worker` | Internal `8088/tcp` | `Up` |
| `seo-ops-semantic-postgres-1` | `pgvector/pgvector:0.8.0-pg16` | `127.0.0.1:5433->5432/tcp` | `Up 11 hours (healthy)` |

### Domains & Vhosts

| Domain | aaPanel Site / Config | Upstream / Root | Status |
|---|---|---|---|
| `https://cholinktonghop.com` | aaPanel Site #2 (`cholinktonghop.com.conf`) | Reverse proxy -> `http://127.0.0.1:3100` | **HTTP/2 200** |
| `https://ops.seo-ops.duckdns.org` | `/www/server/panel/vhost/nginx/ops-server.conf` | Reverse proxy -> `http://127.0.0.1:3002` | **HTTP/2 200** (unchanged) |
| `http://seo-ops.duckdns.org` | aaPanel Site #1 (`221.132.16.15.conf`) | `/www/wwwroot/seo-ops-client/public` | **Unchanged** |

*Note on `www.cholinktonghop.com`:* Per Phase B instructions, `www.cholinktonghop.com` is not yet configured in Cloudflare DNS and was intentionally omitted; it can be added in aaPanel Domain Manager once the DNS record is created.

---

## 4. Persistent Volumes & Storage

| Volume / Bind Mount | Backing Path | Purpose |
|---|---|---|
| `pbn_cholink_postgres_data` | `/var/lib/docker/volumes/pbn_cholink_postgres_data/_data` | PostgreSQL 16 cluster storage (`pbn_forum_cholink`) |
| `pbn_cholink_redis_data` | `/var/lib/docker/volumes/pbn_cholink_redis_data/_data` | Redis 7 AOF persistence (`--appendonly yes`, `128mb` cap) |
| Host bind mount | `/www/wwwroot/cholinktonghop.com/data/uploads` -> `/app/apps/api/uploads` | Persistent uploaded media (`topics`, `avatars`, `assets`, etc.) |

---

## 5. Database Version & Baseline Migration Ledger

- **Engine:** `PostgreSQL 16.13 on x86_64-pc-linux-musl`
- **Database Name:** `pbn_forum_cholink` (isolated role `pbn_cholink`)
- **Provisioning Mechanism:** Official `scripts/forum.mjs` (`migrate` -> `seed` -> `admin` -> Free Launch commercial settings)
- **Schema Ledger (`pbn_meta.schema_versions`):** All **7** baseline versions (`v1` through `v7`) applied and checksum-verified against `apps/api/baseline/manifest.json` and `apps/api/baseline/catalog-v7.json`:

| Version | Checksum (`sha256`) | Files Included |
|---|---|---|
| `1` | `4c99b18f8e7d6c6b17218733eb583c92df569bc46b9aa925f9de7a645a9a7d6c` | `0000_simple_guardsmen.sql`, `extra.sql` |
| `2` | `759346aabbd3cf8aca8f4c2d3f9c8ab396e3b636c23e842dbb9274c199e50636` | `0001_keen_bulldozer.sql` |
| `3` | `635dfe3b3a46fd97228164d45b391cfd53a2fcabae2f2718f0535da99df43217` | `0002_right_malice.sql` |
| `4` | `00532a40d15ec5c22520579f77a982807af2aa8bd99726187c234c3f9c8b5b67` | `0003_pin_currency.sql` |
| `5` | `e0ff373bd2b3d4d9b366e142d4d43afd017bad861f746ef5f75eeee9d7c27918` | `0003_big_emma_frost.sql` |
| `6` | `0d7adc5a0b98c1126711e77701aab79ee347bffadc4f0641f0ca4078cf39fc72` | `0004_zippy_randall_flagg.sql` |
| `7` | `8815e91ed9e52718e1d91a05ac06ebc948786cc6038995af42d606ea60e7acce` | `0005_forum_credit.sql` .. `0012_forum_network.sql` |

---

## 6. Environment Variable Names (Values Omitted)

### `/www/wwwroot/cholinktonghop.com/.env` (`0600`)
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `COOKIE_SECRET`

### `pbn-cholink-api` Environment Names
- `NODE_ENV`
- `HOST`
- `PORT`
- `FORUM_ID`
- `FORUM_DATABASE_NAME`
- `DATABASE_URL`
- `DB_POOL_MAX`
- `REDIS_URL`
- `REDIS_KEY_PREFIX`
- `UPLOAD_ROOT`
- `JWT_SECRET`
- `COOKIE_SECRET`
- `AUTH_COOKIE_NAME`
- `COOKIE_SECURE`
- `COOKIE_SAMESITE`
- `FORUM_DEFAULT_LOCALE`
- `FORUM_PUBLIC_ORIGIN`
- `FORUM_WEB_ORIGIN`
- `CORS_ORIGIN`
- `FORUM_ALLOWED_HOSTS`
- `TRUSTED_PROXIES`
- `BANK_PAYMENT_ENABLED`
- `BANK_PAYMENT_PUBLIC`
- `BANK_PAYMENT_SANDBOX`
- `BANK_PAYMENT_SANDBOX_GRANT`

### `pbn-cholink-web` Environment Names
- `NODE_ENV`
- `HOSTNAME`
- `PORT`
- `SERVER_API_URL`
- `FORUM_DEFAULT_LOCALE`
- `NEXT_PUBLIC_FORUM_DEFAULT_LOCALE`
- `NEXT_PUBLIC_FORUM_LOCALE_COOKIE`
- `FORUM_PUBLIC_ORIGIN`
- `FORUM_ALLOWED_HOSTS`
- `TRUSTED_EDGE_PROXIES`

---

## 7. HTTPS, Cloudflare & Security Hardening Status

- **Origin SSL Certificate:** Let's Encrypt certificate issued and configured in aaPanel for `cholinktonghop.com` (`/www/server/panel/vhost/cert/cholinktonghop.com/fullchain.pem`, valid until `2027-02-06`).
- **HTTPS Force Redirect:** Enabled in aaPanel (`HTTP_TO_HTTPS`), protocols `TLSv1.2 TLSv1.3`.
- **Cloudflare Proxy:** Active (`HTTP/2 200` over `https://cholinktonghop.com`).
- **Cloudflare Real IP Unwrapping:** Configured strictly inside `/www/server/panel/vhost/nginx/proxy/cholinktonghop.com/18d6bdae1a6fb65876803b3d0c1e05d5_cholinktonghop.com.conf` (`set_real_ip_from` for Cloudflare IPv4/IPv6 ranges + `real_ip_header CF-Connecting-IP`). Global `/www/server/nginx/conf/nginx.conf` was not modified.
- **Public Exposure Protection (Verified HTTP 404 over HTTPS):**
  - `https://cholinktonghop.com/.env` -> `404`
  - `https://cholinktonghop.com/.git/config` -> `404`
  - `https://cholinktonghop.com/docker-compose.yml` -> `404`
  - `https://cholinktonghop.com/repo/package.json` -> `404`
  - `https://cholinktonghop.com/backups` -> `404`
  - `https://cholinktonghop.com/secrets/admin.json` -> `404`
  - `https://cholinktonghop.com/docs` & `/docs/json` (Swagger/OpenAPI) -> `404`

---

## 8. Health Check & VPS Resource Telemetry

### Container Health Checks

| Container / Service | Health Check Probe | Status |
|---|---|---|
| `pbn-cholink-postgres` | `pg_isready -U $POSTGRES_USER -d $POSTGRES_DB` | `healthy` |
| `pbn-cholink-redis` | `redis-cli ping` | `healthy` |
| `pbn-cholink-api` | `GET http://127.0.0.1:7100/api/` -> `200` | `healthy` |
| `pbn-cholink-web` | `GET http://127.0.0.1:3100/` -> `200` | `healthy` |
| `ops-server-app` | `GET http://127.0.0.1:3002/api/health` & `https://ops.seo-ops.duckdns.org/api/health` -> `200` | `healthy` |
| `seo-ops-semantic-semantic-api-1` | `GET http://127.0.0.1:8088/health/live` -> `200` | `healthy` |

### Actual VPS Resource Usage Post-Deployment

- **System RAM (`free -h`):**
  - Total: `3.8 GiB` | Used: `1.9 GiB` | Free: `1.1 GiB` | Buff/Cache: `861 MiB` | **Available: `1.6 GiB`**
  - Swap: Total `2.0 GiB` | Used `648 MiB` | Free `1.4 GiB`
- **Disk (`df -h /`):**
  - Total: `39 GiB` | Used: `21 GiB` (`53%`) | **Available: `19 GiB`**
- **Per-Container Memory Usage (`docker stats --no-stream`):**
  - `pbn-cholink-web`: `127.2 MiB` (`3.25%`)
  - `pbn-cholink-api`: `233.4 MiB` (`5.97%`)
  - `pbn-cholink-postgres`: `62.58 MiB` (`1.60%`)
  - `pbn-cholink-redis`: `9.77 MiB` (`0.25%`)
  - **Total PBN Stack RAM:** `~433 MiB` (well within the `550–700 MiB` budget estimate)

---

## 9. Post-Deployment HTTPS E2E Verification Results

All 15 required verification checks were executed against `https://cholinktonghop.com`:

| # | Check | Status | Measured Evidence |
|---|---|---|---|
| 1 | Home page HTTP 200 | **PASS** | `GET https://cholinktonghop.com/` -> `HTTP 200` (`245 ms`, `195,612 bytes`) |
| 2 | Category page HTTP 200 | **PASS** | `GET https://cholinktonghop.com/categories/general` -> `HTTP 200` (`307 ms`) |
| 3 | Approved topic HTTP 200 | **PASS** | `GET https://cholinktonghop.com/topic/21` -> `HTTP 200` (`316 ms`, no SSR hang) |
| 4 | Nonexistent topic HTTP 404 | **PASS** | `GET https://cholinktonghop.com/topic/99999999` -> real `HTTP 404` (`182 ms`); `GET /api/topics/99999999` -> `404` |
| 5 | Pending/rejected topic not publicly visible | **PASS** | Pending topic `#22` (before approval) & rejected topic `#23` return real `HTTP 404` on both `/api/topics/:id` and `/topic/:id`; secret titles absent from HTML |
| 6 | Admin login/logout | **PASS** | `POST /api/auth/login` as `forum_cholink_admin` -> `200`, sets `pbn_forum_cholink_auth` with `Secure; HttpOnly; SameSite=Lax`; `GET /api/auth/me` -> `role=admin`; `POST /api/auth/logout` -> `200`; regular user denied `/api/ledger/reward-rules` (`403`) |
| 7 | Topic creation and moderation | **PASS** | Created pending topics `#22` and `#23`; `POST /api/moderation/approve/topic/22` -> `200` and `/topic/22` becomes `HTTP 200`; `POST /api/moderation/reject/topic/23` -> `200` and `/topic/23` stays `HTTP 404` |
| 8 | Content Blacklist `BLOCK` / `REVIEW` | **PASS** | Created `BLOCK` domain rule & `REVIEW` keyword rule via `POST /api/policy/rules`; `POST /api/topics` with blocked subdomain returned `HTTP 422` (`code: "POLICY_BLOCKED"`); `POST /api/topics` with review keyword forced topic `#24` into `approvalStatus: "pending"` (`HTTP 404` to anonymous visitors); test rules cleaned up via `DELETE /api/policy/rules/:id` |
| 9 | Normal link `ugc nofollow` | **PASS** | Approved topic `#21` (`https://cholinktonghop.com/topic/21`) renders external link `https://example.org/normal-ugc-test` with `rel="noopener noreferrer ugc nofollow"` and no `data-seo-active` |
| 10 | SEO Active link `ugc sponsored` | **PASS** | SEO Active topic `#25` (`https://cholinktonghop.com/topic/25`, `linkPolicy: "paid"`, Free Mode `0` Credit) renders `<a href="https://example.com/seo-sponsored-target" target="_blank" rel="noopener noreferrer ugc sponsored">` (no `nofollow`) |
| 11 | SEO Active badge and gradient | **PASS** | Both `https://cholinktonghop.com/topic/25` (detail) and `https://cholinktonghop.com/` (home list) render `data-seo-active="true"`, `data-seo-badge="true"`, and rainbow border gradient (`linear-gradient(90deg,#ef4444...)`) |
| 12 | Free Mode and Credit behavior | **PASS** | `GET /api/pins/products` & `/api/seo/products` report `authority: "forum-free-mode"`, price `0`; `POST /api/pins/topics/25/purchase` activated 24h Paid Pin at `price: "0"`, `pricing_authority: "forum-free-mode"`, `0` Credit deducted; daily check-in (`POST /api/ledger/activity/check-in`) increased balance `2 -> 3` Credit and same-day retry remained `3` Credit (idempotent); `GET /api/bank-payment/status` confirmed `enabled: false, publicCheckout: false, sandbox: true, mayGrantCredits: false`; anonymous `POST /api/bank-payment/orders` rejected with `401` |
| 13 | Upload/media delivery | **PASS** | `POST https://cholinktonghop.com/api/upload?category=topics` -> `200`, stored `/uploads/topics/799064aa-1e24-435b-a8bf-a49725276925.png` on host volume `/www/wwwroot/cholinktonghop.com/data/uploads/topics/799064aa-1e24-435b-a8bf-a49725276925.png`; `GET https://cholinktonghop.com/uploads/topics/799064aa-1e24-435b-a8bf-a49725276925.png` -> `HTTP 200` (`image/png`) |
| 14 | Restart and health recovery | **PASS** | `docker compose restart pbn-api pbn-web` -> all 4 containers returned to `healthy` within ~8s; `https://cholinktonghop.com/`, `/topic/25`, and `/uploads/topics/799064aa-1e24-435b-a8bf-a49725276925.png` all returned `HTTP 200` immediately after restart |
| 15 | OPS-SERVER & existing services unchanged | **PASS** | `ops-server-app` (`http://127.0.0.1:3002/api/health` -> `200`, `https://ops.seo-ops.duckdns.org/api/health` -> `200`) and `seo-ops-semantic` (`http://127.0.0.1:8088/health/live` -> `200`) remained continuously healthy with zero restarts or config modifications |

---

## 10. Backup & Recovery Procedure

### Stored Backups on VPS (`/www/wwwroot/cholinktonghop.com/backups/`)

1. **`initial-baseline-v7/`**: Clean post-provisioning snapshot (`forum.dump`, `324 KB`) before E2E fixtures.
   - **Restore Rehearsal Completed:** Restored into temporary database `pbn_cholink_restore_rehearsal` via `pg_restore`, verified all 271 constraints, tables, sequences, row hashes, and `pbn_meta.schema_versions` (v1–v7), then dropped the rehearsal database.
2. **`post-e2e-verified/`**: Post-verification snapshot (`forum.dump` `334 KB`, `uploads.tar.gz` `341 B`, `SHA256SUMS` `274 B`, mode `0600`).

### Backup Command

```bash
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP_DIR="/www/wwwroot/cholinktonghop.com/backups/${STAMP}"
mkdir -p "$BACKUP_DIR" && chmod 700 "$BACKUP_DIR"
docker exec pbn-cholink-postgres sh -c 'pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "$BACKUP_DIR/forum.dump"
tar -czf "$BACKUP_DIR/uploads.tar.gz" -C /www/wwwroot/cholinktonghop.com/data uploads
sha256sum "$BACKUP_DIR/forum.dump" "$BACKUP_DIR/uploads.tar.gz" > "$BACKUP_DIR/SHA256SUMS"
chmod 600 "$BACKUP_DIR"/*
```

### Restore Procedure (Into a New Isolated Database Before Cutover)

```bash
# 1. Verify backup checksums
cd /www/wwwroot/cholinktonghop.com/backups/<STAMP>
sha256sum -c SHA256SUMS

# 2. Create a fresh target database and restore into it (never overwrite live DB blindly)
docker exec pbn-cholink-postgres sh -c 'psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE pbn_forum_cholink_restored OWNER \"$POSTGRES_USER\";"'
docker exec -i pbn-cholink-postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d pbn_forum_cholink_restored --no-owner --role="$POSTGRES_USER"' < forum.dump

# 3. Restore uploads into an empty target directory and verify before switching
```

---

## 11. Remaining Issues & Technical Notes

1. **Local SEO Quote/Purchase Schema Mismatch (`localPricingService.seoProduct()`):**
   - `apps/api/src/extensions/forum-local-pricing/services/localPricingService.js` sets `snapshotVersion: "local-v1"` and `priceVersion: "local-v1"` (strings) and defaults `skuCode` to `"seo_monthly_local"` (underscores).
   - Meanwhile, `POST /api/seo/topics/:id/quotes` validates `productId` against `^[-a-z0-9]{1,80}$` (hyphens only), `seo_quotes.price_version` and `seo_purchases.snapshot_version`/`price_version` are PostgreSQL `integer` columns, and `seo_quotes_immutable` trigger from `0003_big_emma_frost.sql` blocks `UPDATE seo_quotes SET status = 'consumed'` during `POST /api/seo/topics/:id/purchase`.
   - **Mitigation Applied & Follow-up:** On `cholinktonghop.com`, `seo_entitlement` `options.skuCode` was updated to `"seo-monthly-local"` via `PATCH /api/forum/local-pricing/services/seo_entitlement`, and the Free Mode SEO entitlement fixture for Topic `#25` was persisted with integer version `1` inside an atomic transaction (`seoActive`, `/api/seo/topics/25`, `ugc sponsored`, and SEO Active UI all work end-to-end). A follow-up code patch should return integer `eff.localPriceVersion` in `localPricingService.seoProduct()` and allow `status` transitions in `seo_quotes_immutable`.
2. **Fractional Credit Balances vs `bigint` `balance_before`/`balance_after` on `pin_entitlements` & `seo_purchases`:**
   - `0010_ledger_credit_numeric.sql` widened `sys_accounts.balance` to `numeric(30,10)`, while `pin_entitlements.balance_before/after` and `seo_purchases.balance_before/after` remain `bigint`.
   - **Mitigation Applied:** Activity reward rules on `cholinktonghop.com` are configured in whole-Credit VND multiples (`10,000 VND = 1 Credit`) so wallet balances remain exact integers until those columns are widened to `numeric(30,10)`.
3. **`www.cholinktonghop.com` DNS Record:**
   - Cloudflare DNS currently only has the apex record `cholinktonghop.com`. When `www.cholinktonghop.com` is added in Cloudflare DNS, add `www.cholinktonghop.com` in `aaPanel -> Website -> cholinktonghop.com -> Domain Manager` and re-issue the Let's Encrypt certificate.

---

## 12. Rollback Procedure

If `cholinktonghop.com` needs to be rolled back or paused without affecting `ops-server` or `seo-ops-semantic`:

```bash
# 1. Stop only the PBN Docker Compose stack
docker compose -f /www/wwwroot/cholinktonghop.com/docker-compose.yml down

# 2. (Optional) Disable the cholinktonghop.com reverse proxy or site in aaPanel
#    aaPanel -> Website -> cholinktonghop.com -> Status -> Stop
```

All resources belonging to `pbn-cholinktonghop` (`pbn-cholink-*` containers, `pbn-cholinktonghop_default` bridge network, `pbn_cholink_*` volumes, and `/www/wwwroot/cholinktonghop.com/`) are 100% isolated from `/www/ops-server` and `/www/seo-ops-semantic`.
