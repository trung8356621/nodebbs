# forum-pricing/1

OPS-SERVER owns all monetary Forum/PBN pricing. Every Forum shares one product-scoped catalog. Published versions are immutable and Ed25519-signed.

| Concern | Owner |
|---------|--------|
| VND↔Credit conversion, packages, SEO service credits, paid-pin credits, free-launch policy | OPS-SERVER |
| Catalog draft/edit/publish + signature | OPS-SERVER |
| Authenticated catalog sync | OPS → PBN (Bearer per installation) |
| Credit wallet balance & spend | PBN |
| Credit grant delivery / ledger | `forum-credit/1` (unchanged) |
| Real-money payment confirmation | OPS-SERVER |

See `protocol.md`, `signing.md`, `failure-matrix.md`, and JSON fixtures in this folder.
