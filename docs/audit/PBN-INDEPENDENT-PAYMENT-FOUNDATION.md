# PBN Independent Bank Transfer Payment Foundation

**Date:** 2026-11-05  
**Machine:** DESKTOP — PBN (`D:\workspace-2026\pbn`)  
**Scope:** Credit top-up via personal bank transfer (SePay-first), sandbox/fixture only.  
**Limits honored:** No OPS-SERVER edits · No commit/push · No production payment activation · No real bank account connection · No second wallet.

---

## A. Audit summary

| Area | Finding | Action |
|------|---------|--------|
| Wallet / Ledger | Existing `sys_accounts` / `sys_transactions` via `extensions/ledger` (`credits` NUMERIC). `LedgerService.grant/deduct` already supports nested `tx` + VND snapshots. | **Reuse** — no new wallet. |
| VND / Credit rules | Forum-local `vnd_per_credit` (`forum_commercial_settings`) + `forum_credit_vnd_rate_history`. Exact conversion via `vndToCreditAmount`. | Apply **rate at confirm time**; snapshot on order + ledger metadata. |
| Credit display ratio | Admin-editable; history append-only; past txs not revalued. | Payment orders store `vnd_per_credit_applied`; never rewrite history. |
| Credit grant | OPS path: `ops_credit_grant` via `forum-credit` receiver (idempotent on `eventId`). Local rewards via ledger. | New type `bank_topup_grant` / ref `bank_payment_order`. |
| Transaction idempotency | OPS deliveries unique on `eventId`; ledger refs by `referenceType`+`referenceId`. | Payment events unique on `(provider, provider_event_id)`; orders unique on `idempotency_key`, `payment_code`, `(provider, provider_txn_ref)`. |
| Order / payment tables | Only OPS orders (`ops_forum_credit_orders`) — monetary authority was OPS. **No** independent bank payment tables before this work. | Added `pbn_topup_packages`, `pbn_payment_orders`, `pbn_payment_events`. |
| OPS integration | `forum-credit/1` + `forum-pricing/1` intact. Free Mode / local pricing already Forum-primary for services. | **Unchanged.** Independent payment is parallel, not a replacement for OPS enrollment. |

**Conclusion:** Foundation sits beside OPS credit delivery. Free Mode continues to zero commercial service prices without requiring top-up. Bank checkout stays gated OFF.

---

## B. Provider evaluation

| Provider | Fit | Pros | Cons / risk | Verdict |
|----------|-----|------|-------------|---------|
| **SePay** | Personal/business bank webhook + VietQR | HMAC-SHA256; payment-code extraction; transaction list API for reconcile; VietQR URL; well-documented Node samples | Requires public HTTPS webhook; personal IB credentials never stored (good) | **Primary adapter** |
| **Casso** | Similar bank webhook model | Mature VN market | Overlap with SePay; second integration cost | **Backup** — interface reserved, not implemented |
| **payOS** | QR / payment link | Strong checkout UX | More gateway-like; may imply different settlement | **Backup** — interface reserved, not implemented |

**SePay auth chosen:** HMAC-SHA256 (`X-SePay-Signature` + `X-SePay-Timestamp`, sign `{timestamp}.{rawBody}`, ±5 min replay window). API Key accepted as fallback for sandbox misconfig; production checklist requires HMAC.

**Out of scope permanently for this design:** storing Internet Banking passwords; auto-refund / outbound transfers; granting Credit from screenshot or browser redirect alone.

---

## C. Adapter architecture

```
User / Admin / Webhook
        │
        ▼
┌───────────────────────────┐
│  bank-payment extension   │
│  OrderService             │
│  WebhookService           │
│  reconcileEngine (pure)   │
└───────────┬───────────────┘
            │ PaymentProviderAdapter
            ├─ sepay.js      (createPaymentRequest, verifyWebhook,
            │                 normalizeTransaction, getPaymentStatus,
            │                 reconcilePayment)
            ├─ fixture.js    (sandbox / tests)
            └─ (future) casso.js / payos.js
            │
            ▼  only after match OK + mayGrantCredits
┌───────────────────────────┐
│  LedgerService.grant      │  ← unchanged; no SePay imports
│  sys_accounts / txs       │
└───────────────────────────┘
```

**Interface methods**

| Method | Role |
|--------|------|
| `createPaymentRequest` | Build payment code + VietQR URL + receive account |
| `verifyWebhook` | HMAC / API key + replay window → normalized tx or reject |
| `normalizeTransaction` | Provider payload → common shape |
| `getPaymentStatus` | Lookup by code / txn ref |
| `reconcilePayment` | Same as status; used by admin reconcile |

Ledger never imports SePay. Grant metadata links `orderId`, `providerTxnRef`, `bankTxnRef`, snapshotted `creditVnd` / `valueVnd`.

---

## D. Database / API proposal (implemented)

### Tables (`baseline/0011_bank_payment.sql`)

1. **`pbn_topup_packages`** — local VND packages (50k/100k/200k/500k seed).  
2. **`pbn_payment_orders`** — order id, user, requested/received VND, credits, rate snapshot, provider, bank refs, status, ledger tx id, sandbox flag, timestamps.  
3. **`pbn_payment_events`** — durable webhook/reconcile audit; unique `(provider, provider_event_id)`.

### APIs

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/bank-payment/status` | Flag visibility (auth) |
| GET | `/api/bank-payment/packages` | Gated by enabled/fixture |
| POST | `/api/bank-payment/orders` | Create pending + VietQR (public checkout OFF by default) |
| GET | `/api/bank-payment/orders/:orderId` | User-scoped |
| POST | `/payments/webhooks/sepay` | Raw-body HMAC; `{ success: true }` |
| POST | `/payments/webhooks/:provider` | Generic provider hook |
| GET | `/api/bank-payment/admin/config` | Admin; secrets as booleans only |
| PATCH | `/api/bank-payment/admin/flags` | Soft toggles (env still required for live grants) |
| POST | `/api/bank-payment/admin/reconcile/:orderId` | Provider API cross-check |
| GET | `/api/bank-payment/admin/orders/:orderId` | Admin order view |

### Credit top-up flow

1. User selects package (when public checkout ON).  
2. PBN creates pending/`awaiting_funds` order + unique `PBN########` code.  
3. VietQR shown (`qr.sepay.vn` with acc/bank/amount/des).  
4. User transfers.  
5. Provider webhook → verify HMAC → normalize.  
6. Match: receive account, payment code, amount, inbound only.  
7. Exact/overpay → confirm; underpay/wrong/unknown → no grant.  
8. If `mayGrantCredits` → single `ledger.grant` inside DB txn.  
9. Persist order + event; link `ledger_transaction_id`.  
10. Overpay: grant **ordered** Credit only; record excess; **no auto-refund**.

---

## E. Security & anti-duplication

| Control | Implementation |
|---------|----------------|
| HMAC / API key | SePay adapter `verifySePayWebhook` |
| Replay | Timestamp skew > 300s → reject |
| Idempotency | Order `idempotency_key`; event `(provider, provider_event_id)`; order `(provider, provider_txn_ref)` |
| Underpay | Status `underpaid`; no grant |
| Overpay | Grant requested amount; status `overpaid`; excess stored |
| Unknown order | Event kept; status `unmatched`; no grant |
| Wrong account / code | Fail closed; no grant |
| Late / duplicate webhook | `resolveLateOrDuplicate` + row lock `FOR UPDATE` |
| Provider offline | Reconcile returns `provider_offline`; no invent grant |
| No IB password storage | Config is webhook secret + API token + public account number only |
| No outbound money | Adapter has no payout/refund methods |
| Sandbox → prod wallet | `mayGrantCredits = enabled && (!sandbox \|\| SANDBOX_GRANT)`; default false |

---

## F. Free Mode

- Commercial services already force **0 VND** via `forum-local-pricing` Free Mode — users do **not** need to top up.  
- Bank checkout **`BANK_PAYMENT_PUBLIC` default false** — not publicly open.  
- Master **`BANK_PAYMENT_ENABLED` default false**.  
- Sandbox webhooks may record orders/events but **do not** call `ledger.grant` unless explicit `BANK_PAYMENT_SANDBOX_GRANT=true` (local only).  
- OPS free-grant path unchanged.

---

## G. Test results

```text
node --test apps/api/src/extensions/bank-payment/tests/bank-payment.test.js
ℹ tests 19
ℹ pass 19
ℹ fail 0
```

| Scenario | Result |
|----------|--------|
| Exact payment | **PASS** — grant decision + credits = VND÷rate |
| Underpay | **PASS** — no grant |
| Overpay | **PASS** — grant ordered only + excess |
| Wrong order code | **PASS** — no grant |
| Wrong receive account | **PASS** — no grant |
| Forged webhook (bad HMAC) | **PASS** — reject |
| Replay (old timestamp) | **PASS** — reject |
| Duplicate event id | **PASS** — no second grant |
| Retry / already complete | **PASS** |
| Late webhook after grant | **PASS** |
| Rate change after payment | **PASS** — completed orders not re-granted; new rate only for new matches |
| Provider offline | **PASS** (fixture) |
| Reconciliation inject | **PASS** (fixture) |
| Feature flag default OFF | **PASS** |
| VietQR URL build (no bank call) | **PASS** |

Fixtures: `contracts/bank-payment/v1/webhook-*.example.json`.  
**No real bank transactions were created.**

---

## H. Files added / touched

### New
- `apps/api/src/extensions/bank-payment/**` (extension, adapters, services, routes, tests)
- `apps/api/baseline/0011_bank_payment.sql`
- `contracts/bank-payment/v1/*.json`
- `docs/audit/PBN-INDEPENDENT-PAYMENT-FOUNDATION.md`

### Touched
- `apps/api/src/db/schema.js` — re-export bank-payment schema  
- `apps/api/.env.example` — commented SePay / flag vars  

### Not modified
- OPS-SERVER  
- `LedgerService` SePay coupling (none)  
- Production env flags (remain OFF)

---

## I. Checklist — activate payment after Free Mode

Do **not** flip these until PO explicitly approves a real receiving account.

1. [ ] PO approves SePay company + **personal/business** bank account linkage.  
2. [ ] Apply `0011_bank_payment.sql` on target Forum DB.  
3. [ ] Configure SePay payment-code template: prefix `PBN`, suffix length 8, alphanumeric.  
4. [ ] Create SePay webhook → `https://<forum-public>/payments/webhooks/sepay`, event **money in**, HMAC-SHA256.  
5. [ ] Set env: `SEPAY_WEBHOOK_SECRET`, `SEPAY_API_TOKEN`, `SEPAY_ACCOUNT_NUMBER`, `SEPAY_BANK_CODE`, `SEPAY_ACCOUNT_NAME`, optional `SEPAY_BANK_ACCOUNT_ID`.  
6. [ ] `BANK_PAYMENT_SANDBOX=false`, `BANK_PAYMENT_SANDBOX_GRANT=false`.  
7. [ ] `BANK_PAYMENT_ENABLED=true` on staging first; run exact/under/over/duplicate drills with small real amounts if PO allows.  
8. [ ] Confirm Free Mode policy: keep `BANK_PAYMENT_PUBLIC=false` until commercial launch; or enable public checkout deliberately.  
9. [ ] Verify HTTPS callback reachable; IP allowlist optional hardening.  
10. [ ] Admin reconcile smoke test on one paid order.  
11. [ ] Confirm ledger rows show `bank_topup_grant` + VND snapshot; changing `vnd_per_credit` later does not rewrite them.  
12. [ ] Document support runbook for underpay / overpay / unmatched.  
13. [ ] Only then enable production public checkout.

---

## J. SePay account configuration checklist

| Item | Where / notes |
|------|----------------|
| SePay company account | my.sepay.vn |
| Linked bank account number | → `SEPAY_ACCOUNT_NUMBER` |
| Bank short name / code (VietQR) | → `SEPAY_BANK_CODE` (e.g. `Vietcombank`) |
| Account holder display name | → `SEPAY_ACCOUNT_NAME` |
| Bank account UUID (API filter) | → `SEPAY_BANK_ACCOUNT_ID` (from SePay API) |
| API Token (Bearer) | → `SEPAY_API_TOKEN` / `SEPAY_API_KEY` |
| Webhook URL | `https://<FORUM_PUBLIC_ORIGIN>/payments/webhooks/sepay` |
| Webhook auth | **HMAC-SHA256** → `SEPAY_WEBHOOK_SECRET` (copy once) |
| Event type | Money in only |
| Payment code structure | Prefix `PBN`, min/max suffix 8, alphanumeric |
| Webhook filter | Prefer “only when payment code present” + prefix `PBN` |
| VietinBank note | If used, transfer memo may require `SEVQR` per SePay docs — validate before go-live |
| Never store | Internet Banking username/password |

---

## K. Residual risks / follow-ups

1. DB migration not auto-applied on all Forum instances — run baseline SQL before enabling.  
2. Admin UI for packages / order console not built (API-only foundation).  
3. Casso / payOS adapters are interface-ready stubs only.  
4. TTL expiry sweeper registered as noop placeholder — implement if pending orders accumulate.  
5. Unique index on `(provider, provider_txn_ref)` allows multiple NULL pending rows (PG default); first confirm wins the ref.  
6. Live SePay E2E blocked until PO allows real account + public HTTPS.

---

*End of report. Payment feature flag remains OFF.*
