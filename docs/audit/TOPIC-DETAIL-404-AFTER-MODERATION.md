# Topic Detail 404 / Unopenable After Moderation — Diagnose & Fix

Date: 2026-11-05  
Forum probed: `https://pbn-dev.cholinktonghop.com`  
No DB mutation, no VPS deploy, no commit/push.

## 1. Root cause

**Not moderation state.** Topics 198 and 193 are healthy in API.

| ID | API `GET /api/topics/:id` (anonymous) | `approvalStatus` | `isDeleted` | Category | First post |
|---|---|---|---|---|---|
| 198 | **200** ~0.4s | `approved` | false | General (public) | present (`firstPostId` 215, content returned) |
| 193 | **200** ~0.2s | `approved` | false | General (public) | present (`firstPostId` 210) |

**Actual failure:** Next.js App Router **SSR hang** on `/topic/[id]` (including `/topic/99999`). HTML returned **0 bytes** until Cloudflare **524** (~90s) or client timeout. Home `/` and `/api/*` stayed fast.

Users perceived “không mở được / 404” because:

1. Browser/CF eventually failed the document request, and/or
2. When SSR did finish via error paths, `getTopicData` used `fetchData(..., { fallback: null })` → `notFound()` → **fake Next 404** for non-404 failures.

### Code cause

1. `getTopicData` was wrapped in `React.cache()` while calling `request()` → `cookies()` (`apps/web/src/modules/forum/server.js`).
2. Topic `generateMetadata` ran `Promise.all([getTopicData(id), getSiteInfo()])` where `getSiteInfo` → `getCachedSettings()` (also `cache` + `cookies`) (`apps/web/src/app/(main)/topic/[id]/page.js`).
3. That combination stalls the topic route render pipeline (topic is the only page with this pattern). `/topic/99999` hung the same way → proves hang is independent of DB row / approval.

Moderation approve path (`adapters.js` topic `setStatus`) already flips topic + first post `approvalStatus`. Blacklist/Credit/SEO/Parent-Child not involved on GET.

## 2. Files / functions

| File | Role |
|---|---|
| `apps/web/src/modules/forum/server.js` → `getTopicData` | Removed `React.cache`; use `request()` directly (404→null, 5xx throw) |
| `apps/web/src/app/(main)/topic/[id]/page.js` → `generateMetadata` / page | Sequential metadata fetch; rethrow non-404 errors instead of fake `notFound()` |
| `apps/web/src/lib/server/api.js` | Comment clarifying critical resources must not use `fetchData` fallback |

## 3. HTTP before / after

**Before (live prod, this session):**

| URL | Status | Notes |
|---|---|---|
| `/api/topics/198` | 200 | approved |
| `/api/topics/193` | 200 | approved |
| `/topic/198` | 524 / timeout | 0-byte hang |
| `/topic/193` | 524 / timeout | same |
| `/topic/99999` | timeout | same hang class |
| `/` | 200 | ~1.5s |

**After code fix (local contract):** PASS via `scripts/test-topic-detail-visibility.mjs` (8).  
**Live HTML re-check** requires redeploy/restart of the Next.js process on `pbn-dev` with this patch — not done in this task.

Expected after restart:

| Case | Expected |
|---|---|
| Approved 198/193 anonymous | page **200** HTML &lt;15s; API still 200 |
| Pending/rejected anonymous | API **404** → page **404** (`notFound`) |
| Missing id | API **404** → page **404** |
| API 5xx during SSR | error boundary / thrown error — **not** soft 404 |

## 4. Code changed

- `getTopicData(id, pbnT)` → `request('/topics/'+id)` (no cache, no fetchData swallow).
- Metadata: fetch topic, then `getSiteInfo` (no parallel cache+cookies pair).
- Page: `try/catch` — null → `notFound()`; other errors → `throw`.

RBAC / pending visibility unchanged: API still returns 404 for non-approved to anonymous (`topics/index.js`).

## 5. Tests

| Suite | Result |
|---|---|
| `node scripts/test-topic-detail-visibility.mjs` | **PASS 8** |
| `node scripts/test-content-blacklist.mjs` | **PASS 35** (blacklist regression) |
| Live `TOPIC_DETAIL_BASE_URL=https://pbn-dev...` HTML smoke | **Not run post-fix** (needs Next restart with new build) |

Optional after deploy:

```powershell
$env:TOPIC_DETAIL_BASE_URL='https://pbn-dev.cholinktonghop.com'
node scripts/test-topic-detail-visibility.mjs
```

## 6. Restart / cache

**Yes — restart Next.js (web) on the forum host after deploying this patch.**  
No DB reset. No topic delete. API-only restart is insufficient (bug is web SSR). Clear `.next` only if a stale build is suspected after deploy.

## 7. Topic 198 / 193 verdict

| ID | DB/API | Page before fix | Action |
|---|---|---|---|
| 198 | Exists, approved, not deleted, public | SSR hang (524) | Fixed by web SSR patch; no DB change |
| 193 | Exists, approved, not deleted, public | SSR hang (524) | Same |

## 8. Limits

- Did not redeploy `pbn-dev` in this session.
- Did not run browser smoke against a rebuilt Next instance.
- CMS `[...slug]` self-fetch deadlock pattern remains unused for `/topic/*` (App Router wins) but is still a latent risk for CMS 404 HTML.
