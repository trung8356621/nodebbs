# Forum Pricing — Contract Adjustments (pre-implementation)

**Date:** 2026-11-03  
**Status:** OPS-SERVER defines `forum-pricing/1` because PBN artifacts were absent.

## Missing inputs

| Expected path | Status |
|---------------|--------|
| `docs/forum-pricing-protocol-handoff.md` (from PBN) | **Not present** in ops-server |
| `contracts/forum-pricing/v1/` (from PBN) | **Not present** |
| Prior “Centralized forum pricing catalog” agent run | Aborted before producing files |

## Architecture comparison vs existing OPS

| Topic | Prior forum-credit/1 | Pricing V1 decision |
|-------|----------------------|---------------------|
| Credit package pricing owner | Handoff said **PBN** | **OPS-SERVER** (mandatory) |
| Arbitrary `amountVnd` / `creditsToGrant` on order create | Allowed | **Rejected** unless exact match to published package / free-launch policy |
| Snapshot auth | N/A (HMAC elsewhere; Forum uses Bearer) | **Ed25519** signed published snapshots; machine sync still uses per-forum Bearer |
| Catalog scope | N/A | **Shared** across all Forums (product `pbn`), not per-installation prices |
| SEO `services` / `service_plans` | Unrelated | **Untouched** — Forum SEO-service & paid-pin SKUs live in pricing snapshot JSON only |
| ZYVAVU | Separate | **Isolated** — no shared tables/APIs |
| forum-credit/1 delivery & ledger | Live | **Preserved** — pricing is additive; delivery payload unchanged except credits come from OPS-validated orders |

## Adjustments OPS will publish for PBN

1. Contract directory owned by OPS: `contracts/forum-pricing/v1/`.
2. Handoff rewritten as **OPS → PBN**: `docs/forum-pricing-protocol-handoff.md`.
3. forum-credit handoff ownership row “Credit package pricing → PBN” superseded by pricing V1 (documented, not deleting credit protocol).
4. Credit order create body gains `packageCode` / `quoteId` / `pricingVersion` / `freeLaunch`; raw monetary bypass removed for paid top-ups.
5. If PBN later supplies a differing contract, diff against `contracts/forum-pricing/v1/` and amend via explicit revision — do not silently fork.
