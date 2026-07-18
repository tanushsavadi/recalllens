# RecallLens — Decisions

Concise record of material architecture and privacy decisions.

## D1 — Local devnet as primary network (2026-07-18)
Deploy and demo against the local Docker devnet (`undeployed` network: node 0.22.5, indexer 4.2.1, proof-server 8.1.0) already running and healthy. The genesis seed is pre-funded, so no faucet dependency and no risk of a public-testnet outage during the demo. Preview/preprod remain a documented option via the same network config module.

## D2 — Package versions from official scaffold + compatibility matrix (2026-07-18)
create-mn-app@latest (fetched today) pins compact-runtime 0.16.0, midnight-js 4.1.1, wallet-sdk 1.2.0 — matching the official support matrix for compiler 0.31.1. We adopt exactly this set rather than inventing versions.

## D3 — npm workspaces monorepo, no Turborepo (2026-07-18)
Focused scope; npm workspaces suffice. Avoids extra orchestration complexity.

## D4 — Contract test strategy: compact-runtime simulator first (2026-07-18)
Circuit unit tests run against the generated JS implementation via a simulator class (official example-bboard pattern: `createConstructorContext`, `QueryContext`, `CostModel`) with Vitest. Fast, deterministic, no network. On-chain integration (deploy + 3 org proofs + indexer read) is a separate script/test against the local devnet.

## D5 — Anonymity mechanism: random 256-bit lineage token, not lot-code hashes (2026-07-18)
Lot codes are guessable (dictionary attack). The case tag derives from a private random 256-bit lineage token propagated through the synthetic supply events: `caseTag = H(sep, caseId, lineageToken)`. Organization nullifier derives from the registered credential secret: `orgNullifier = H(sep, caseId, orgSecret)` — so one org cannot claim twice and three submissions cannot come from one credential.

## D6 — Organization registration binds nullifiers to credentials (2026-07-18)
`registerOrganization` records a commitment to the org's secret credential. `proveRelevantEvent` proves knowledge of a registered credential secret in-circuit, then derives the nullifier from that same secret. Prevents convergence inflation by unregistered or duplicate identities.

## D7 — Real CDC data via server-side adapter + checked-in timestamped snapshot (2026-07-18)
The official CDC outbreak page is fetched/parsed server-side (public-data-api) with Zod validation, source URL, retrieval timestamp, content hash, and parser version. A checked-in official snapshot is the fallback; UI always badges live vs cached. Synthetic partner fixtures are always labeled "Synthetic demonstration data".

## D8 — Wallet: seed-based server-side wallet for devnet demo, not browser extension (2026-07-18)
The official hello-world scaffold uses wallet-sdk 1.2.0 with a genesis seed on the local devnet. Browser Lace-extension flow adds fragile external dependency for a demo. The web app reads public state via the indexer directly; transactions are submitted through a small local API backed by the seed wallet. This is a genuine proof-backed path (real proof server, real node, real indexer). Documented honestly in the UI.

## D9 — Single hashing implementation via exported pure circuits (2026-07-18)
The contract exports `deriveEventCommitment / deriveOrgCommitment / deriveCaseTag / deriveOrgNullifier` as `pure circuit`s. The generated JS surfaces them as `pureCircuits.*`. The TS client (`packages/midnight-client/src/crypto.ts`) calls those directly — there is deliberately NO second JS hash implementation, so off-chain commitments/tags/nullifiers byte-match the circuit. A parity test asserts this.

## D10 — Pluggable ChainBackend: live-devnet + honest deterministic fallback (2026-07-18)
The API selects a `ChainBackend` at startup. `LiveDevnetBackend` does real deploy + real ZK proofs + real indexer reads. `FallbackBackend` is deterministic/in-memory, computes the SAME public values via `pureCircuits`, enforces the SAME nullifier rule, and is ALWAYS labeled `deterministic-fallback` with no txId — never presented as a live proof. This keeps the demo alive if the network is down without ever faking a proof. Playwright runs against the fallback for CI determinism; the genuine proof is verified by `npm run e2e-convergence`.

## D11 — Convergence graph uses fixed viewport, not fitView (2026-07-18)
@xyflow/react `fitView` measures node bounds asynchronously and clipped the leftmost nodes on first paint. Node positions are deterministic, so a fixed `defaultViewport` renders reliably. Interaction (pan/zoom) is disabled — the graph is a presentation surface, not an editor.

## D16 — Cockpit UI: massive centered globe + liquid glass + AMOLED (2026-07-18)
Full visual overhaul at the user's direction (inspiration: unlocked-kappa.vercel.app and the hearsay project's centered-globe layout — own implementation, no code copied). The Command Center is a non-scrolling cockpit: a massive centered night-earth globe IS the interface, with floating liquid-glass panels (hero bottom-left, stat rail bottom-right, mission strip top-left), a hovering glass pill navbar (rounded stroke icons), and a macOS-style expandable widget drawer top-right (proof status / provenance / privacy widgets, all reading the same polled on-chain state as the globe). Theme system: AMOLED true-black dark (default) + light theme (blue-marble globe), CSS variables + persisted Zustand toggle; legacy Tailwind palette names remapped to theme variables so every page flips automatically. Fonts: Fraunces (editorial display serif), Geist (body), IBM Plex Mono (eyebrows/code). Liquid glass = backdrop-blur+saturate, translucent fills, gradient-masked borders, inset top highlights. Reduced-motion + WebGL-failure fall back to the 2D cartogram; interior pages scroll over the same globe. Two real defects found and fixed via the browser during this pass: the collapsed widget drawer intercepted taps on mobile (visibility/hit-test), and the consumer tab was white-on-white.

## D15 — Deterministic reset endpoint + serialized E2E for demo repeatability (2026-07-18)
Added `POST /api/case/:caseId/reset`. On the fallback backend it clears in-memory nullifiers/counts to the initial state; on the live backend it is a no-op (on-chain proofs can't be un-submitted — re-seed via `npm run demo:seed`). Playwright resets in `beforeEach` and runs with `workers: 1` because the fallback backend is a single stateful process. This makes the demo and the tests repeatable.

## D13 — Signature 3D globe via react-globe.gl, with guaranteed 2D fallback (2026-07-18)
Chosen via Context7: `react-globe.gl` (three.js/WebGL, high reputation) for the Command Center's signature Outbreak Globe. It frames the US, highlights the 5 affected states at STATE granularity only (no fabricated case coordinates), draws coarse anonymous proof arcs toward the convergence region, and its camera focuses on convergence driven by REAL on-chain state (not a frontend flag). Guaranteed fallbacks: the existing 2D states cartogram is shown for mobile (<768px), reduced-motion users, and on WebGL/globe load failure. The globe is lazy-loaded (React.lazy + Suspense) so it never blocks first render. A "replay convergence" control replays existing verified state without generating a new proof.

## D14 — Physical scan-to-Midnight pipeline; scan drives the live 3rd proof (2026-07-18)
Consumer scans a printable GS1 Digital Link label (GTIN+lot+expiry only — no secrets) via native BarcodeDetector → ZXing fallback → image upload; OCR (Tesseract) for printed lot/date with manual correction. All processing is local; raw imagery never leaves the device. The confirmed GTIN+lot are LOOKUP KEYS into the private vault, which holds the high-entropy lineage token + EPCIS event (never on the label, never on-chain). The affected label triggers the genuine third `proveRelevantEvent` and the globe/graph update from verified indexer state. Truthful result: "Affected purchase detected" only for the synthetic demo lineage; a real retail bag → "No verified intersection found in the information currently available" + "not proof that the product is safe." Labeled: private records synthetic, Compact proof + state transition genuine.

## D12 — Registrar authority gate to make "3 independent orgs" honest (2026-07-18)
Milestone-1 verifier found registration/case-admin were permissionless, so one entity could Sybil-register 3 credentials and inflate convergence. Fix: a deploy-time registrar credential (sealed `registrarCommitment`); `registerOrganization`, `openCase`, `closeCase` require in-circuit proof of the registrar secret. This mirrors real food-safety credentialing (a trusted coordinator admits participants) and makes the "3 independent credentialed organizations" claim defensible. Honest residual: a malicious registrar could admit colluding orgs — the same trust any credentialing authority carries; documented in THREAT_MODEL.
