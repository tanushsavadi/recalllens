# RecallLens — Product Workflow

Plain language: **RecallLens lets food companies privately prove that their
records connect to the same safety risk. Investigators can contain and trace
the affected lineage without exposing complete supply chains, while consumers
can scan products against official recalls and proof-verified precautionary
holds.**

Lifecycle: **DETECT EARLY → VERIFY PRIVATELY → CONTAIN QUICKLY → TRACE
PRECISELY → WARN CONSUMERS → PROVE REMOVAL**

## Roles (strictly separated; enforced server-side)

| | Investigator | Partner | Consumer |
|---|---|---|---|
| Sees official cases / opens investigations | ✓ | – | – |
| Sends private-match requests | ✓ | receives | – |
| Runs a proof | ✗ (request-only) | ✓ own proofs only, after scanning own label + approving | ✗ |
| Sees partner vaults | ✗ | own vault only | ✗ |
| Approves disclosure fields | requests + decrypts | approves each field, encrypts in-browser | – |
| Issues hold / authorizes recall | ✓ (registrar-gated on-chain) | – | – |
| Scans products against recalls/holds | – | shipment labels (own records) | ✓ |
| Confirms removal | monitors | ✓ | – |

Every role surface shows: “Demo role simulation: these actors would use
separate authenticated organizations and devices in production.”

Guards verified by tests: `/api/case/prove` is REMOVED (404); partner approval
without the partner's own scan → 403; a signal can only be approved by its
owning org → 403; consumer verify never touches proof submission.

## The corrected trace flow (was: consumer scan ran Meridian's proof)

1. Investigator sends the final private-match request (`requested`).
2. Demo switches to Meridian's Partner Vault (explicit role banner).
3. Meridian scans the physical shipment label; GTIN+lot must resolve to a
   committed record OWNED by Meridian (`scanned`) — enforced server-side.
4. Meridian reviews the exact predicate + what becomes public vs stays private.
5. Meridian clicks “Approve and generate private proof” (`proving`).
6. Genuine `proveRelevantEvent` runs; tx settles on Midnight (`proven`).
7. Investigator reads 3/3 through the genuine indexer path.
8. UI: **“SHARED SUPPLY LINEAGE VERIFIED”** (never “common origin”), with the
   calibrated copy that this narrows the investigation but does not establish
   contamination or causation.

## Sentinel (detect early)

Synthetic pre-outbreak replay, clearly badged. Threshold policy (transparent,
shown in UI): ≥3 valid signal proofs, ≥2 orgs, ≥2 categories, ≥1
high-confidence (QA) signal, same private lineage, valid window, duplicates
nullified. On-chain circuits: `openSentinelCase`, `submitSafetySignal`
(per-org nullifier ⇒ 3 signals imply 3 distinct orgs),
`issuePrecautionaryHold`, `authorizeRecallPredicate`. Reaching the threshold
opens a CONFIDENTIAL_SENTINEL_CASE (“EARLY RISK CONVERGENCE DETECTED — not yet
a confirmed outbreak”), never an official outbreak.

## Consumer evidence levels (exactly one primary level per scan)

1. `EXACT_OFFICIAL_RECALL_MATCH` — lot + corroborating identifier match the
   official FDA advisory (live-or-cached, provenance shown).
2. `PROOF_VERIFIED_PRECAUTIONARY_HOLD` — valid passport signature + membership
   in the Midnight-anchored hold. “Not yet an official government recall.”
3. `AUTHORIZED_RECALL_MATCH` — “AFFECTED PRODUCT CONFIRMED”, RecallLens
   demonstration recall, explicitly “not an FDA recall”.
4. `POSSIBLE_ADVISORY_MATCH` — brand/category matches, lot unconfirmed.
5. `NO_VERIFIED_MATCH` — with “this is not a guarantee that the product is
   safe.”
6. `INSUFFICIENT_DATA` — inadequate identifiers (incl. tampered passports).

Every result ships an **Evidence receipt**: authority, official/network/
synthetic, source + retrieval timestamps, fields matched/missing, why this
level, Midnight involvement + tx, synthetic flag, and what left the device.

## Encrypted minimum disclosure

Partner approves fields individually → in-browser ECDH(P-256)+HKDF+AES-256-GCM
encryption to the investigator's key → ONLY ciphertext transits → investigator
decrypts in-browser → “PROBABLE SOURCE NARROWED” (no causation claim).
Unapproved fields never enter the plaintext. Authorization hash + ciphertext
digest recorded.

## Demo commands

```bash
npm install                      # clean install
npm run devnet:up                # start Midnight devnet (node/indexer/proof server)
npm run demo:reset               # clear deployment + workflow state
npm run demo:seed                # deploy Sentinel-enabled contract; seed:
                                 #   2 signal proofs (QA + cold-chain) pre-submitted
                                 #   2 trace proofs pre-submitted → 2/3
npm run demo:api                 # API in live-devnet mode (:8787)
npm run dev:web                  # web app (:5173)
npm run health                   # verify node/indexer/proof-server/API
npm run test:contract            # 43 Compact simulator tests
npm test                         # all workspace suites
cd e2e && npx playwright test    # 20 E2E tests (desktop + mobile)
npm run e2e:onchain              # independent genuine 3-proof convergence
```

DEMO A (official consumer recall): Consumer Check → enter/scan the FDA
blueberries test card identifiers → EXACT OFFICIAL RECALL MATCH with FDA
provenance. No Midnight claim is made.

DEMO B (end-to-end): Sentinel (approve 3rd signal as QuickServe → threshold →
issue hold) → Consumer scan lettuce passport → PROOF-VERIFIED PRECAUTIONARY
HOLD → Investigation (send request) → Vault as Meridian (scan label → approve →
genuine proof → 3/3) → “SHARED SUPPLY LINEAGE VERIFIED” → encrypted disclosure
→ authorize demonstration recall → consumer re-scan → AFFECTED PRODUCT
CONFIRMED → partners confirm removal.
