# RecallLens Sentinel — Architecture

Sentinel is the early-warning layer: it detects **corroborated,
privacy-preserving risk convergence**. It does not predict or diagnose an
outbreak, and the demo runs as a clearly labeled **synthetic pre-outbreak
replay**.

## Signal categories (demo set)

| Category | Circuit code | Owner (synthetic) | Confidence |
|---|---|---|---|
| PROCESSOR_QA_SIGNAL | 1 | Northstar Fresh Processing | high |
| COLD_CHAIN_SIGNAL | 2 | Meridian Cold Chain | standard |
| EXPOSURE_CLUSTER_SIGNAL | 3 | QuickServe (consumer-aggregate) | standard |

Raw signal evidence (test values, temperatures, complaint details, locations,
timestamps) stays private — only the derived tag, nullifier, and category
counters reach the ledger.

## Threshold policy (transparent; shown in the UI)

≥ 3 valid signal proofs · ≥ 2 independent credentialed organizations ·
≥ 2 different categories · ≥ 1 high-confidence (QA) signal · same private
lineage · valid time window · duplicates rejected by nullifiers.

Implementation note: the signal nullifier is per **(caseId, orgSecret)** — one
signal per org per case — so 3 accepted signals necessarily come from 3
distinct orgs (the ≥2-orgs clause is implied; documented in the contract's
SECURITY NOTES). Category diversity is tracked with per-category seen-flags;
the threshold flips in-circuit when count ≥ 3 ∧ categories ≥ 2 ∧ QA seen.

## On-chain state (public, minimal)

`sentinelCases` (caseId → productHash/window/open) · `signalCount[tag]` ·
`sentinelQaSeen/ColdSeen/ExposureSeen[tag]` · `sentinelNullifiers` ·
`sentinelThresholdReached[tag]` · `holds[caseId → holdCommitment]` ·
`recallAuthorizations[caseId → predicateHash]`.

## Circuits

- `openSentinelCase` — registrar-gated case definition.
- `submitSafetySignal(caseId, category)` — in-circuit: org registry membership
  (Merkle, leaf-bound), signal-commitment membership (same tree, domain
  separator `rl:signal:v1`), category ∈ 1..3 and equals the public arg,
  product + window predicate, `sentinelTag = H("rl:stag:v1", caseId,
  lineageToken)` disclosed, `signalNullifier = H("rl:snull:v1", caseId,
  orgSecret)` disclosed + freshness, counters/flags/threshold updates.
- `issuePrecautionaryHold(caseId, sentinelTag, holdCommitment)` —
  registrar-gated; requires `thresholdReached[tag]`. The hold commitment is a
  set commitment over passport commitments (sha-256 over the sorted member
  list, computed off-chain).
- `authorizeRecallPredicate(caseId, predicateHash)` — registrar-gated;
  requires an existing hold.

## Hold membership (demo design + limitation)

Passport commitments are high-entropy (`sha256("rl-passport-commit:v1" | gtin
| lot | passportId)` with a random 128-bit passportId) so membership cannot be
brute-forced from a guessable lot. The **hold-set commitment** is anchored
on-chain; the demo resolver checks a scanned passport's commitment against the
member set service-side. Production would replace the resolver with a
membership proof (Merkle witness or PSI) so the service never learns the
queried commitment — documented limitation, stated in JUDGE_FAQ.

## Role-correct replay sequence (~90s)

1. Replay starts with 2 pre-submitted signal proofs (QA + cold-chain, real txs
   from seeding).
2. Investigator requests the final signal review.
3. Switch to the QuickServe consumer-aggregate role; review the exact signal
   predicate; approve.
4. Genuine `submitSafetySignal` settles (live tx id shown).
5. Threshold → "EARLY RISK CONVERGENCE DETECTED … not yet a confirmed
   outbreak."
6. Investigator issues the hold → genuine `issuePrecautionaryHold` tx.
7. Consumer scans the signed lettuce passport → PROOF-VERIFIED PRECAUTIONARY
   HOLD.
