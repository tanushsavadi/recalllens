# RecallLens — Build State

**Current milestone:** Cockpit UI overhaul complete — massive centered globe,
liquid glass, AMOLED dark + light themes, widget drawer; all suites green.
**Last updated:** 2026-07-18 (globe-cockpit redesign pass; see D16)

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
