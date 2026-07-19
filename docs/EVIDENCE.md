# Evidence & Verification

What was verified, how, and with what versions. This replaces the older
session logs (BUILD_STATE, QA_EVIDENCE, UX_AUDIT, PRODUCT_REWORK_AUDIT,
FINAL_VIDEO_READINESS_AUDIT) with the facts that still matter.

## Versions (verified against the official support matrix)

| Component | Version |
|---|---|
| Compact CLI / compiler / language | 0.5.1 / 0.31.1 / 0.23 |
| @midnight-ntwrk/compact-runtime | 0.16.0 |
| @midnight-ntwrk/midnight-js-* | 4.1.1 |
| @midnight-ntwrk/wallet-sdk | 1.2.0 |
| Local devnet (Docker) | node 0.22.5 · indexer 4.2.1 · proof-server 8.1.0 |
| Frontend | React 19 · Vite 6 · Tailwind 3 · @xyflow/react 12 · Recharts 2 · TanStack Query 5 |

## The genuine on-chain proof

`npm run e2e:onchain` deploys a fresh contract on the local devnet and runs
the whole trace flow with real ZK proofs (full PLONK keys, no `--skip-zk`):

- register 3 orgs (registrar-gated) · commit 3 events · open the case bound
  to the CDC snapshot hash (`846e4b72…`)
- proof 1 → matchCount 1 · proof 2 → 2 · proof 3 → 3, `converged = true`
- a duplicate proof from the same org is rejected in-circuit (nullifier)
- final public state read back through the indexer: 3 distinct nullifiers,
  converged

The demo seed (`npm run demo:seed`) does the same setup plus the Sentinel
case, pre-submits 2 of 3 signal proofs and 2 of 3 trace proofs with real
settled transactions, and records everything in `.recalllens-deployment.json`.
The third proof of each kind is the live demo moment.

## Test suite (all green on the final build)

| Suite | Result |
|---|---|
| contract simulator (Vitest) | 43 tests — tampered event, duplicate nullifier, wrong predicate, unregistered org, unrelated lineage, 3-org convergence, registrar gate, Sentinel threshold policy |
| source-adapters | 27 tests — CDC parser vs the real archived markup, FDA advisories, recall-intelligence levels and receipts |
| gs1 | 22 tests — GS1 parsing, passport signing/tamper detection, disclosure encryption |
| schemas | 4 tests — Zod boundary validation |
| demo-fixtures | 8 tests — fixture ↔ schema validation, recall-impact derivation |
| midnight-client | 8 tests — client ↔ circuit hash parity, fallback convergence, duplicate rejection |
| Playwright E2E | 28 passed + 2 desktop-only skips — the central demo journey, role guards (403/404), idempotency, scan isolation, on desktop and mobile |
| TypeScript + production build | clean |

Run them yourself: `npm test`, `npm run build`, `cd e2e && npx playwright test`.

## Server-enforced guarantees (covered by E2E)

- The investigator cannot run a partner's proof: the legacy prove endpoint is
  removed (404) and partner approval without the partner's own scan is 403.
- A Sentinel signal can only be approved by its owning org (403 otherwise).
- Recall authorization is refused before trace convergence AND a received
  disclosure package, and cannot run twice.
- Disclosure send and removal reports are idempotent.
- A consumer verify never touches proof submission.

## Consumer-scan integrity (verified in the rendered app)

- All scanning (barcode, OCR) runs locally in the browser; the request body
  of `/api/consumer/verify` contains only the confirmed identifiers — never
  image bytes.
- Cross-scan isolation: a new scan wholesale-replaces all fields; nothing
  leaks from a previous scan (E2E-covered).
- The FDA blueberries advisory publishes no GTIN, so the test card and QR
  carry only lot + best-by. A missing identifier is never fabricated.
- "No verified match" uses neutral styling and never claims the product is
  safe.
- Every result ships an evidence receipt: input provenance, per-source
  results, why this level, Midnight involvement (with the real tx id when one
  exists), and exactly what left the device.

## Honest-copy sweep (final pass)

The rendered app was walked end-to-end with DOM probes after the final copy
rename. Current headlines: "SIGNED PASSPORT MATCHES A MIDNIGHT-ANCHORED
HOLD", "MATCHES TARGETED RECALL SCOPE", "SHARED SUPPLY LINEAGE VERIFIED",
lifecycle pill "Targeted action authorized". The receipt states plainly that
hold-membership resolution is service-side in this MVP. Older phrasings
survive only in git history.

## Known limitations (also disclosed in-product)

- Registrar admission is a single-credential trust anchor; a malicious
  registrar could admit colluding orgs (see THREAT_MODEL.md).
- Hold/recall set membership is resolved service-side against the
  Midnight-anchored commitment. Production would use a membership proof or
  private set intersection.
- Removal confirmation is a partner-reported, off-chain attestation — the UI
  labels it exactly that.
- Demo issuer/investigator keys are checked-in synthetic credentials.
- The recall blast-radius comparison is simulated from fixture data and
  labeled "Simulated".
