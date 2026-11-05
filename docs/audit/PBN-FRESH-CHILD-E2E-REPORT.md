# PBN Fresh Child Forum — Provisioning & Functional E2E Report

**Date:** 2026-11-05 (Asia/Bangkok)  
**Machine:** DESKTOP — PBN (`D:\workspace-2026\pbn`)  
**Timebox:** ~20 minutes (API/CLI first; one browser pass)  
**Git:** No commit / no push  
**Forum A (`pbn_dev`) / Forum B (`pbn_forum_b`):** not migrated, seeded, or admin-written for this task  

---

## Fixture summary

| Field | Value |
|-------|-------|
| Forum ID | `forum_e2e_new` |
| Registry config | `forums/forum-e2e-new.json` |
| Database | `pbn_forum_e2e_new` (new; not reused) |
| Web | `http://127.0.0.1:3900` |
| API | `http://127.0.0.1:7900` |
| Parent | `forum_p` / `pbn_forum_p` (`:3400` / `:7400`) |
| Template | `default` |
| Free Mode | enabled; expires **2027-01-05T07:35:25.854Z** (~2 months) |
| OPS / Installation Key | not required |
| Admin | `trung93` created **fresh in Child DB** (bcrypt hash generated locally; not copied from Forum A) |
| Credentials in Git | none (handoff metadata only under `.local/forums/forum_e2e_new/admin.json`, no password field) |

**Create-child report:** `.local/forums/forum_e2e_new/network-reports/create-child-1793864126138.json`  

Provisioning steps all **ok**: validate → parent_ready → configure → create_db → migrate_baseline (v1…v7) → migrate_forward (skipped; baseline v7 already includes commercial/network) → seed → admin → apply_template → apply_managed_policy → topic_refs → link_parent_child → health.

---

## Overall verdict

**PASS with notes** — Child provisioned and core functional paths verified. First automated pass had several false FAILs from wrong API routes / schema assumptions; supplemental probes corrected those without re-touching Forum A/B.

| Bucket | Result |
|--------|--------|
| Provisioning | **PASS** |
| Auth / RBAC | **PASS** |
| Forum content | **PASS** (after route correction) |
| Credit & rewards | **PASS** |
| Paid Pin / Free Mode | **PASS** (expire via allowed status fixture) |
| Parent/Child | **PASS** |
| Payment (sandbox / flag OFF) | **PASS** (Admin API + Ledger payments tab; dedicated `/dashboard/payment` 404) |
| VI/EN i18n | **PASS** on home / dashboard / ledger / forum-network; payment screenshot was 404 page |
| Browser login form | **BLOCKED** (one attempt); admin dashboard pages still loaded in same pass |

Machine-readable: [PBN-FRESH-CHILD-E2E-RESULTS.json](./PBN-FRESH-CHILD-E2E-RESULTS.json), [PBN-FRESH-CHILD-E2E-SUPPLEMENT.json](./PBN-FRESH-CHILD-E2E-SUPPLEMENT.json)

---

## A. Provisioning checklist

| Step | Status |
|------|--------|
| Configure (local secrets) | PASS |
| Create database `pbn_forum_e2e_new` | PASS (refused-if-exists guard) |
| Baseline migrate v1–v7 | PASS |
| Forward patches 0005–0012 | PASS (skipped — included in baseline v7) |
| Seed | PASS |
| Create Admin (`trung93`) | PASS (post-provision PO handoff; fresh hash) |
| Apply template `default` + Free Mode 2 months | PASS |
| Init Parent/Child relationship | PASS |
| Topic reference snapshot | PASS (3 refs) |
| Health | PASS (`networkRole=child`, Free Mode on, OPS not required) |

Ports/DB uniqueness checked against registry before create (`3900`/`7900` unused; DB did not exist).

---

## B. Functional results

### 1. Authentication — PASS

| Check | Status | Notes |
|-------|--------|-------|
| Admin login | PASS | API `/api/auth/login` |
| Session `/api/auth/me` | PASS | `role=admin` |
| Admin settings / ledger APIs | PASS | |
| Regular user denied admin reward-rules | PASS | GET/PATCH → 403 |
| Browser login form | BLOCKED | Single attempt; selectors/redirect unclear within 15s |

### 2. Forum content — PASS

| Check | Status | Notes |
|-------|--------|-------|
| Register test users | PASS | `e2en_*@example.test` |
| Create topic | PASS | |
| List / show topic | PASS | |
| Comment / reply | PASS* | Correct route: `POST /api/posts` (+ `topicId`). Reply costs Credit (`post_reply_amount`). |
| Edit own post | PASS* | Correct route: `PATCH /api/posts/:id` |
| Like | PASS | |
| Categories | PASS | General |

\*First pass marked FAIL due to wrong routes (`/topics/:id/posts`, `PUT /posts/:id`); supplemental probes PASS.

### 3. Credit & rewards — PASS

| Check | Status | Notes |
|-------|--------|-------|
| Wallet | PASS* | `/api/ledger/balance` or `/accounts` (`/ledger/me` 404) |
| Check-in | PASS | 6→7 Credit |
| Same-day idempotent | PASS | no double pay |
| Streak via fake clock | PASS | `PBN_ALLOW_ACTIVITY_CLOCK=1`; 7→8.5 |
| Topic create reward | PASS | tx count + balance increased |
| Like reward + retry | PASS | no double grant on retry |
| Toggle rule off | PASS | disabled check-in → 0 grant |
| Transaction history | PASS | |

### 4. Paid Pin / Free Mode — PASS

| Check | Status | Notes |
|-------|--------|-------|
| Free Mode on | PASS | expires 2027-01-05 |
| Activate pin | PASS | `pricing_authority=forum-free-mode`, `price=0` |
| Listed / entitlement | PASS* | `pin_entitlements` + `topics.is_pinned` (no `pinned_until` column) |
| Duration | PASS | `duration_seconds=86400` (1 day) |
| No Credit deducted | PASS | balance unchanged |
| Activation history | PASS | entitlement row |
| Expire without OS clock | PASS* | `status/reason` update only — `ends_at` immutable by DB guard |

### 5. Parent/Child — PASS

| Check | Status | Notes |
|-------|--------|-------|
| Child role / template services | PASS | |
| Managed policy version | PASS* | `forum_network_policy_applications` |
| Local setting preserved | PASS | `free_mode.e2eLocalMarker` survived policy apply |
| Topic refs not public topics | PASS | 3 snapshots, 0 title leaks |
| Parent offline → Child works | PASS | Parent stopped; Child `/auth/me` + local-pricing 200 |

### 6. Payment — PASS (scoped)

| Check | Status | Notes |
|-------|--------|-------|
| Admin Payment API | PASS | packages + overview |
| Sandbox | PASS | `sandbox=true` |
| Feature flag OFF | PASS | `enabled=false`, `publicCheckout=false` |
| Packages visible (admin) | PASS | |
| No public checkout | PASS | checkout gated |
| No real ACB / no prod Credit grant | PASS | API-only; no transfer |
| Dedicated `/dashboard/payment` page | FAIL/absent | **404** — UI lives at `/dashboard/ledger?tab=payments` |

### 7. VI/EN — PASS with note

| Surface | Status | Screenshot |
|---------|--------|------------|
| Home VI | PASS | `docs/audit/screenshots/fresh-child-e2e/home-vi.png` |
| Home EN | PASS | `docs/audit/screenshots/fresh-child-e2e/home-en.png` |
| Admin Dashboard | PASS | `.../dashboard.png` |
| Ledger | PASS | `.../ledger.png` |
| Forum Network | PASS | `.../forum_network.png` |
| Payment | BLOCKED/note | `.../payment.png` is the **404** page for `/dashboard/payment` |

No raw i18n keys observed on home / dashboard / ledger / forum-network in the browser pass.

---

## C. Issues found

1. **Wrong first-pass API assumptions (test harness, not product regressions):** reply is `POST /api/posts`; edit is `PATCH`; wallet is `/ledger/balance`; policy table is `forum_network_policy_applications`; topics have `is_pinned` only.
2. **Reply costs Credit** (`post_reply_amount`) — new users need wallet balance before commenting (by design).
3. **No standalone `/dashboard/payment` route** — Payment admin UI is Ledger tab `payments`.
4. **Pin `ends_at` is immutable** — expiry E2E must use status/reason fixture or wait for calendar reconcile; do not UPDATE term columns.
5. **Browser admin login form** — one attempt BLOCKED within 15s timeout; follow-up dashboard navigations still returned 200 (cookie/session may already have been set via API context or soft redirect).

---

## D. Features not fully exercised / left for PO

- Manual browser login as `trung93` on `http://127.0.0.1:3900` (password from PO; not stored in Git).
- Ledger **Payments** tab UI click-through (`/dashboard/ledger?tab=payments`).
- Calendar pin auto-expire via `/api/pins/admin/reconcile` after real `ends_at` (1-day Free Mode pin).
- Cross-forum isolation stress beyond Parent offline smoke.

---

## E. Runtime left for PO

Child fixture **kept running** for browser verification:

- Web: http://127.0.0.1:3900  
- API: http://127.0.0.1:7900  
- DB: `pbn_forum_e2e_new` (not dropped)

Parent was started only for the offline test and then stopped. Forum A/B processes were not restarted/killed for this task.

---

## F. Safety

- No Installation Key / OPS-SERVER dependency.
- No password printed in report or committed files.
- No copy of Forum A admin hash/users.
- No commit / no push.
- No DROP of the new database.
