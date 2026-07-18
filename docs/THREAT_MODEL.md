# RecallLens — Threat Model

Scope: the Compact contract, the proof flow, the public-data API, and the demo
data. This is an honest account of what RecallLens defends against, what it does
not, and the trust assumptions it makes. Findings marked ✅ are mitigated;
⚠️ are accepted/documented limitations.

## Assets

- Integrity of the convergence signal (distinct-org match count, converged flag).
- Confidentiality of partner supply records and consumer receipts.
- Authenticity of the public outbreak data shown to users.

## Actors / trust boundaries

- **Registrar / coordinator** — deploys the contract and holds the registrar
  credential secret. Admits organizations (`registerOrganization`) and defines
  cases (`openCase`/`closeCase`). Trusted to admit genuinely independent orgs.
- **Registered organization** — holds an org credential secret; can submit
  `proveRelevantEvent`. Not trusted to tell the truth about physical events
  (the circuit binds witnesses to prior commitments, but cannot verify reality).
- **Public / consumer** — read-only; reads public state via the indexer and the
  API. No wallet required for the read-only dashboard.

## Threats and mitigations

### T1 — Convergence inflation by one entity (Sybil) ✅ mitigated
*Attack:* a single actor registers 3 credentials, commits 3 events with the same
lineage token, and flips `converged`.
*Mitigation:* `registerOrganization` requires in-circuit proof of the registrar
secret (`assert(deriveRegistrarCommitment(getRegistrarSecret()) ==
registrarCommitment)`). Only the registrar can admit credentials, so the
distinct-credential nullifier rule now implies distinct *admitted* organizations.
⚠️ Residual: a malicious or careless registrar could admit colluding orgs — the
same trust any credentialing authority (a certification body, a regulator)
carries. This is the explicit trust anchor, not a hidden assumption.

### T2 — Double counting by one credential ✅ mitigated
`orgNullifier` derived from the registered `orgSecret`; asserted fresh before
insert. Verified by contract test "duplicate org nullifier".

### T3 — Tampered / forged private event ✅ mitigated
The circuit re-derives the event commitment from the witness fields and binds
the supplied Merkle path to it (`assert(path.leaf == commitment)`) before
`checkRoot`. A witness that returns mismatched fields, an uncommitted event, a
wrong product, or an out-of-window time is rejected in-circuit. Verified by
tests "tampered event", "event never committed", "wrong predicate".

### T4 — Case squatting / unauthorized case admin ✅ mitigated
`openCase`/`closeCase` require the registrar secret (T1 mechanism). Without the
gate, anyone could open a bogus case under the expected caseId (irreversible, no
overwrite) or close a real case. Now only the registrar can.

### T5 — Leaking partner records on-chain ✅ mitigated
No raw record is ever an argument to a state-writing circuit; only opaque
commitments, hashes, and counts are disclosed. See PRIVACY_AUDIT.md §3.

### T6 — Private records leaking through the API ✅ mitigated
The API accepts only `{caseId, orgId}` for proofs; it reads the org's synthetic
fixture locally and produces the proof server-side. No partner/consumer record
crosses the client boundary. The consumer check compares lineage tokens
server-side and returns only affected/not-affected + public guidance.

### T7 — Anonymity-set narrowing ⚠️ accepted (demo scale)
With few registered orgs / committed events, timing and count correlation can
narrow which org proved. The demo seeds 3–4 orgs. Production should maintain a
larger anonymity set. Also, historic-root disclosure could reveal a matched leaf
existed at a snapshot if a stale root were used — the shipped witness always
uses the current root.

### T8 — Untrusted external content (CDC HTML, openFDA, MCP) ✅ mitigated
Fetched HTML/JSON is parsed as DATA against explicit selectors and Zod schemas;
page script is never executed. A structure change fails loudly (the parser
throws) rather than rendering garbage. MCP-fetched content is treated as
potentially prompt-injected and is not acted on as instructions.

### T9 — Source outage / spoofing ✅ mitigated for availability
`www.cdc.gov` blocks datacenter scraping (Akamai 403). The adapter attempts a
live fetch and falls back to a checked-in, timestamped, content-hashed snapshot;
the UI badges LIVE vs CACHED honestly. ⚠️ We do not cryptographically verify CDC
authenticity beyond the recorded content hash of our snapshot.

### T10 — Secrets in the repo ✅ mitigated (for real secrets)
No wallet seed, signing key, or API key is committed. `.env.example` documents
config; `.gitignore` excludes `.env`, wallet state, and prover/verifier keys.
⚠️ Demo *fixture* secrets (org/registrar/lineage) are intentionally public
constants for reproducibility — fine for a demo, never for production.

### T11 — Proof of physical truth ⚠️ out of scope by design
A ZK proof establishes that authenticated committed records satisfy the case
predicates. It does NOT establish that the shipment occurred, a pathogen was
present, or that the product caused illness. This is stated in the UI and
narration. RecallLens is a coordination/traceback layer, not a replacement for
epidemiology, lab testing, FDA, or CDC.

## Production hardening roadmap (not in the demo)

- Registrar as a multi-sig / DAO / accredited certification body rather than a
  single key; on-chain registrar rotation.
- Larger anonymity sets; enforce fresh-root usage in-circuit.
- Real organization attestation (signed credentials) instead of demo constants.
- Encrypted selective-disclosure delivery (the current disclosure feature
  records an authorization hash only — see the UI's honest limitation note).
- Rate limiting / spam control on commitments.
