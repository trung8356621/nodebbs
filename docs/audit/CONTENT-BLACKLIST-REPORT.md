# Content Blacklist (Single Forum) — Audit & Handover

Date: 2026-11-05  
Scope: one independent Forum DB. No VPS deploy, no Parent/Child Sync, no OPS-SERVER runtime checks.

## 1. Audit findings (Phase 2.2 vs code)

| Question | Finding |
|---|---|
| What already worked? | Shared `evaluate()` / `PolicyService.inspect()`, Fastify `policy` plugin locks + preHandler on topics/posts/ingest/profiles/pages/ads, BLOCK→422 `POLICY_BLOCKED`, REVIEW→moderation pending, local rule CRUD under `/api/policy`, dashboard `/dashboard/policy`, decision audit tables. |
| Where are rules stored? | Forum-local PostgreSQL tables: `policy_rules`, `policy_versions`, `policy_decisions`, `policy_syncs`, `policy_scans` (`apps/api/src/db/policy-schema.js`). |
| Global / signed sync still present? | Yes, optional. `POLICY_SNAPSHOT_FILE` + `POLICY_TRUST_KEY_FILE` still sync Ed25519 snapshots into `scope='global'`. Not removed (other phases/tests depend on it). |
| Which APIs call Policy Engine? | `POST/PATCH /api/topics`, `POST/PATCH /api/posts`, `POST /api/integrations/topics`, profile/register, pages/ads admin writes, moderation approve recheck, upload active-markup force BLOCK. |
| Bypass paths? | No admin/API-key/credit/SEO entitlement bypass in the policy plugin. Ingest forbids admin authors. Batch-delete and metadata-only topic fields are outside content recheck (unchanged content). |
| Admin blacklist UI? | Advanced `/dashboard/policy` existed (generic local rules). No Domains/Keywords Content Blacklist in Settings before this task. |
| Edit recheck? | Yes for title/content/post body (candidate merges previous DB fields). BLOCK returns 422 before handler → published body unchanged. |
| Old-content rescan? | Phase 2.2 scanner + background worker still exist. This task does **not** auto-hide old posts when editing blacklist rules. |

## 2. Reused

- Tables `policy_rules` / `policy_decisions` / versions (no new engine tables).
- `apps/api/src/services/policy/engine.js` extract/normalize/evaluate pipeline (Markdown/HTML URL parsing).
- `apps/api/src/plugins/policy.js` single enforcement hook for all publish paths.
- Existing moderation REVIEW workflow and ingest `POLICY_BLOCKED` contract.
- Dashboard permission `dashboard.moderation`.

## 3. Changed / added

| Area | Change |
|---|---|
| Engine | Added `keyword` type (Unicode word/phrase boundaries, NFKC, case-insensitive); `custom_keyword` category; `normalizeDomainInput()` for http(s)/www/path admin input; helper `hostMatchesDomain` / `keywordMatches`. |
| Service | Removed fail-closed `GLOBAL_SNAPSHOT_NOT_CONFIGURED` → REVIEW. Standalone forums publish with local rules only; global rules still apply when present. |
| API | `POST /api/policy/test` dry-run match (no content write). Local rule CRUD no longer auto-enqueues live retrospective scans. |
| Admin Settings | New tab **Content blacklist** (`?tab=content-blacklist`) with Domains / Keywords, search, CRUD, active toggle, BLOCK/REVIEW, Test Rule. |
| Policy page | Types/categories include `keyword` / `custom_keyword`. |
| Tests | `scripts/test-content-blacklist.mjs`; ingest keyword assertion. |

## 4. Database migration

**None required.** `type`, `category`, and `value` are already free-form text columns. Keyword rules use `type='keyword'`. Existing global/local rows preserved.

## 5. Admin UI location

- Primary: `apps/web/src/app/dashboard/settings?tab=content-blacklist`  
  Component: `apps/web/src/app/dashboard/settings/components/ContentBlacklistSettings.jsx`
- Advanced / global sync / manual scans: `/dashboard/policy`

## 6. APIs protected (same Policy Engine)

1. User topic create — `POST /api/topics`
2. User topic update — `PATCH /api/topics/:id`
3. User reply create — `POST /api/posts`
4. User reply update — `PATCH /api/posts/:id`
5. Admin content create/update (same routes; no bypass)
6. External ingest — `POST /api/integrations/topics`
7. Also still covered: profiles/register, pages, ads (Phase 2.2)

## 7. Tests

| Suite | Result |
|---|---|
| `node scripts/test-content-blacklist.mjs` | **PASS** (35) |
| `node scripts/test-policy-unit.mjs` | **PASS** (37) |
| `node --test apps/api/src/extensions/forum-ingest/tests/forum-ingest.test.js` | **PASS** (17) |
| Live HTTP topic/reply/admin bypass against running A/B forums | Not re-run in this pass (unit/contract coverage only; prior Phase 2.2 API suite still available) |
| `pnpm i18n:check` | Existing unrelated empty `ledgerRewardIndivisible` errors; blacklist keys present EN/VI |

Covered cases: apex/subdomain, lookalike hosts, Markdown/HTML URLs, encoding/Unicode, Vietnamese keywords, case fold, intra-word false positive, active/inactive, BLOCK/REVIEW/ALLOW, route coverage, ingest contract codes, Forum A≠B rule arrays, BLOCK decision shape (edit does not reach writer).

## 8. Limits before VPS

- Signed global sync code remains optional legacy; do not point production at untrusted snapshot files without key ops.
- Retrospective scanner code still loads if intervals are configured; operators should leave live scans manual unless intentional.
- No live redirect following / outbound HTTP during post.
- Topic PATCH that only toggles pin/close/category does not re-evaluate body (content unchanged).
- Binary attachments / opaque files are not keyword-scanned.
- This is deterministic MVP matching, not an ML classifier or legal warranty.
- No Parent/Child or OPS-SERVER policy sync in this delivery.

## How to verify locally

```powershell
node scripts/test-content-blacklist.mjs
node scripts/test-policy-unit.mjs
node --test apps/api/src/extensions/forum-ingest/tests/forum-ingest.test.js
```

Admin: open Settings → Content blacklist → add domain `example.com` / keyword → use Test Rule → create a topic with matching URL (expect 422 `POLICY_BLOCKED` or pending REVIEW).
