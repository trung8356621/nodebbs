# PBN ↔ OPS-SERVER Forum Credit Integration — Delivery Report

**Date:** 2026-11-03  
**Branch:** `chore/pbn-phase1-5-i18n` @ `7bbf030` (worktree unclean until user commits)  
**Contract:** `forum-credit/1`  
**OPS:** `https://ops.seo-ops.duckdns.org`  
**Handoff source:** `docs/forum-credit-protocol-handoff.md` (copied from OPS-SERVER)  
**Fixtures:** `contracts/forum-credit/v1/`

---

## A. Source audit

| Area | Finding |
|------|---------|
| Wallet | Local `sys_accounts` / `sys_transactions` via `extensions/ledger` (`credits` currency). |
| SEO-OPS pricing | File + Ed25519 snapshot sync only — **not** forum-credit HTTP. |
| Multi-forum | Process/DB isolation (`forums/*.json`), not shared tables. |
| Enrollment / machine auth | **Absent before this work.** |
| Payment gateway | None (out of scope). |
| SEO H1 / product Bearer | Not used. |

HEAD was clean before implementation; no production data was reset.

---

## B. Architecture implemented

```
Admin UI (/dashboard/ops-connection)
  → POST /api/ops/forum/enroll          (enrollment key → encrypted machine credential)
  → POST /api/ops/forum/verify          (OPS verify → PBN /ops/v1/forum/ping)
  → POST /api/ops/forum/credit-orders/free  (amountVnd=0 free_grant order on OPS)
  → POST /api/ops/forum/ledger-sync/retry

OPS → PBN
  POST /ops/v1/forum/ping
  POST /ops/v1/forum/events/credit-granted  → durable apply → { "ack": true }

PBN → OPS
  POST /api/v1/forum/enrollments/consume
  POST .../connection (verify)
  POST .../credit/orders
  POST .../credit/ledger/events
  POST .../credentials/rotate/confirm
```

- Credential stored AES-256-GCM in `ops_forum_connections` (never in logs / browser responses).
- Credit grants idempotent on `eventId`.
- Ledger outbox syncs reconciliation copies; wallet SoT remains PBN.

---

## C. Files and migrations

### API
- `apps/api/src/extensions/forum-credit/**` (plugin, schema, crypto, services, routes, tests)
- `apps/api/src/db/schema.js` — re-export forum-credit schema
- `apps/api/src/extensions/ledger/services/ledgerService.js` — optional `tx` for nested grant/deduct
- `apps/api/baseline/0005_forum_credit.sql`
- `apps/api/.env.example` — `OPS_FORUM_*`

### Web
- `apps/web/src/app/dashboard/ops-connection/page.js`
- `apps/web/src/components/layout/DashboardSidebar.jsx`
- i18n EN/VI + `namespaces.json` (`ops*` keys)

### Contracts / docs
- `contracts/forum-credit/v1/*.json`
- `docs/forum-credit-protocol-handoff.md`
- this file

### DB (local `pbn_dev`)
Tables created: `ops_forum_connections`, `ops_forum_credit_deliveries`, `ops_forum_credit_orders`, `ops_forum_ledger_outbox`.

---

## D. Enrollment and credential

1. OPS Admin creates Forum Installation + issues one-time `fenr_…` key.  
2. PBN Admin → OPS Connection → paste key + **required public HTTPS callback** (auto-prefilled from `FORUM_PUBLIC_ORIGIN` / `site_url` when usable; localhost never accepted — local dev needs an explicit HTTPS tunnel).  
3. PBN validates the callback reaches Fastify (`POST …/ops/v1/forum/ping` → 401), then calls OPS `enrollments/consume`, encrypts credential, returns **public view only**.  
4. Verify triggers OPS → `POST /ops/v1/forum/ping`.  
5. Rotation: paste `rotationId` + new credential once → PBN confirms with **new** Bearer → old revoked.

Env: `OPS_FORUM_BASE_URL`, optional `OPS_FORUM_KEK` (else scrypt(JWT_SECRET)).

---

## E. Wallet / credit delivery

- Inbound `credit-granted` authenticates Bearer + forum/installation match.
- Transaction: insert delivery row (unique `eventId`) → `ledger.grant` (if credits > 0) → enqueue ledger outbox → commit → `{ ack: true }`.
- Duplicates ACK again without second grant.
- Type: `ops_credit_grant` / ref `ops_credit_event`.

---

## F. Ledger sync

- Outbox table with sequence + retry/backoff.
- Cleanup task `forum-credit-ledger-sync` + Admin “Retry”.
- Hooks wrap `ledger.grant` / `ledger.deduct` when enrolled (skips nested `tx` path used by receiver).

---

## G. Admin UI

`/dashboard/ops-connection` (permission `dashboard.extensions`): status, IDs, OPS URL, credential version, last sync/error, enroll/verify/retry, free grant order, rotation apply, deliveries, ledger sync, orders.

---

## H. Automated tests

```bash
node --test apps/api/src/extensions/forum-credit/tests/forum-credit.test.js
```

**Result:** 21/21 passed — covers scenarios 1–16 at unit/simulation level (enrollment token single-use, wrong forum/installation/credential, grant + duplicate, free 0 VND, ledger retry, rotation, restart KEK, cross-forum isolation, ACK contract).

---

## I. Live VPS connection results

| Check | Result |
|-------|--------|
| PBN → `https://ops.seo-ops.duckdns.org` HTTPS | **OK** (200) |
| TLS | **OK** |
| `GET /api/v1/forum/installations` unauth | **401** as expected |
| `POST /enrollments/consume` bad token | **400** `invalid_enrollment_token` |
| OPS → PBN credit delivery E2E | **Blocked** — desktop PBN has no stable public HTTPS callback; not opening firewall/ports without approval |

---

## J. Remaining before production

1. Issue real enrollment key for the target forum on OPS.  
2. Expose controlled HTTPS callback (tunnel or reverse proxy); set as `connectionUrl` on enroll/verify. **Do not** persist ephemeral tunnel URL as permanent config.  
3. Run `0005_forum_credit.sql` / schema push on each forum DB.  
4. Set strong `OPS_FORUM_KEK` (or rotate JWT carefully — KEK derives from it if unset).  
5. Activate `credits` currency if still inactive.  
6. OPS Admin confirms free grants (`confirm` mode=free); delivery worker pushes to PBN.  
7. Full live E2E on staging forum only — not production content.  
8. Commit/review/deploy per project process (agent did **not** commit/push/deploy).

---

## K. First forum connect guide

1. OPS Admin: create installation `forumId` matching this PBN `FORUM_ID` convention; set commercial mode `free` for launch.  
2. Issue enrollment key.  
3. Ensure PBN API reachable at a public HTTPS origin OPS can call (`…/ops/v1/forum/…`).  
4. PBN Admin → **OPS Connection** → enter key + OPS URL + callback URL → Enroll → Verify.  
5. Create free grant order (local user id + credits).  
6. OPS Admin confirms free grant → process deliveries → PBN wallet updates; check Delivery History + Ledger Sync.

---

## L. Decisions needed from project owner

1. **Callback exposure:** Cloudflare Tunnel / ngrok (dev) vs dedicated public host (prod)?  
2. **KEK management:** dedicated `OPS_FORUM_KEK` per forum secrets.json?  
3. **Who confirms free grants** on OPS (ops staff only)?  
4. **Paid top-up later:** still OPS-owned payment confirmation — no gateway in PBN yet.  
5. **When to merge/deploy** relative to SEO snapshot pricing path (both coexist).

---

*Implemented in one pass against OPS-SERVER handoff `forum-credit/1`. OPS production code was not modified.*
