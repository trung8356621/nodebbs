# forum-pricing/1 — Ed25519 signing

## Algorithm

- **alg:** `Ed25519`
- **keyId:** opaque string (e.g. `fpk_v1`)
- **signature encoding:** unpadded base64url of the raw 64-byte signature

## Canonical bytes

1. Take the published snapshot object **without** the `signature` property.
2. Produce **canonical JSON**:
   - UTF-8
   - Object keys sorted lexicographically at every nesting level
   - No insignificant whitespace
   - Numbers as JSON numbers (integers only in this contract)
   - Timestamps as ISO-8601 strings with `Z`
3. Sign those UTF-8 bytes with the OPS private key.
4. Attach:

```json
"signature": {
  "alg": "Ed25519",
  "keyId": "fpk_v1",
  "value": "<base64url>"
}
```

## Verification (PBN)

1. Strip `signature`, canonicalize identically, verify with the public key for `keyId`.
2. Reject if `alg` ≠ `Ed25519`, unknown `keyId`, or verify fails.
3. Do **not** invent local prices when verification fails — fail closed / keep last good snapshot per offline policy.

## Key material

- Private key: OPS env `FORUM_PRICING_ED25519_PRIVATE_KEY` (base64url PKCS8) + `FORUM_PRICING_ED25519_KEY_ID`
- Public key: distributed in sync responses (`verification.publicKey`) and fixtures; never embed private key in PBN.
