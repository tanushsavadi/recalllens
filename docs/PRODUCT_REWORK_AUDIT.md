# Product Rework Audit — baseline before the coherence rework

Checkpoint: git tag `checkpoint-pre-rework` = commit `a029580` (pushed to
origin). Services verified up at audit time (web :5173, api :8787 live-devnet,
node :9944, proof-server :6300, indexer :8088). Baseline screenshots from the
prior QA pass are in `demo-evidence/` (globe cockpit, scan flow, drawer).

## Answers to the audit questions (each verified against code + this session's
## browser/API evidence)

**1. Does Consumer Check currently trigger Meridian's proveRelevantEvent?**
YES — this is the central workflow contradiction. `POST /api/scan/check`
(apps/public-data-api/src/server.ts) finds the next unconfirmed org and calls
`backend.submitProof(caseId, next.orgId)` — i.e. a CONSUMER scan runs a SUPPLY
PARTNER's proof. Verified live earlier: scanning the affected label produced
Meridian's settled tx. Must be removed; the partner must scan + approve in its
own vault.

**2. Can the investigator generate a partner proof?**
YES — Investigation's "Run private match — <org>" button calls the same
`/api/case/prove` with an arbitrary orgId. No role separation. Must become a
"send private-match request" that hands off to the partner role.

**3. Are partner identities revealed while the graph claims anonymity?**
PARTIALLY — the convergence graph shows "Grower (anon.)" etc., but the
"Organization proofs" panel beside it lists Sierra Verde Growers / Northstar /
Meridian by name for the same case. In-demo this is acceptable for the partner
roles themselves but the investigator view mixes "anonymized" claims with named
orgs. Needs a consistent story: investigator sees anonymous proof results;
names live in the partner-side vault and in the demo role switcher.

**4. Does "Common origin verified" overstate?**
YES — current UI strings: globe overlay "COMMON ORIGIN VERIFIED" and
Investigation "Common lineage verified". "Origin" overstates (nothing proves
origin/causation). Replace with "SHARED SUPPLY LINEAGE VERIFIED" + the
calibrated supporting copy.

**5. Does selective disclosure actually deliver encrypted fields?**
NO — `/api/disclosure/authorize` computes an authorization hash only; no
ciphertext exists, nothing is encrypted or delivered. The UI discloses this
honestly, but the rework requires real in-browser field-level encryption to the
investigator + decryption.

**6. Does consumer matching use official recall data, synthetic data, or both?**
SYNTHETIC ONLY — `lookupVaultLot(gtin, lot)` against fixture lots; the openFDA
adapter exists (`/api/fda/recalls`) but is NOT consulted by the scan check. No
FDA advisory-page adapter, no USDA product resolver, no evidence levels.

**7. Which state transitions are genuinely on-chain?**
- deploy/registerOrganization/commitTraceEvent/openCase (deploy-and-seed) — real
- proveRelevantEvent per org — real ZK proof + settled tx (evidence: e2e run
  matchCount 1→2→3, converged=true, dup rejected; scan-triggered Meridian tx)
- convergence flag — real ledger state read via indexer

**8. Which states are frontend/API simulation?**
- FallbackBackend (labeled "deterministic-fallback") — same math, no chain
- Disclosure authorization hash — app-level sha256, not on-chain
- Recall blast-radius — computed from fixtures, labeled simulated
- Consumer affected/no-intersection — fixture lookup, not official data
- Sentinel — does not exist yet
- Product passport signature — does not exist yet (label QR is unsigned)

## Contradiction summary → rework items

| # | Contradiction | Fix |
|---|---|---|
| C1 | Consumer scan runs Meridian's proof | Partner-owned proof: Meridian scans in Vault + approves; consumer check is downstream-only |
| C2 | Investigator can run partner proofs | Investigator sends requests; owning role approves |
| C3 | "Common origin verified" overstates | "SHARED SUPPLY LINEAGE VERIFIED" + calibrated copy |
| C4 | Disclosure not actually encrypted | Real in-browser ECDH/AES-GCM field-level encryption + decrypt |
| C5 | Consumer matching ignores official data | Recall Intelligence engine: FDA/openFDA/USDA + hold registry + authorized predicate, 6 evidence levels |
| C6 | Label QR unsigned | Signed Product Passport (P-256 WebCrypto), tamper-detectable |
| C7 | No early-warning layer | Sentinel: contract circuits + threshold policy + hold registry |
