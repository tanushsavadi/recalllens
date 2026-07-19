# RecallLens — Privacy Audit

This document is the authoritative account of what RecallLens makes public, what
stays private, every `disclose()` in the Compact contract, and what the
zero-knowledge proof does and does not establish. It was cross-checked by an
independent fresh-context verifier (see docs/EVIDENCE.md).

Contract: `packages/contract/src/recalllens.compact`.

## 1. Public ledger state — every field and why it must be public

| Ledger field | Type | Why public |
|---|---|---|
| `orgRegistry` | HistoricMerkleTree<10, Bytes<32>> | Registered org credential *commitments* (opaque hashes). A Merkle tree so membership can be proven without revealing WHICH org proves. |
| `eventTree` | HistoricMerkleTree<10, Bytes<32>> | Pre-committed trace-event *commitments* (opaque, hiding). A Merkle tree so a match proof never reveals WHICH event matched. |
| `cases` | Map<Bytes<32>, CaseInfo> | Outbreak case definitions are official published facts (source hash, product predicate, time window, open flag). |
| `matchCount` | Map<Bytes<32>, Counter> | The count of distinct-org verified matches per anonymous case tag — the convergence signal. |
| `orgNullifiers` | Set<Bytes<32>> | Nullifiers MUST be public: publishing them is exactly what prevents one credential from counting twice. |
| `converged` | Map<Bytes<32>, Boolean> | The public result: did enough distinct orgs converge on this lineage tag. |
| `threshold` | sealed Uint<64> | Convergence threshold (3), fixed at deploy. |
| `registrarCommitment` | sealed Bytes<32> | Commitment to the registrar credential; the public trust anchor for who may admit orgs / open cases. Opaque hash. |

Nothing here contains a supplier name, customer, lot code, quantity, route,
invoice, temperature, receipt, or patient identity.

## 2. Private state — witness / runtime fields (never on-chain)

Held only in the prover's local private state (`RecallLensPrivateState`) or the
browser vault / server fixtures:

- `orgSecret` — registered org credential secret (the "one org, one count" anchor)
- `registrarSecret` — registrar credential secret (admission authority)
- `TraceEvent.lineageToken` — random 256-bit lineage token (anonymity anchor)
- `TraceEvent.productHash` — product predicate value (compared, never revealed)
- `TraceEvent.eventTime` — exact event timestamp (only in-range is proven)
- `TraceEvent.blinding` — per-event commitment blinding
- Merkle authentication paths for the event and org trees

Runtime domain data that never enters a circuit at all: supplier/customer GLNs,
lot codes, quantities, routes, facilities, temperatures, invoices, consumer
identities and receipts (EPCIS fields in `packages/schemas/src/epcis.ts`).

## 3. Every `disclose()` site (exhaustive)

| Circuit | Disclosed value | Classification |
|---|---|---|
| constructor | `threshold`, `registrarCommitment` | public config / opaque hash |
| `registerOrganization` | `orgCommitment` | opaque hash (no secret) |
| `commitTraceEvent` | `eventCommitment` | opaque hash (Merkle-leaf hashed again) |
| `openCase` | `caseId`, `windowStart<=windowEnd` bool, `CaseInfo` fields | all public case facts |
| `closeCase` | `caseId` | public |
| `proveRelevantEvent` | `caseId` (public arg) | public |
| `proveRelevantEvent` | bool `eventPath.leaf == eventCommitment` | necessarily true on success |
| `proveRelevantEvent` | `merkleTreePathRoot(eventPath)` — a **Bytes<32> root** | leaf-independent tree root; hides which leaf |
| `proveRelevantEvent` | bool `orgPath.leaf == orgCommitment` | necessarily true on success |
| `proveRelevantEvent` | `merkleTreePathRoot(orgPath)` — a **Bytes<32> root** | leaf-independent tree root; hides which org |
| `proveRelevantEvent` | bool `productHash == case.productHash` | necessarily true |
| `proveRelevantEvent` | bool `eventTime >= windowStart` | necessarily true |
| `proveRelevantEvent` | bool `eventTime <= windowEnd` | necessarily true |
| `proveRelevantEvent` | `caseTag = H("rl:tag:v1", caseId, lineageToken)` | hash of 256-bit random token |
| `proveRelevantEvent` | `orgNullifier = H("rl:null:v1", caseId, orgSecret)` | hash of high-entropy secret |

**Raw event fields (`lineageToken`, `orgSecret`, `registrarSecret`, `blinding`,
`eventTime`, the event's `productHash` value) are NEVER disclosed.** The two
disclosed Merkle roots are leaf-independent — they identify the tree state, not
the matching leaf.

### Sentinel circuits (product rework)

| Circuit | Disclosed value | Classification |
|---|---|---|
| `openSentinelCase` | `caseId`, `SentinelCaseInfo` fields, window-order bool | public case definition |
| `submitSafetySignal` | `caseId`; `category` (1–3 — intentionally public so the diversity/QA policy is auditable); two leaf-independent Merkle roots; `sentinelTag = H("rl:stag:v1", caseId, lineageToken)`; `signalNullifier = H("rl:snull:v1", caseId, orgSecret)`; success-only booleans | tag/nullifier are hashes of high-entropy secrets |
| `issuePrecautionaryHold` | `caseId`, `sentinelTag`, `holdCommitment` | opaque set commitment |
| `authorizeRecallPredicate` | `caseId`, `predicateHash` | opaque hash |

Never disclosed by Sentinel: which org signaled, the raw test/temperature/
exposure values, exact signal times, locations, or the lineage token. The
signal nullifier is per-(case, org) — one signal per org per case — so
duplicate/inflation attempts are publicly rejected while orgs stay unlinkable
across cases.

### Passport & disclosure crypto (off-chain)

- Product Passport QR: GTIN, lot, expiry, random 128-bit passportId, issuer id,
  ECDSA P-256 signature. NO lineage token, secrets, or keys (unit-tested).
- Hold membership commitment: `sha256("rl-passport-commit:v1"|gtin|lot|
  passportId)` — not brute-forceable from a guessable lot alone.
- Selective disclosure: partner-approved fields only, encrypted in-browser
  (ephemeral ECDH P-256 → HKDF → AES-256-GCM); ciphertext-only transit;
  rejected fields never enter the plaintext (unit + API-tested). Demo keys are
  checked-in synthetic credentials (disclosed); production uses managed keys.

Note: `disclose()` in Compact makes a value part of the public transcript. It
does NOT encrypt. Every disclosed value above was chosen deliberately.

## 4. Linkability analysis

- **caseTag** is a per-case pseudonym for a lineage. All proofs sharing a
  lineage token for one case produce the same public `caseTag` — that
  *intentional* linkability is the convergence signal. Because
  `caseTag = H(caseId, lineageToken)`, the same lineage across *different* cases
  yields unlinkable tags (domain separation by caseId).
- **orgNullifier** is unlinkable across cases (domain-separated by caseId).
  Within one case, repeated attempts by the same org are intentionally linkable
  — that IS the double-count defense.
- **Anonymity-set size:** hiding of "which event/org proved" is only as strong
  as the number of committed events / registered orgs. The demo seeds a small
  set (3–4), so timing/count correlation can narrow it. Production deployments
  should maintain a healthy anonymity set. Documented in THREAT_MODEL.
- **Historic-root disclosure:** `checkRoot` accepts historic roots; a prover
  using a stale root would reveal the matched leaf existed at that snapshot. The
  shipped witness always builds paths from the current tree, so live code does
  not leak this, but freshness is not forced in-circuit.

## 5. Dictionary-attack analysis

`caseTag` and `orgNullifier` are hashes of high-entropy secrets:

- `lineageToken` is a random 256-bit value propagated with the physical lot —
  NOT a hash of a guessable lot code. An adversary cannot enumerate lineage
  tokens to unmask a tag.
- `orgSecret` / `registrarSecret` are 256-bit credential secrets.

Caveat: the *demo fixture* secrets are constants checked into a public repo, so
the demo values are of course reproducible by anyone. This is fine for a
reproducible demonstration and is disclaimed in the fixtures. The accurate
privacy claim is **"zero raw partner records written to the public ledger"**,
not "these fixture values were never published."

## 6. Nullifier behavior

`orgNullifier = H("rl:null:v1", caseId, orgSecret)`, derived in-circuit from the
witness `orgSecret` that was proven to be a *registered* credential (Merkle
membership in `orgRegistry`). Before counting, the circuit asserts the nullifier
is not already in `orgNullifiers` and then inserts it. Effects:

- One credential cannot advance a case's match count more than once.
- Three matches require three *distinct registered credentials*.
- Admission of those credentials is gated by the registrar (see THREAT_MODEL) —
  this is what makes "3 independent credentialed organizations" defensible.

## 7. What the proof establishes

A successful `proveRelevantEvent` proves, in zero knowledge, that:

1. the prover holds a trace event whose commitment is in the public event tree;
2. the prover holds a credential secret whose commitment is in the public org
   registry (i.e. a registrar-admitted organization);
3. that event's product predicate equals the case's, and its timestamp falls in
   the case's public window;
4. the disclosed `caseTag` is `H(caseId, lineageToken)` for that event's lineage;
5. the disclosed `orgNullifier` is fresh for this case.

## 8. What the proof CANNOT establish

- That the physical shipment actually occurred.
- That a pathogen was present.
- That the product caused any illness.
- That the organization entered truthful data originally.

RecallLens improves input integrity through registered credentials,
pre-investigation commitments, and a registrar trust anchor — but a
zero-knowledge proof of "authenticated records satisfy these predicates" is not
a proof of physical-world truth or causation. Epidemiological and laboratory
evidence determines whether a converged lineage caused an outbreak. This
disclaimer appears in the product UI and the demo narration.
