# RecallLens Product Passport

A signed, GS1 Digital Link-compatible product credential printed as a QR label.

## Contents

| Field | In QR | Notes |
|---|---|---|
| GTIN (AI 01) | ✓ path segment | public product identifier |
| Lot/batch (AI 10) | ✓ path segment | public lookup key |
| Expiration (AI 17) | ✓ path segment | YYMMDD |
| Passport ID | ✓ `rlp` query param | random 128-bit hex — the anti-brute-force entropy |
| Issuer ID | ✓ `iss` query param | `rl-demo-issuer-1` |
| Issuer credential ref | derived constant | `did:demo:recalllens:issuer:1` |
| Signature | ✓ `sig` query param | base64url ECDSA |

Example: `https://id.recalllens.demo/01/00810099110042/10/NFP-SHRED-26164-07/17/260628?rlp=…&iss=…&sig=…`

**Never on the passport:** lineage token, organization credential secret,
signing private key, wallet seed, EPCIS records, supply route. Enforced by a
unit test that scans the QR payload for secret material.

## Signature scheme

ECDSA **P-256 with SHA-256** via WebCrypto (`crypto.subtle`) — natively
available in every evergreen browser and Node ≥ 20, no additional dependency.
Canonical signed payload:
`rl-passport:v1|gtin|lot|expiry|passportId|issuer|issuerCredentialRef`.
Any field mutation (or signature truncation) fails verification — covered by
tamper tests, and surfaced to consumers as "PASSPORT SIGNATURE INVALID".

Demo issuer keys are a fixed, checked-in P-256 JWK so pre-printed labels stay
valid across resets. They are synthetic demo credentials (disclosed); in
production the issuer key lives in an HSM and rotates under the issuer's
credential.

## Commitment (hold membership)

`commitment = sha256("rl-passport-commit:v1" | gtin | lot | passportId)`

Because passportId is 128-bit random, the commitment cannot be brute-forced
from a predictable lot alone. The Sentinel hold anchors a set commitment over
these values; scanning checks membership (see ARCHITECTURE.md → "Hold
membership" for the demo resolver limitation).

## Verify-on-scan sequence

1. Parse GS1 identifiers from the Digital Link.
2. Verify the issuer ECDSA signature over the canonical payload.
3. Resolve product identity (USDA FDC enrichment when configured).
4. Check official recall sources (FDA advisory adapters).
5. Check Sentinel hold membership (chain-anchored commitment).
6. Check the authorized RecallLens recall predicate.
7. Return the strongest evidence level + evidence receipt.
