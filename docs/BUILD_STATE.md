# RecallLens — Build State

**Current milestone:** FINAL INTEGRITY PASS — implementation + verification
COMPLETE; demo re-seeded to judge-ready state.
**Last updated:** 2026-07-18

## Final integrity pass — changes implemented (all verified this session)

- **Scan isolation** (ScanProduct.tsx rewrite): per-attempt sequence counter;
  beginAttempt() wholesale-replaces ALL scan state (fields/rawText/product
  name/method/errors); camera/upload/manual/Restart all start clean; stale
  async decodes dropped by seq; ConsumerCheck drops results from older
  attempts. E2E regressions added (FDA→lettuce, A→B without restart, invalid
  upload, receipt cleared).
- **Receipt model** (schemas rework.ts + recall-intelligence.ts rewrite):
  inputProvenance/inputSynthetic, sourcesChecked[] (per-system results), basis,
  midnight{involved,mode,networkLabel,contract,tx,note},
  dataLeftDevice{exact fields, imageTransmitted:false}. networkLabelFor maps
  "undeployed"→"Local Midnight devnet" (raw id never shown). Control passport
  now inputSynthetic:true; no-match lists all four systems with results;
  Midnight involvement true only when hold/recall state actually consulted.
  New VERIFICATION_UNAVAILABLE level. ConsumerVerifyRequest gtin now optional
  (never fabricated); scanOrigin added.
- **FDA GTIN** removed from card + QR (now `(10)60401(17)280209`), card prints
  "GTIN/UPC: not published by the FDA advisory"; gs1 parser accepts lot-only
  labels (identifier required, GTIN optional).
- **Seed txids**: deploy-and-seed records preSubmittedProofTxIds/
  preSubmittedSignalTxIds; live-backend + workflow consume them; fallback and
  legacy records display "previously verified during demo setup" — the
  "(pre-submitted)" placeholder is gone from source.
- **Lifecycle**: GET /api/workflow/:caseId/stage (authoritative snapshot);
  WidgetDrawer pill always subsystem-labeled with full per-subsystem drawer.
- **Role/idempotency**: authorizeRecall server-gated on converged +
  disclosure; separate "Review recall predicate…"→confirm UI; disclosure send
  idempotent (server) + sent-state server-driven (reload-proof); removal
  idempotent with evidenceBasis.
- **Removal truth**: Option B — "Partner-reported quarantine/removal",
  REMOVAL_EVIDENCE_BASIS ("off-chain — not a Midnight transaction, not
  cryptographically verified") returned by API and shown verbatim.
- **Language**: MATCHES AUTHORIZED RECALL SCOPE (+"does not independently
  prove"); RELEVANT SHIPMENT IDENTIFIED; hold copy adds "does not prove the
  product is contaminated".
- **No-match design**: neutral info-blue, per-source list, official link kept.
- **Demo kit**: neutral Passport A/B/Partner Shipment titles; outcome-free
  faces; presenter mapping moved to DEMO_SCRIPT; print CSS (@media print:
  white, black borders, QR quiet zone, no globe/nav/buttons, 86mm cards);
  print render inspected; QR decode verified from full/cropped/rotated/450px
  card images in-browser (300px honestly fails → OCR/manual fallback).
- **Visual/responsive**: emoji controls → stroke icons; honest staged
  ProofProgress (named stages + elapsed, indeterminate); technical details
  collapsed in receipt; mobile pill repositioned below nav; badge single-line;
  footer contrast raised; content top padding on mobile.
- **Command Center**: two separate labeled stat rails (official CDC snapshot
  vs private coordination); persistent globe legend ("Schematic anonymous
  proof activity — Not facilities or shipment routes") + arc hover labels;
  RecallImpact renamed to "shipping cases" everywhere.
- **CDC states regression fixed**: live page revision names no states in
  prose; adapter reuses cached official state names only when live title
  count matches (5/5) — live fetch now returns all 5 states.
- **Nav overlap**: confirmed a Playwright fullPage screenshot artifact (header
  is position:fixed, top stays 16px at scrollY 321); new evidence uses
  viewport captures.

**Verification:** contract 43/43 · gs1 22/22 · source-adapters 27/27 · schemas
4/4 · fixtures 8/8 · client 8/8 · Playwright 28 passed + 2 intentional
desktop-only skips · tsc clean everywhere · prod build OK. Full live-devnet
lifecycle (Flows A–H) executed in the rendered browser against contract
`e501d777…`: signal→hold (tx 0024d7b54c…)→consumer hold→request→partner
scan+approve (tx 0001d3…e56341, 3/3 indexer-read)→disclosure round-trip
(rejected field absent; duplicate send rejected; reload-proof)→predicate
review→recall (tx 00e0a3a075…)→scope match→Passport B neutral no-match→FDA
exact match via QR (no GTIN)→removal attestation (idempotent). Cross-scan
isolation flows (A→B upload, FDA→lettuce) re-verified live. Network transit
inspected (identifiers only, no image); console 0 errors/0 warnings.
Evidence: demo-evidence/after/final-integrity-pass/ (indexed README).

**Fresh-context verifier (independent subagent, ran against this spec):**
all 10 verification areas PASS with file:line evidence; overall verdict
SATISFIED. (Noted nuance: the fabricated-GTIN string appears only inside
`toHaveCount(0)` negative assertions in the e2e specs — the regression guard
itself.)

**Globe full-bleed fix (user-reported mid-pass):** the square canvas
(min-dimension × 1.35) visibly clipped the zoomed earth at wide viewports
(reproduced at 1920×937). GlobeStage now sizes the canvas to viewport × 1.12
in both dimensions; verified at 1920×937 and 1440×900 (evidence 24/25).

**Evidence re-collection (2026-07-19, user-requested):** all outdated
evidence sets (baseline/, after/e2e/, after/final-integrity-pass/) deleted;
the FULL workflow was re-captured with Playwright MCP viewport screenshots on
contract `327994f53dd0…e75d86b3` into **`demo-evidence/workflow/`** (38 shots
+ indexed README): start state → drawer → neutral demo kit + print render →
Sentinel 2/3 (genuine seed txids) → owner review → staged proof → 3/3
convergence → hold tx `000f8748…` → Passport A upload-scan → hold receipt
(+expanded technical details) → request-only investigator → Meridian
shipment-card upload-scan → record located → staged proof → settled
(tx `006ad21928…`, 3/3) → disclosure field selection → sent (idempotent,
0 duplicate buttons) → 3/3 shared lineage → decrypt (RELEVANT SHIPMENT
IDENTIFIED) → predicate review → recall tx `00f20708…` → MATCHES AUTHORIZED
RECALL SCOPE → Passport B neutral no-match → FDA card decode (empty GTIN) →
EXACT OFFICIAL MATCH → partner-reported removal → end-state pill/drawer →
mobile 390 → light theme.

**Judge-ready state (re-seeded after the evidence walkthrough):** contract
`942452cd5f38bb72…e717d9ee` deployed 2026-07-19T01:18:20Z; verified via live
API: stage sentinel-signals, Sentinel 2/3, trace 2/3, no
hold/recall/disclosure/removal, mode live-devnet, CDC live; pre-submitted
rows carry genuine seed txids (signals `00fa1aa30c…`/`00757f2e4d…`, proofs
`0026ff0cfd…`/`007e2226a9…`). API :8787 healthy, web :5173 up.

**Next executable action:** none — pass complete.

## Final integrity pass — Phase 0 audit (2026-07-18, this session)

Environment at audit time: web :5173 OK, API :8787 healthy (`cdc: live`,
`chain: live-devnet`), deployed contract `e501d777f2ac…a3dc8027`
(deployedAt 2026-07-18T21:18:55Z, undeployed network), seed state
Sentinel 2/3 + trace 2/3 (`matchCount: 2, converged: false` from live API).
Git: main @ 8ece122, evidence dir demo-evidence/after/e2e/ untracked.

Each reported issue classified after live-viewport reproduction:

| # | Issue | Classification | Evidence |
|---|---|---|---|
| P1 | Cross-scan product-name leak (FDA name survives Restart into lettuce scan) | **REPRODUCED live** | manual FDA entry → Restart → upload lettuce label → productName still "GreenWise Organic IQF Frozen Blueberries" (screenshot 00-defect-cross-scan-product-name-leak.png). Cause: `productName` state in ScanProduct.tsx never cleared by Restart/handleFile/beginManual; `fields`/`rawText` also survive Restart (Restart only sets stage="idle"). |
| P2a | "Midnight involved: yes — undeployed, tx …" | **REPRODUCED in code** | ConsumerCheck.tsx:194 renders `receipt.network` = "undeployed" (the Midnight network id for a local devnet) directly into user copy. |
| P2b | Control passport receipt says "Synthetic data: no" | **REPRODUCED live via API** | /api/consumer/verify with signed control passport → `syntheticData: false` while `passport.valid: true, issuer: rl-demo-issuer-1` (a synthetic demo passport). Cause: recall-intelligence.ts NO_VERIFIED_MATCH branch never sets syntheticData or reflects input provenance. |
| P2c | No-match claims 3 systems checked, receipt shows only FDA + "Midnight involved: no" | **REPRODUCED live via API** | same response: whyThisLevel names advisory+recall+hold but `midnightInvolved:false`, single source row. Hold/recall registry WAS checked (workflow.holdMembership/recallMembership) but is not represented. |
| P2d | Fabricated FDA GTIN `00000000060401` | **REPRODUCED in code+UI** | label-data.ts qrPayload zero-pads lot 60401 into a GTIN-shaped AI(01); FDA card scan produces "Scanned: 00000000060401" row. The FDA advisory publishes NO GTIN/UPC. |
| P2e | `tx (pre-s…itted)` placeholder | **REPRODUCED in code+UI** | live-backend.ts:105 + workflow.ts initialSignals set literal `"(pre-submitted)"` which UI truncates as tx-like text. Seed script logs real txids but discards them (deploy-and-seed.ts). |
| P3 | Unlabeled global pill "Proving 2/3" ambiguous across subsystems | **REPRODUCED live** | pill shows "Proving 2/3" (trace) even while Sentinel is also 2/3; after Sentinel→3/3 the pill still says "Proving 2/3" with no subsystem label. |
| P4a | Hold + recall in one button | **REPRODUCED in code** | InvestigationWorkspace.tsx:210 button literally "Issue targeted confidential hold → authorize recall" though it only calls authorizeRecall (hold already exists — copy misrepresents the action; no predicate review, no confirmation dialog). |
| P4b | Recall possible before disclosure | **REPRODUCED in code** | authorizeRecall gated only on holdIssued + converged (panel visibility), not on disclosure state. |
| P4c | Disclosure send not idempotent across reload | **REPRODUCED in code** | PartnerVault DisclosurePanel `sent` is local useState; reload → button re-enabled although a package exists server-side. |
| P4d | Removal idempotency | Partial: server-side `confirmRemoval` is idempotent (includes check); UI hides button after `mine`. Verified OK server-side; UI relies on poll. |
| P5 | "Quarantine/removal confirmed" evidence basis | **AUDITED: service-side state mutation only.** confirmRemoval mutates in-memory/file JSON; no chain transition, no signature. Wording overclaims. |
| P6 | "AFFECTED PRODUCT CONFIRMED" headline | **REPRODUCED in code** (recall-intelligence.ts:184). |
| P6b | "PROBABLE SOURCE NARROWED" badge | **REPRODUCED in code** (InvestigationWorkspace.tsx:322). |
| P7 | No-match uses green/verified styling | **REPRODUCED in code** (ConsumerCheck LEVEL_STYLE: NO_VERIFIED_MATCH → verified/green tone). |
| P8 | Printed passports reveal expected outcome | **REPRODUCED in code+UI** (label-data.ts titles "Affected…"/"Control (unaffected)…" + subtitles printed on card front). No print CSS beyond `print:hidden`/break-inside. |
| P9a | Nav overlap mid-page in screenshots 16/18/19/21/22/26 | **SCREENSHOT ARTIFACT, not live.** Live check: header is `position:fixed` and stays at top:16px at scrollY 321 (probed via DOM). Playwright fullPage screenshots paint fixed elements at the scroll offset → artifact. Fix evidence-capture method; keep viewport screenshots. |
| P9b | Emoji controls (📷🖼⌨🔒🔐🔓) | **REPRODUCED** in ScanProduct/PartnerVault/InvestigationWorkspace. |
| P9c | Raw enums/hashes/ISO timestamps in primary consumer result | **REPRODUCED** (EvidenceReceiptCard always expanded). |
| P9d | Mobile issues (3-line badge, unstyled scan buttons, giant pill) | **REPRODUCED** in earlier mobile screenshots 30/31. |
| P10 | Illness metrics + proof metric fused in one stat rail; "cases" for inventory | **REPRODUCED** (CommandCenter RailStat row mixes CDC counts with 3/3 Verified; RecallImpact labels "Broad recall (cases)" where fixture field is casesReceived = shipping cases). |
| P-globe | Arcs resemble shipment routes | **REPRODUCED** (BackgroundGlobe ARC_ORIGINS→focus arcs; legend text exists only on Command page top-left, small). |

Non-issues confirmed: role guards (investigator/consumer cannot prove — no
such endpoint/button), encrypted disclosure rejected-field exclusion (unit +
API tested), genuine on-chain paths, deterministic seed.

## Rework evidence (all verified this session against live tools)

**Contract (Sentinel-extended):** 9 circuits, full-ZK compile exit 0,
**43/43 simulator tests** (16 original + 27 Sentinel: signal categories,
threshold policy, tampered/duplicate/unregistered/window rejections,
hold + recall lifecycle). Constructor unchanged; new pure circuits
deriveSignalCommitment/deriveSentinelTag/deriveSignalNullifier.

**Genuine on-chain transitions this session (fresh contract
`74bfa9b0…` first, then demo re-seed `see .recalllens-deployment.json`):**
- openSentinelCase tx `0020b1967a…`; 3 signal commitments; 2 signals
  pre-submitted (QA + cold-chain)
- LIVE third signal (QuickServe exposure-cluster, owner-approved through the
  role-guarded API): tx `0017c16c4d…` → threshold TRUE (3 signals/3 orgs/3
  categories/1 high-confidence)
- issuePrecautionaryHold tx `00492081d6…` (hold commitment anchored)
- Consumer scan of the SIGNED lettuce passport → PROOF_VERIFIED_PRECAUTIONARY_HOLD
  (passport signature valid; membership vs anchored hold)
- Role-correct trace: investigator request → Meridian scan (own lot enforced)
  → approve → genuine proveRelevantEvent tx `00b87a8d93…` → 3/3 converged
- authorizeRecallPredicate tx `00cbad4776…` → consumer re-scan →
  AUTHORIZED_RECALL_MATCH ("not an FDA recall" shown)
- Encrypted disclosure round-trip via API: ciphertext-only transit, 3 approved
  fields decrypt, rejected field absent from plaintext & ciphertext

**Role guards verified live:** `/api/case/prove` REMOVED (404); partner
approve without own scan → 403; wrong org approving another's signal → 403;
consumer verify leaves trace count untouched (e2e-asserted).

**Consumer Recall Intelligence (real official data):** FDA lettuce +
blueberries advisories fetched LIVE (sha256s in SOURCE_PROVENANCE), parsers
tested against real markup; EXACT_OFFICIAL_RECALL_MATCH (live:true) verified
for the GreenWise card (lot 60401 + best-by 2028-02-09 + brand);
POSSIBLE/NO_MATCH/INSUFFICIENT/tampered-passport levels all verified via API
and E2E. openFDA: 2026 blueberries enforcement record does not exist yet
(honestly surfaced). USDA FDC: correct host api.nal.usda.gov, DEMO_KEY
throttled 10/hr, cached labeled sample fallback.

**Suites (final):** contract 43/43 · gs1 22/22 (passport sign/tamper/QR,
ECDH+AES-GCM disclosure) · schemas 4/4 · fixtures 8/8 · source-adapters 25/25
· midnight-client 8/8 · **Playwright 20/20 (desktop+mobile)** · all TS clean ·
production build passes.

**Demo-ready state seeded:** Sentinel 2/3 signals, trace 2/3 proofs, live
devnet mode, health checks green.

## Cockpit redesign pass (this session)

- Command Center is now a non-scrolling cockpit: massive centered night-earth
  globe as the primary interface; glass hero (Fraunces serif) bottom-left; stat
  rail bottom-right; hovering pill navbar; macOS-style expandable widget drawer
  top-right (proof status / provenance / privacy). AMOLED true-black dark theme
  (default) + light theme (blue-marble globe), persisted toggle. Fully
  responsive (verified 1440×900 and 390×844); interior pages scroll over the
  globe. Browser-found fixes: drawer intercepted mobile taps when collapsed;
  consumer tab white-on-white.
- Final gate after redesign: web TS clean, production build passes,
  **Playwright 16/16 (desktop+mobile)**, console 0 errors, health checks green,
  demo-ready live deployment at 2/3 (contract `6d2809da…a9295`).

## Validation & hardening pass (this session)

Driven live through the browser (Playwright MCP) across investigator, partner,
consumer, and failure personas. Added and verified through the rendered UI:
- **Signature 3D Outbreak Globe** (react-globe.gl, chosen via Context7): US
  framing, state-centroid affected markers (no fabricated coordinates), coarse
  anonymous proof arcs, "COMMON ORIGIN VERIFIED" overlay driven by REAL on-chain
  convergence, legend (public/synthetic/proof/disclosed), replay control,
  lazy-loaded, 2D cartogram fallback (mobile/reduced-motion/WebGL-fail). Earth
  textures bundled locally (offline-safe). Fixed two real bugs found via the
  browser: React single-instance dedupe (invalid-hook-call) and CDN CORS.
- **Physical scan-to-Midnight pipeline**: GS1 QR/barcode (native BarcodeDetector
  → ZXing) + image upload + local OCR (Tesseract) + manual correction → confirm
  → private-vault lot→lineage lookup → genuine third `proveRelevantEvent` →
  globe/graph update from verified indexer state. Verified live: scanning the
  affected label ran Meridian's real proof (settled tx, e.g. `00850afc…`), state
  read back 3/3 converged. Truthful results: synthetic-positive vs honest
  "no verified intersection found" + "not proof the product is safe".
- **Printable GS1 demo labels** (affected + control) at `/labels` with QR
  Digital Links (no secrets), human-readable values, print instructions.
- **Live-synced official intelligence**: "Official source updated" vs "RecallLens
  retrieved" timestamps + refresh + 5-min poll cadence (not "real-time").
- **Reset endpoint** + serialized E2E for repeatable demos.

Final green gate: contract 16/16, gs1 13/13, schemas 4/4, demo-fixtures 8/8,
source-adapters 14/14, midnight-client 7/7, Playwright 16/16 (desktop+mobile,
stable across repeated runs), all TS clean, contract full-ZK compile exit 0,
production web build passes (globe lazy-chunked). Command Center console: 0
errors, 0 warnings.

Demo-ready deployment (repo `.recalllens-deployment.json`): contract
`6d2809da651adb5b9d390c919491ae55b456fb9664b5acc34bb79043352a9295`, 2/3
pre-submitted, 3rd proof runs live via the affected-label scan.

## Verified environment (actual command output this session)

| Component | Version / status | Evidence |
|---|---|---|
| Compact CLI | 0.5.1 | `compact --version` |
| Compact compiler | 0.31.1 | `compact compile --version` |
| Node.js | 25.9.0 | `node --version` |
| npm | 11.12.1 | `npm --version` |
| Local devnet | node 0.22.5, indexer 4.2.1, proof-server 8.1.0 — all healthy | `docker compose -p midnight-devnet ps` + HTTP 200 on :9944/health, :8088 GraphQL POST, :6300/health |
| Devnet compose file | `~/.midnight-expert/devnet/devnet.yml` (generated this session) | generate-devnet.sh output |
| Midnight Kapa MCP | connected (`https://midnight.mcp.kapa.ai`) | knowledge query returned current docs |
| Midnight Expert plugins | all 9 installed, cross-refs pass | doctor run this session |

## Selected package versions (from official create-mn-app@latest scaffold, 2026-07-18)

- `@midnight-ntwrk/compact-runtime` 0.16.0
- `@midnight-ntwrk/midnight-js-*` 4.1.1 (contracts, http-client-proof-provider, indexer-public-data-provider, level-private-state-provider, network-id, node-zk-config-provider, protocol, types, utils)
- `@midnight-ntwrk/wallet-sdk` 1.2.0
- Matches the official compatibility matrix (support-matrix.mdx fetched 2026-07-18): compiler 0.31.1, runtime 0.16.0, Midnight.js 4.1.1.

## Working commands (verified)

- `compact compile <src> <outdir>` — compiles a contract
- Devnet: `docker compose -p midnight-devnet -f ~/.midnight-expert/devnet/devnet.yml up -d`
- Official scaffold harvested from `/tmp/rl-hello` (create-mn-app@latest, hello-world template): wallet bridge (`wallet.ts`, `wallet-state.ts`), network config (`network.ts`), deploy pattern (`deploy.ts` — `CompiledContract.make(...).pipe(withVacantWitnesses, withCompiledFileAssets)` + `deployContract`), read path (`cli.ts` — `indexerPublicDataProvider` + `queryContractState` + generated `ledger()`).

## Completed

- [x] Environment preflight (devnet, compiler, MCP, plugins)
- [x] git init (main branch), npm workspace skeleton
- [x] Official template scaffolded to /tmp and integration patterns harvested

## In progress (2026-07-18 build session, continued)

- [ ] Phase 2: recalllens.compact — compile + simulator tests (delegated to compact-dev subagent)
- [x] schemas package: EPCIS-shaped Zod domain model + public-data schemas
- [x] demo-fixtures package: 4 synthetic orgs, affected + clean lineage events, recall-impact store shipments, consumer receipts
- [x] source-adapters package: CDC HTML parser (verified against real archived markup), cached-snapshot builder, live-or-cached CDC adapter, openFDA adapter, adapter tests written
- [x] Real CDC facts confirmed from archived page markup: >1,644 cases, 94 hospitalizations, 0 deaths, 5 states (IN/KY/MI/OH/WV), status Open, recall issued No, updated July 17 2026
- [ ] web app (Command Center / Investigation Workspace / Partner Vault)

## Key finding — CDC live fetch blocked

`www.cdc.gov` returns HTTP 403 (Akamai bot block) to datacenter/automation IPs.
Real page markup recovered via Internet Archive (snapshot 2026-07-18T03:34:30Z),
checked in as `packages/source-adapters/fixtures/cdc-cyclospora-07-26.raw.html`
(sha256 846e4b72...093127). Adapter attempts live fetch, falls back to the
timestamped cached snapshot, and badges LIVE vs CACHED honestly. See
docs/SOURCE_PROVENANCE.md.

## Coordination note

`npm install` at the workspace root is deferred until the contract subagent
(owns packages/contract) finishes its own install, to avoid a concurrent
lockfile race.

## GENUINE ON-CHAIN PROOF EVIDENCE (verified this session)

**P0 core is real.** Full run against the local Midnight devnet (network
`undeployed`, node 0.22.5 / indexer 4.2.1 / proof-server 8.1.0). The contract
was re-deployed after adding the registrar authority gate (see D12); the run
below is the registrar-gated `npm run e2e:onchain`:

- deployed contract `3412ea06a6b6eb4422f6942e93aef25dec166c42c17a55674200e4adefc54e69`
- registered 3 orgs (registrar-gated) + committed 3 events + openCase (sourceHash `846e4b72…` = CDC snapshot sha256)
- proof 1 → matchCount=1, proof 2 → matchCount=2, proof 3 → matchCount=3 converged=true
- duplicate proof from org[0] correctly REJECTED (in-circuit `failed assert`)
- final public state read via indexer: 3 distinct nullifiers, converged=true

**Persistent demo deployment** (`.recalllens-deployment.json`, repo root — the
authoritative address; re-seeded after each contract change):
- current contract `273135f322e0c21b275e4530243b92b1e3597e73c64985cbd9f213e866deeefa`
- caseId `cdc07260cc10…`, 2 proofs pre-submitted (Sierra Verde, Northstar)
- 3rd proof (Meridian) run live through the API and UI → converged=true (real ZK proof + settled tx)

**API live path**: `public-data-api` starts with `chain backend: live-devnet`,
`/api/health` ok (CDC live from this host, chain live), `/api/case/:id` reads
real on-chain matchCount, `/api/case/prove` produces a real ZK proof + settled tx.

## Test results (this session)

- contract simulator: 16/16 passed (`vitest`; includes registrar-gate + wrong-registrar rejection)
- source-adapters: 14/14 passed (CDC parser vs real archived markup, openFDA, live-or-cached)
- midnight-client: 7/7 passed (client↔circuit hash parity, fallback convergence + dup rejection)
- demo-fixtures: 8/8 passed (schema validation, recall-impact derivation)
- schemas: 4/4 passed (Zod boundary validation)
- Playwright central flow: 4/4 passed (desktop + mobile)
- Production web build: passes; two independent fresh-context verifiers: P0 done

## Blockers

- None currently.

## Next action

Web app build + Playwright central flow; then P1 polish + docs; milestone-1 verifier.
