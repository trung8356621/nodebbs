# forum-pricing/1 failure matrix

| Case | HTTP | error code | Notes |
|------|------|------------|-------|
| Missing/invalid Bearer | 401 | `unauthorized` | |
| Credential for other forum | 403 | `cross_forum_denied` | |
| No published catalog yet | 404 | `pricing_not_found` | |
| Unknown version | 404 | `pricing_version_not_found` | |
| Snapshot signature verify fail (client) | — | client-side | Fail closed |
| Package code unknown in version | 400 | `unknown_package` | |
| Client amount/credits ≠ catalog | 400 | `price_tamper` | |
| Quote expired | 400 | `quote_expired` | |
| Quote version ≠ request | 400 | `quote_version_mismatch` | |
| Free launch disabled in catalog | 400 | `free_launch_disabled` | |
| Free launch credits ≠ policy | 400 | `price_tamper` | |
| Paid order while commercialMode=free | 400 | `free_mode_requires_zero` | unchanged |
| Duplicate order reference | 200 | (idempotent return) | No second grant |
| Mutate published version (admin) | 400 | `version_immutable` | |
| Wrong API contract header (optional soft) | 400 | `contract_mismatch` | When header present and ≠ forum-pricing/1 or forum-credit/1 as applicable |
