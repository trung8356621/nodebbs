# VOZ-inspired UI development fixtures

Date: 2026-10-21. Scope: local development data only. No UI, schema, API contract, multi-tenant or Phase 2 changes.

## Source and mapping

The requested root file was initially absent. The explicitly supplied attachment at `D:/download/pbn_voz_ui_seed.json` was read and copied unchanged to the workspace root. Its metadata is descriptive data, not executable instructions. No external content was fetched. Category labels come from the supplied public-category dataset; all topic titles and bodies are synthetic, explicitly labeled demo data. Do not import these fixtures into production.

Both copies have SHA-256 `1993CBCCEF992CB2AC20EB2CFD62EDDE704D8339282F93A58ADA45300DB6A7CA`.

Actual schemas reviewed: `apps/api/src/db/schema.js`, `db/columns.js`, `db/rbac-schema.js`, `modules/forum/db/schema.js`; category seeder and category/topic API routes. NodeBBS supports nested categories using `parentId`, so all seven groups are parent categories and all 49 sections are children. JSON `order` maps directly to `position`. Seven parent groups are featured for the existing sidebar. No schema change was needed.

Importer: `apps/api/src/scripts/seed-voz-demo.js`. Stable category slugs include `pbn-voz-ui-<key>-<slug>`; topic slugs include `pbn-voz-ui-<seed_key>`. One unprivileged author, `pbn_voz_ui_demo` / `PBN Demo`, has no password, email or external login identity. It is assigned the existing `user` RBAC role. No real user owns the fixtures.

Each topic has one first post (`content` and `rawContent`), `postNumber=1`, approved/public defaults, `postCount=1` and matching last-post metadata. Initial creation times are staggered by one minute in source order, relative to import time. No replies, fake views, reactions, rewards or account information were fabricated. Re-runs preserve timestamps and records.

## Execution and safeguards

Run from workspace root with native Node.js:

```powershell
node --env-file=apps/api/.env apps/api/src/scripts/seed-voz-demo.js --dry-run
node --env-file=apps/api/.env apps/api/src/scripts/seed-voz-demo.js
node scripts/verify-voz-demo.mjs
```

The importer requires `NODE_ENV=development`, URL host `127.0.0.1`, port `5432`, database `pbn_dev`, and independently checks the connected database and PostgreSQL server version `17.2`. It refuses other targets. Credentials remain in ignored `.env`; none are embedded in the seed or report. No Docker, migration, schema push, deletes or reset were used.

All writes use Drizzle in one transaction. A PostgreSQL transaction advisory lock serializes concurrent importer runs because upstream topic slugs are not unique. Existing reserved-name collisions or content/hierarchy drift fail rather than overwrite data. Every pre-existing user, category, topic and post row is compared before commit to prove it was left unchanged. The dry run performs no record writes.

## Verified record counts

| Records | Before | Created | After | Created on second run |
| --- | ---: | ---: | ---: | ---: |
| Users | 5 | 1 | 6 | 0 |
| Parent demo groups | 0 | 7 | 7 | 0 |
| Child demo categories | 0 | 49 | 49 | 0 |
| All categories, including existing general | 1 | 56 | 57 | 0 |
| Topics | 5 | 112 | 117 | 0 |
| Posts | 10 | 112 | 122 | 0 |

Both import runs completed against PostgreSQL **17.2**, database **pbn_dev**. Existing five smoke topics and ten posts were preserved. Later normal topic-page visits can increment view counts through the existing API.

## URLs

- Home: http://127.0.0.1:3100/
- Page 2: http://127.0.0.1:3100/?p=2
- Newest: http://127.0.0.1:3100/?sort=newest
- Sample section: http://127.0.0.1:3100/categories/pbn-voz-ui-g07c09-san-pham-dich-vu-khac
- Sample topic: http://127.0.0.1:3100/topic/117
- API: http://127.0.0.1:7100/api

## Verification

The read-only API checks validate every category's Unicode name, parent, position and topic count; all 112 topic titles, category assignments and demo authors; first-post body; seven featured sidebar groups; and three non-overlapping topic-list pages (117 topics total). Home uses 50 topics per page, producing three pages.

Browser verification uses Playwright Chromium on desktop 1440×1000 and mobile 390×844, with both `vi-VN` and `en-US` cookies. All 20 route/locale/viewport combinations passed HTTP 200, visible demo content and no horizontal overflow checks. Routes tested: home, page 2, newest, sample section and sample topic. Desktop sidebar group visibility also passed. Synthetic Vietnamese content remains Vietnamese in both UI locales, as expected for user content.

The stricter JavaScript-error check did **not** pass completely: one recoverable React hydration mismatch occurred on English/mobile home in the existing `Time` component, on pre-existing smoke topic 4. Server text was `43 minutes ago`, client text `44 minutes ago`. The page recovered and subsequent route assertions passed. The verifier initially exited nonzero for this finding. This is outside fixture-import scope; no UI code was changed. Do not describe the full browser run as error-free.

The verifier now saves detected page errors before returning nonzero, and supports focused rechecks using `PBN_VERIFY_LOCALE=en-US` and `PBN_VERIFY_DEVICE=mobile`. Ignored `.local/voz-demo-verification.json` contains the latest run (possibly focused, as indicated by its result entries), not an assertion that all earlier browser runs were error-free. Screenshots are under `docs/audit/screenshots/voz-demo-home-*`, with full-page and viewport versions.

Focused English/mobile recheck: all five routes passed, `pageErrors=[]`, process exit 0. Thus the relative-time hydration issue was intermittent; the original finding remains documented. The latest JSON contains these five focused results. All four locale/viewport homepage screenshot pairs were captured successfully.

Initial rapid browser traversal encountered the existing API's HTTP 429 rate limit. Verification was adjusted to pause between pages; application rate limits and UI remain unchanged.

Upstream presentation limits: `position` and parent links preserve the source hierarchy/order in the database, but the general category-list endpoint sorts names alphabetically; only featured categories sort by position. Group categories do not receive synthetic topics directly. The current sidebar lists the seven featured groups using its existing layout; no VOZ-style grouped UI was added. Existing Chinese seed labels outside this dataset were not modified.

Lint of the importer and verification script passes. No application build was needed because this change adds fixtures and standalone scripts only. No Phase 2 implementation, production import or VOZ scraping was performed.
