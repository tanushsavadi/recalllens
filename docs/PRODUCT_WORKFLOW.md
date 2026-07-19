# RecallLens — Product Workflow

Plain language: **RecallLens lets food companies privately prove that their
records connect to the same safety risk. Investigators can contain and trace
the affected lineage without exposing complete supply chains, and consumers
can scan products against official recalls and privacy-preserving RecallLens
safety actions.**

Lifecycle: **DETECT EARLY → VERIFY PRIVATELY → CONTAIN QUICKLY → TRACE
PRECISELY → WARN CONSUMERS → PROVE REMOVAL**

## Roles (strictly separated; enforced server-side)

| | Investigator | Partner | Consumer |
|---|---|---|---|
| Sees official cases / opens investigations | ✓ | – | – |
| Sends private-match requests | ✓ | receives | – |
| Runs a proof | ✗ (request-only) | ✓ own proofs only, after scanning its own label and approving | ✗ |
| Sees partner vaults | ✗ | own vault only | ✗ |
| Approves disclosure fields | requests + decrypts | approves each field, encrypts in-browser | – |
| Issues hold / authorizes targeted action | ✓ (registrar-gated on-chain) | – | – |
| Scans products | – | shipment labels (own records) | ✓ |
| Reports removal | monitors | ✓ | – |

The investigator and partner surfaces show: "Demo role simulation: these
actors would use separate authenticated organizations and devices in
production." The Consumer Check reads as a plain consumer product.

Guards covered by tests: the legacy prove endpoint is removed (404); partner
approval without the partner's own scan is 403; a signal can only be approved
by its owning org (403); a consumer verify never touches proof submission.

## The trace flow

1. The investigator sends the final private-match request (`requested`).
2. The demo switches to Meridian's Partner Vault.
3. Meridian scans its physical shipment label; the GTIN + lot must resolve to
   a committed record OWNED by Meridian (`scanned`) — enforced server-side.
4. Meridian reviews the exact predicate and what becomes public vs stays
   private.
5. Meridian clicks "Approve and generate private proof" (`proving`).
6. A genuine `proveRelevantEvent` runs; the transaction settles on Midnight
   (`proven`).
7. The investigator reads 3/3 through the genuine indexer path.
8. UI: **"SHARED SUPPLY LINEAGE VERIFIED"** — with the calibrated copy that
   this narrows the investigation but does not establish contamination or
   causation.

## Sentinel (detect early)

A synthetic pre-outbreak replay, clearly badged. Threshold policy (shown in
the UI): at least 3 valid signal proofs, 2+ orgs, 2+ categories, 1+
high-confidence (QA) signal, same private lineage, valid window, duplicates
nullified. On-chain circuits: `openSentinelCase`, `submitSafetySignal`
(per-org nullifier, so 3 signals imply 3 distinct orgs),
`issuePrecautionaryHold`, `authorizeRecallPredicate`. Reaching the threshold
shows **"EARLY RISK CONVERGENCE DETECTED — not yet a confirmed outbreak"** —
never an official outbreak.

## Consumer Check (scan → confirm → verify → result)

1. **Scan** — camera (BarcodeDetector → ZXing fallback), image upload
   (barcode → local OCR fallback), or manual entry. All image processing is
   on-device; only the confirmed identifiers are transmitted.
2. **Confirm** — GTIN, lot, best-by, optional product name; the extraction
   method is shown; every field can be corrected.
3. **Verify** — precedence order (strongest wins): official FDA advisory →
   authorized RecallLens action → Midnight-anchored hold → no match.
4. **Result** — exactly one primary evidence level, with guidance, a safety
   disclaimer, and a full evidence receipt.

### Evidence levels

| Level | Headline | Trigger |
|---|---|---|
| EXACT_OFFICIAL_RECALL_MATCH | EXACT OFFICIAL RECALL MATCH | lot + a corroborating identifier match the official FDA advisory (live-or-cached, provenance shown) |
| PROOF_VERIFIED_PRECAUTIONARY_HOLD | SIGNED PASSPORT MATCHES A MIDNIGHT-ANCHORED HOLD | valid passport signature + membership in the active hold. Copy: "not an official government recall… does not prove that the product is contaminated" |
| AUTHORIZED_RECALL_MATCH | MATCHES TARGETED RECALL SCOPE | an investigator authorized the targeted RecallLens action after convergence + disclosure. Copy: "not an FDA recall… does not independently prove contamination" |
| POSSIBLE_ADVISORY_MATCH | POSSIBLE MATCH—VERIFY LOT | brand/category matches, lot unconfirmed |
| NO_VERIFIED_MATCH | NO VERIFIED MATCH FOUND | nothing matched. Mandatory copy: "This is not a guarantee that the product is safe." |
| INSUFFICIENT_DATA | INSUFFICIENT DATA / PASSPORT SIGNATURE INVALID | no usable identifiers, or a tampered passport |

### Evidence receipt

Every result ships a receipt: authority · official/network/synthetic kind ·
source and retrieval timestamps · live/cached status · fields matched and
missing · why this level · Midnight involvement (with the real tx id only
when a real chain event exists) · synthetic-data flag · exactly what left the
device · passport validity.

### Truthfulness rules encoded in the engine

- An exact official match outranks all network evidence.
- Network results only appear for a passport whose ECDSA signature verifies;
  tampered passports surface "PASSPORT SIGNATURE INVALID".
- "No verified match" never claims safety and uses neutral styling.
- A hold is never called a recall; a RecallLens action is never called an
  FDA recall.
- Midnight involvement is only reported when a real anchored event backs it.
- The receipt states that hold-membership resolution is service-side in this
  MVP (the hold commitment itself is on-chain).

## Encrypted minimum disclosure

The partner approves fields one by one → in-browser
ECDH(P-256) + HKDF + AES-256-GCM encryption to the investigator's key → only
ciphertext transits → the investigator decrypts in-browser →
**"RELEVANT SHIPMENT IDENTIFIED"** (no causation claim). Unapproved fields
never enter the plaintext, so they can never be decrypted later. The
authorization hash and ciphertext digest are recorded, and the send is
idempotent — a reload can never re-send.

## Targeted action and removal

"Review recall predicate…" shows the exact scope, hold commitment, effect,
and authority (a RecallLens network action — NOT an FDA recall). Confirming
runs a genuine `authorizeRecallPredicate` transaction. The server refuses
authorization before trace convergence AND a received disclosure, and it
cannot run twice. Partners then report quarantine/removal in their vaults —
shown as a **partner-reported, off-chain attestation**, never called
cryptographically verified.

## Demo commands

```bash
npm install                      # clean install
npm run devnet:up                # start the Midnight devnet (node/indexer/proof server)
npm run demo:reset               # clear deployment + workflow state
npm run demo:seed                # deploy + seed: Sentinel 2/3 signals, trace 2/3 proofs
npm run demo:api                 # API in live-devnet mode (:8787)
npm run dev:web                  # web app (:5173)
npm run health                   # verify node/indexer/proof-server/API
npm run test:contract            # 43 Compact simulator tests
npm test                         # all workspace suites
cd e2e && npx playwright test    # E2E (desktop + mobile)
npm run e2e:onchain              # independent genuine 3-proof convergence
```
