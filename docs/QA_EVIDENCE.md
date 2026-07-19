# RecallLens — QA Evidence

## Final integrity pass (2026-07-18, latest — supersedes sections below where they conflict)

Deployment under test during the integrity pass: contract
`e501d777f2ac…a3dc8027`; the full workflow was then re-captured end-to-end on
contract `327994f53dd0…e75d86b3`. **Current evidence set:**
`demo-evidence/workflow/` (indexed README inside) — all older evidence
directories were deleted; screenshot references in the historical sections
below refer to sets that no longer exist and are kept only as a record of
what was verified at the time.

| Check | Result | Evidence |
|---|---|---|
| Cross-scan isolation (product-name leak fixed) | PASS | ScanProduct per-attempt seq state; e2e "cross-scan isolation" tests; screenshot 00 (defect) vs live retest |
| Receipt model (provenance/sources/basis/Midnight separated) | PASS | source-adapters 27/27 incl. new per-source tests; live API responses (control passport now `inputSynthetic: true`, per-source results listed) |
| "undeployed" never shown to users | PASS | networkLabelFor → "Local Midnight devnet"; screenshots 16/21 |
| No-match lists every source actually checked, Midnight involvement truthful | PASS | screenshot 22: FDA/hold/recall-scope/signature all listed; `midnight.involved: true` with active hold |
| No fabricated FDA GTIN | PASS | QR = `(10)60401(17)280209`; card prints "GTIN/UPC: not published by the FDA advisory"; e2e asserts `00000000060401` count 0 |
| Seeded proofs honest | PASS | genuine seed txids recorded in deployment record; fallback shows "previously verified during demo setup" |
| Labeled lifecycle pill | PASS | pill progression observed live: "Sentinel signals 2/3" → "Sentinel verified · Trace 2/3" → "Hold active · Trace 2/3" → "Shared lineage verified 3/3" → "RecallLens scope authorized" |
| Recall prerequisites + confirm dialog | PASS | server 400s before convergence/disclosure (e2e); predicate review + confirm step (screenshot 19); genuine tx `00e0a3a075…` |
| Disclosure idempotent | PASS | duplicate POST → stored:false/alreadyExisted:true (e2e); reload keeps "Encrypted package sent", send button count 0 (live probe) |
| Removal truth | PASS | "Partner-reported quarantine/removal" + evidenceBasis "off-chain — not a Midnight transaction…" (screenshot 23); idempotent |
| MATCHES AUTHORIZED RECALL SCOPE | PASS | screenshot 21 + API headline |
| Neutral no-match styling | PASS | info-blue treatment (screenshot 22) |
| Outcome-neutral printed passports + print CSS | PASS | Passport A/B/Partner Shipment; print render (screenshot 02) white/black, QR quiet zone; all 4 QRs decode from full/cropped/rotated/450px-scaled card images via the browser BarcodeDetector (300px downscale honestly fails → OCR/manual fallback shown, screenshot 07) |
| Nav overlap | SCREENSHOT ARTIFACT (not live): header stays fixed at top during scroll (DOM probe top:16px @ scrollY 321); new evidence uses viewport screenshots only |
| Official vs private stats separated; shipping cases | PASS | screenshot 12 (two labeled rails); RecallImpact "shipping cases" |
| Globe interpretation | PASS | persistent legend "Schematic anonymous proof activity / Not facilities or shipment routes" + arc hover label |
| Live CDC states regression | FIXED | live page names no states in prose; adapter reuses cached official names only when the live title count matches (5) — states: 5 on live fetch |
| Suites | contract 43/43 · gs1 22/22 · source-adapters 27/27 · schemas 4/4 · fixtures 8/8 · client 8/8 · Playwright 28/28 + 2 intentional mobile skips · TS clean · prod build OK |
| Full live lifecycle (Flows A–H) | PASS on live devnet: signal tx settled, hold tx `0024d7b54c…`, trace 3/3 (tx `0001d3…e56341`), disclosure round-trip (rejected field withheld), recall tx `00e0a3a075…`, consumer hold/scope/no-match results, removal attestation |
| Network leakage | PASS | /api/consumer/verify request body = normalized identifiers + public passport fields only; no image bytes; console 0 errors/0 warnings |

Evidence captured this validation/hardening pass. Screenshots in
`demo-evidence/` (`baseline/` before, `after/` post-fix). All commands re-run
against the live stack (web :5173, API :8787 `live-devnet`, Midnight devnet up).

## Automated results (all green)

| Suite | Command | Result |
|---|---|---|
| Compact contract (simulator) | `npm run test:contract` | 16/16 passed |
| GS1 parser | `npm test -w @recalllens/gs1` | 13/13 passed |
| Schemas (Zod boundary) | `npm test -w @recalllens/schemas` | 4/4 passed |
| Demo fixtures | `npm test -w @recalllens/demo-fixtures` | 8/8 passed |
| Source adapters (CDC/openFDA) | `npm test -w @recalllens/source-adapters` | 14/14 passed |
| Midnight client (hash parity, fallback) | `npm test -w @recalllens/midnight-client` | 7/7 passed |
| Playwright E2E (desktop + mobile) | `cd e2e && npx playwright test` | 16/16 passed |
| TypeScript (all 7 packages/apps) | `tsc --noEmit` | clean |
| Contract full-ZK compile | `npm run compile:contract` | 5 circuits, exit 0 |
| Production web build | `npm run build -w @recalllens/web` | exit 0 (globe lazy-chunked) |

## Genuine on-chain evidence (live Midnight devnet)

- `npm run e2e:onchain` (registrar-gated): deploy → register 3 orgs → openCase
  (sourceHash `846e4b72…` = CDC snapshot sha256) → 3 real ZK proofs
  (matchCount 1→2→3, converged=true) → duplicate proof rejected in-circuit →
  final indexer read shows 3 distinct nullifiers, converged=true.
- **Scan-driven proof through the browser:** on `/consumer`, scanning the
  affected label (GTIN 00810099110042 + lot NFP-SHRED-26164-07) ran Meridian
  Cold Chain's real `proveRelevantEvent`, settled tx `00850afc…e0cbdacd`, and
  the public state read back 3/3 converged. Screenshot:
  `demo-evidence/after/06-scan-result.png`.
- The Command Center globe then showed "COMMON ORIGIN VERIFIED" reflecting that
  real converged state. Screenshot: `demo-evidence/after/07-globe-converged.png`.

## Manual browser walkthrough (Playwright MCP)

| Journey | Evidence | Result |
|---|---|---|
| Command Center globe (building 2/3) | `after/02`, `after/03` | 3D globe renders with earth texture, red state markers, green proof arcs; legend + granularity note present |
| Command Center globe (converged 3/3) | `after/07` | 3 arcs converge, "COMMON ORIGIN VERIFIED" overlay driven by real state |
| Consumer scan tab | `after/04` | camera / upload / manual options, local-processing disclosure |
| Scan → proving (sealed card) | `after/05` | fields collapse to "sealed", proof-generating state |
| Scan → truthful affected result | `after/06` | "Affected purchase detected — synthetic positive"; genuine-proof vs synthetic-records distinction; safety disclaimer; tx shown |
| Demo labels (affected + control) | `after/08` | both GS1 QR labels, human-readable values, print instructions |
| Mobile consumer (390×844) | `baseline/02`, e2e mobile | scan flow usable |

## Console / network

- Command Center console after globe fixes: **0 errors, 0 warnings** (React
  single-instance dedupe fixed the "invalid hook call"; local globe textures
  fixed the CDN CORS errors).
- No private partner field (lotCode/sourceGln/quantity/lineageToken) appears in
  any API response or public-state payload — verified by grep of the API server
  and by the E2E "no-intersection / no fabricated affected" assertions.

## Truthfulness checks

- "LIVE official source" shows only when the CDC fetch succeeds; otherwise
  "CACHED official snapshot" with the archive timestamp. Both observed.
- Scanning an unknown retail lot returns "No verified intersection found in the
  information currently available" + "not proof that the product is safe" —
  never a fabricated affected result (E2E asserts `Affected` has 0 matches).
- Globe markers are state-centroid only; the granularity note is always shown.
- Deterministic fallback is always labeled and never presented as a live proof.

## Manual physical-device checklist (printed label + real webcam)

Automated tests use the identical parse/confirm pipeline via manual entry and
image upload (Playwright has no physical camera). To validate the true physical
path on a device before presenting:

1. `npm run demo:reset && npm run demo:seed` (fresh 2/3 state).
2. `npm run demo:api` and `npm run dev:web`; open `/labels`, print the
   **affected** label; tape it to a lettuce bag.
3. On a phone/laptop with a camera, open `/consumer` → **Scan a product** →
   **Scan with camera**; grant permission; frame the QR in the overlay.
4. Confirm the detected GTIN `00810099110042` + lot `NFP-SHRED-26164-07`.
5. Expect: sealed proof card → "Affected purchase detected — synthetic
   positive" → tx id shown → Command Center globe converges to 3/3.
6. Repeat with the **control** label → "No verified intersection found".
7. Camera-denied path: block permission → guidance to upload/enter manually.
8. Older browser (no BarcodeDetector): ZXing fallback still decodes the QR.

## Reset / repeatability

- `POST /api/case/:caseId/reset` clears fallback state (no-op on live backend,
  which is re-seeded via `npm run demo:seed`). E2E uses it in `beforeEach` for
  isolation; the demo uses `npm run demo:reset` + re-seed.

## Product rework verification (2026-07-18, this session)

All on the live devnet (contract per `.recalllens-deployment.json`):

| Check | Evidence |
|---|---|
| 43/43 contract tests (incl. 27 Sentinel) | `npm run test:contract` |
| Genuine third signal by OWNING role | submitSafetySignal tx `0017c16c4d…` → threshold 3/3/3 + QA |
| Hold anchored | issuePrecautionaryHold tx `00492081d6…` |
| Consumer scan → hold | PROOF_VERIFIED_PRECAUTIONARY_HOLD, passport sig valid, hold tx in receipt |
| Role-correct trace | request → Meridian scan (own-lot enforced) → approve → proveRelevantEvent tx `00b87a8d93…` → 3/3 |
| Recall authorized | authorizeRecallPredicate tx `00cbad4776…` → consumer AUTHORIZED_RECALL_MATCH, "not an FDA recall" |
| Encrypted disclosure | ciphertext-only transit; approved fields decrypt; rejected field absent from plaintext AND ciphertext |
| Role guards | /api/case/prove 404 · approve-without-scan 403 · wrong-org signal approval 403 |
| FDA card | EXACT_OFFICIAL_RECALL_MATCH, live:true, brand+lot+best-by+size matched |
| Negative paths | NO_VERIFIED_MATCH + safety caveat · POSSIBLE_ADVISORY_MATCH · INSUFFICIENT_DATA · PASSPORT SIGNATURE INVALID |
| E2E | 20/20 Playwright (desktop+mobile) incl. role guards, sentinel flow, FDA card, consumer-cannot-prove |
| Console | 0 errors on Command + Sentinel pages |
