# Phase 2.3A — Badge and profile decoration cleanup

Status: local implementation and acceptance PASS. This task is limited to profile decoration. SEO pricing, OPS synchronization, auctions, banners, policy rules and Wallet accounting were not expanded.

## Changes

- `/profile/badges` is the main decoration page: owned and locked badges, bilingual names/descriptions, explicit equip/remove controls, active frame preview and four lightweight frame styles.
- One badge determines the frame. The existing `user_badges.is_displayed` flag is reused; equipping locks the user's row, verifies active badge ownership, clears other selections and selects the requested badge in one database transaction. Concurrent requests serialize. Removing it restores the default frame. No new table, column or schema migration is required; A/B remain baseline v6.
- Legacy owners with multiple displayed flags retain all ownership records. Presentation deterministically selects the first displayed badge by user display order and ownership ID. An explicit selection normalizes the flags to one. Newly granted badges are unlocked but not automatically equipped, so earning a badge does not unexpectedly replace a selected frame.
- Badge enrichment is independent of Credit activation and supplies both the single public badge and `avatarFrame` for auth, topic/reply authors, user cards and public profiles. The shop frame enricher is no longer registered. The existing avatar response shape is retained, with `itemType: badge` and a small `{theme}` metadata string.
- `UserAvatar` accepts only a fixed theme palette. Old purchased frame images, arbitrary item CSS and frame animations no longer control rendering. There is no frame marketplace or new animation engine.
- `/profile/shop` and `/profile/items` redirect to `/profile/badges`; `/dashboard/shop` redirects to `/dashboard/badges`. User and Admin navigation no longer advertise the decorative shop. Historical gift links lead to badges. Badge navigation remains available when Wallet is disabled.
- Every non-read Shop HTTP operation returns a localized 410 response, including ordinary and Admin writes. Public `/api/shop/items` returns an empty catalog with `commerceEnabled:false`. Existing inventory/history reads are retained for compatibility. Direct service buy/gift/equip/unequip/use calls also reject before any database write. SEO purchase uses its existing dedicated endpoints and remains operational.
- Existing Shop tables, definitions, inventory, purchase logs, Wallet ledger and SEO history are retained. There is no automatic conversion, deletion, reimbursement or new decorative charge.

## Badge → frame mapping

| Theme | Appearance | Default examples |
|---|---|---|
| None | Simple slate border | No equipped badge |
| `common` | Green border | First Reply, First Topic, Early Member |
| `strong` | Stronger blue border | Active Member, Topic Contributor, Regular Member |
| `rare` | Cyan/purple gradient | Longtime Member, Community Contributor, Community Favorite |
| `premium` | Vivid amber/pink/purple gradient, small static glow | Community Star, Committed Member, Verified Operator |

Existing badge metadata may specify `frameTheme` or `rarity`; accepted themes are a fixed enum, with `uncommon → strong`, `epic/legendary → premium`. Invalid metadata safely defaults to common. Known seeded badges have stable slug-based defaults; custom badges default to common. Existing Admin badge inspection and manual grant/revoke tools remain. This task does not introduce a badge commerce dashboard or a new achievement engine. Existing achievement qualification and configured passive effects remain.

## I18n and demo data

Both locale catalogs now include 46 new badge/profile labels and seed translations. The backend adds one translated commerce-unavailable response. The final checker reports 2,687 web keys per locale, 741 backend templates, zero missing/invalid translations and zero hardcoded Chinese UI strings.

Fifteen seeded badges now use neutral English storage names and VI/EN presentation. Examples:

| Previous demo name | English | Vietnamese |
|---|---|---|
| 初来乍到 | Early Member | Người đồng hành |
| 初试啼声 | First Reply | Phản hồi đầu tiên |
| 抛砖引玉 | First Topic | Chủ đề đầu tiên |
| 活跃分子 | Active Member | Hoạt động tích cực |
| 管理员认证 | Verified Operator | Điều hành viên đã xác minh |

`scripts/badge-cleanup.mjs` snapshots protected account/commercial state under ignored `.local/badge-cleanup`, then changes only badge labels matching the known original demo name and stable slug. It normalized 15 rows in each forum; repeated execution changes zero further rows. IDs, ownership, conditions, metadata, reward configuration and custom-named badge records are retained. Fresh seeding also uses neutral names. Known preset labels are localized in badge cards, public badge tooltips and Admin list/assignment. Arbitrary operator-created names remain authored data and are not machine-translated.

The unlock dialog now uses translated title, congratulatory message and Close button without confetti or animation dependencies. Badge-earned notifications render a translated message rather than the raw stored legacy message, and new unlock links carry only the badge ID. Automatic badge checks also no longer depend on Credit being active. The badge page resolves `unlockBadgeId` against the authenticated owned catalog and uses that trusted record; stale Chinese `unlockBadgeName` and arbitrary icon URL parameters no longer supply display data. A browser probe confirms those legacy parameters cannot reintroduce Chinese names or untrusted image URLs. Old Chinese comparison strings remain in the backend mapping solely to recognize the original demo records; they are not rendered.

Legacy decorative item names and historical logs are not rewritten: their pages and catalog are retired, and prior inventory/history remains auditable. They cannot re-enable a purchased frame or debit Credit.

## Source scope

Backend: badge presentation helper/service/enricher/routes, neutral badge seeds, localized commerce-unavailable guard, Shop route retirement and removal of Shop frame enrichment registration.

Frontend: fixed-theme shared avatar, badge cards/list/preview/localizer, localized badge tooltips/Admin assignment names, lightweight unlock dialog, profile badge unlock lookup, legacy page redirects and sidebar/gift-link cleanup. No SEO, policy, Wallet or baseline schema implementation is changed.

## Verification

| Check | Result | Evidence |
|---|---|---|
| A/B registration/login and original Admin authorization | PASS | `test-badge-cleanup-api.mjs` |
| Operator badge grant; foreign Admin JWT rejection | PASS | Actual A/B API responses |
| Single equip, concurrent equip, remove/default, ownership protection | PASS | API requests and real PostgreSQL state |
| Four theme styles and public-profile frame | PASS | Actual Chromium controls/computed styles and public profile |
| VI/EN badge page, locked/owned labels and seed names | PASS | Both forums; no visible Han text in cleaned pages |
| Translated unlock dialog; stale URL labels ignored | PASS | Actual modal, both locales/forums |
| Retired Shop navigation and graceful page redirects | PASS | Browser DOM and redirect destinations |
| Shop catalog and all write paths unavailable | PASS | Empty catalog and 410 API responses; direct service guards |
| No decorative debit | PASS | Balance unchanged across refused operations |
| SEO exact debit, durable retry, active sponsored links and history | PASS | Dedicated new fixture accounts, existing signed development prices |
| Phase 2.2 blocked topic edit | PASS | Existing mandatory blocked fixture returns 422 |
| Wallet/profile pages | PASS | Browser checks; canonical Credit and no visible Chinese remnants |
| Existing accounts, ledger, SEO history, shop definitions/inventory | PASS | Original row hashes compared on both databases |
| Schema/baseline preservation | PASS | No schema files changed; A/B still v6 |
| Independent A/B production builds | PASS | Both existing native build commands exit 0 |
| Lint and i18n | PASS | Zero lint errors; 11 pre-existing unused-disable warnings; i18n zero errors |
| Real OPS, production deployment/load, non-Chromium browsers | NOT TESTED | Outside this cleanup |

Repeatable evidence:

- `scripts/test-badge-cleanup-api.mjs` → `docs/audit/PHASE2.3A-api-results.json`.
- `scripts/test-badge-cleanup-browser.mjs` → `docs/audit/PHASE2.3A-browser-results.json`.
- `scripts/test-badge-cleanup-preservation.mjs` → `docs/audit/PHASE2.3A-preservation-results.json`.
- Screenshots: `docs/audit/screenshots/badge-cleanup/`, A/B × VI/EN badge previews, unlock dialogs and Wallet pages.

Tests use dedicated newly registered accounts; only those accounts receive test badge grants and intentional SEO charges. Existing user/account/commercial row hashes are unchanged. Authentication/update timestamps are excluded from comparisons; no credentials or private fixture files are committed. Existing SEO policy source and prices were sufficient for regression; no real OPS connection was introduced.

The browser suite respects existing request limits with pacing. An early selector matched both valid Close buttons and was tightened; long concurrent development compilation was avoided by testing the successfully built native local processes. Build output still emits the existing dynamic sitemap/robots diagnostics and `next start`/standalone advisory, while builds and HTTP pages succeed. These are local acceptance processes, not a production deployment.

## Operational state and limitations

Forum A remains at `http://127.0.0.1:3100` / API 7100 / `pbn_dev`; B at `http://127.0.0.1:3200` / API 7200 / `pbn_forum_b`. Final browser acceptance uses their independent native compiled builds. JWT/cookie/database boundaries remain separate. No Docker, real OPS changes, banner billing, auctions or broad profile redesign is included.

Existing badge icons still use their configured URLs, including upstream placeholder images; this task supplies lightweight frame styling and does not redesign badge artwork. Custom operator labels require operator-authored translations if bilingual custom names are desired. Existing legacy inventory APIs and inactive source components remain for historical compatibility but cannot purchase, gift, use or equip decorations. No new pagination/achievement engine or heavy workers were added.

Branch: current `chore/pbn-phase1-5-i18n`. Starting commit: `e152864717cb9b2ba4f4056501303cd445cf6298`. Commit message: `refactor(pbn): simplify badges and remove profile decoration commerce`. Personal origin only; no force push or automatic merge. Final commit SHA, remote match and clean-tree verification are provided in the completion message.
