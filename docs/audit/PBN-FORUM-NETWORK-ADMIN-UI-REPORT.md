# PBN Forum Network Admin UI — Report

**Date:** 2026-11-05 (Asia/Bangkok)  
**Scope:** Dashboard UI for existing `forum-network` addon. Minimal API enrichment only.  
**Preserved:** Forum A/B untouched. No OPS-SERVER changes. No baseline migration. No commit/push.

---

## Verdict

Admin UI is available at **`/dashboard/forum-network`** (sidebar: **Mạng lưới Forum** / **Forum network**).  
API smoke against fixture `forum_v7`: **9/9 PASS**.  
Browser UI login/screenshot: **NOT VERIFIED** (automation browser could not reach `127.0.0.1:3700`; stopped after bounded attempt).

---

## Files changed

### Backend (read/draft helpers only)

- [`apps/api/src/extensions/forum-network/routes/admin.js`](../../apps/api/src/extensions/forum-network/routes/admin.js) — overview, templates, policy-applications, publish-from-template, children/draft
- [`apps/api/src/extensions/forum-network/services/networkService.js`](../../apps/api/src/extensions/forum-network/services/networkService.js) — overview enrichment; refuse Parent on Forum A; draft Child (no DB create)
- [`apps/api/src/extensions/forum-network/defaultTemplate.js`](../../apps/api/src/extensions/forum-network/defaultTemplate.js) — built-in default template payload

### Frontend

- [`apps/web/src/app/dashboard/forum-network/page.js`](../../apps/web/src/app/dashboard/forum-network/page.js)
- [`apps/web/src/extensions/forum-network/`](../../apps/web/src/extensions/forum-network/) — page + 4 tab components + API client
- [`apps/web/src/components/layout/DashboardSidebar.jsx`](../../apps/web/src/components/layout/DashboardSidebar.jsx) — menu entry (not under Ledger)
- i18n: `en-US.json`, `vi-VN.json`, `namespaces.json` (`fn*` keys)

### Smoke / docs

- [`scripts/smoke-forum-network-admin.mjs`](../../scripts/smoke-forum-network-admin.mjs)
- [`docs/audit/PBN-FORUM-NETWORK-ADMIN-UI-SMOKE.json`](./PBN-FORUM-NETWORK-ADMIN-UI-SMOKE.json)

---

## UI completed (4 tabs)

| Tab | Contents |
|-----|----------|
| **Tổng quan** | Role (Độc lập/Parent/Child), Forum ID, domain, DB name (no credentials), Parent link, child count, template/policy versions, last sync, Parent connection badges, offline-safe / OPS-not-required. **Bật Parent** when safe (blocked for Forum A). |
| **Forum con** | Compact table + detail dialog. **Tạo forum con** wizard (8 steps) → generates draft JSON + CLI command. Does **not** create DB or claim success. |
| **Cấu hình mẫu** | Template table; Template / Managed / Local field groups; detail view. Read-only (no browser file edits). |
| **Đồng bộ** | Child sync table (Parent), application history, publish managed from template, CLI commands for package apply. No fake sync button. |

Statuses use explicit copy (no vague `—`): e.g. “Chưa đồng bộ”, “Chưa có trên forum này”, “Áp dụng bằng gói CLI”.

---

## APIs connected

| Method | Path | Used by |
|--------|------|---------|
| GET | `/api/forum/network/overview` | All tabs |
| POST | `/api/forum/network/enable-parent` | Overview |
| GET | `/api/forum/network/children` | (via overview) |
| GET | `/api/forum/network/templates` | Templates |
| GET | `/api/forum/network/policy-applications` | Sync |
| POST | `/api/forum/network/policies/publish-from-template` | Sync (Parent) |
| POST | `/api/forum/network/children/draft` | Create Child wizard |

Permission: `dashboard.extensions` (Admin).

---

## Still CLI-only (by design)

- Actual Child **provision** (`create-db` / migrate / seed / admin password handoff)
- Export/apply managed policy **package files** across processes
- Topic reference snapshot export/import at init
- Editing template files on disk

UI shows the exact commands; `availableInRuntime: false` / `provisioned: false` — never fakes success.

---

## Tests

| Check | Result |
|-------|--------|
| API smoke (`smoke-forum-network-admin.mjs` on `forum_v7`) | **PASS** 9/9 |
| Draft Child blocks Forum A target | **PASS** |
| Draft does not provision | **PASS** |
| Browser UI screenshot / login walkthrough | **NOT VERIFIED** |
| Forum A/B | Untouched |
| i18n `fn*` en/vi parity | 108/108 keys matched |

Pre-existing `check-i18n.mjs` failures (`ledgerRewardIndivisible` empty) are unrelated to this task.

---

## Operator note

Open **Dashboard → Mạng lưới Forum**. To actually create a Child after the wizard draft:

```bash
# save draft JSON as forums/<id>.json, then:
node scripts/forum-network.mjs create-child --config forums/<id>.json --parent forums/<parent>.json --template default --free-months 2
```
