# RecallLens — QA Evidence

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
