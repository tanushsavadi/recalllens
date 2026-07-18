# RecallLens — UX Audit

Method: driven live through the browser (chrome-devtools MCP for the P0 build,
Playwright MCP for this validation pass) against the running app (web :5173,
API :8787 in `live-devnet` mode, Midnight devnet node/indexer/proof-server up).
Screenshots in `demo-evidence/baseline/` and `demo-evidence/after/`.

## Baseline state (before this polish pass)

The four routes render and function end-to-end against the live devnet:
- Command Center: real CDC facts (1,644+/94/0, 5 states), live/cached badge,
  states cartogram, real on-chain proof status.
- Investigation: convergence graph tied to real proof state, public-ledger
  panel (opaque hashes only), recall blast-radius, selective-disclosure room.
- Partner Vault: 4-role switcher, local EPCIS table, run-private-match.
- Consumer Check: deterministic affected/unaffected result + guidance.
Console: 0 errors, 0 warnings. Central Playwright journey: passing.

## Baseline findings (severity → fix)

| # | Severity | Finding | Fix |
|---|---|---|---|
| B1 | P0 (user ask) | No signature geospatial moment. The states cartogram is functional but not memorable; the convergence lives only in an abstract node graph. | Add an interactive 3D Outbreak Globe on the Command Center framing the US, state-granularity highlights, tied to real convergence, with 2D/reduced-motion/mobile fallback. |
| B2 | P1 | Two-minute demo requires navigating Command Center → Investigation → Consumer. The "Launch private trace" CTA exists but the convergence reveal is a separate page. | Add a guided **Presentation Mode** overlay that scripts the demo beats and a single prominent "Launch private trace" path; keep the globe convergence reveal on the Command Center so the money moment needs no navigation. |
| B3 | P1 | Mobile header nav wraps into a tall 4-line stack (390px). | Compact horizontal scrollable nav on small screens. |
| B4 | P2 | Legend for what colors/badges mean (public vs synthetic vs proof vs disclosed) is implied but not consolidated. | Persistent legend on the globe + a data-provenance key. |
| B5 | P2 | Recall blast-radius chart is good but the "before/after" framing could be sharper. | Keep; add explicit "traditional vs RecallLens" labels (already present) — minor. |

No dead buttons, no broken assets, no accidental private-data transmission
observed (API only exchanges {caseId, orgId}; consumer check returns only
affected/guidance). Provenance (source URL, retrieved timestamp, live/cached)
is visible next to the claims.

## Decision on the signature experience

Implementing a **3D globe via `react-globe.gl`** (three.js-based; chosen via
Context7 for a mature React-compatible WebGL globe) framing the US, with a
guaranteed **2D cartogram fallback** for mobile, reduced-motion, and WebGL
failure. The globe is lazy-loaded so it never delays first render. It shows only
state-granularity official geography and coarse anonymous proof arcs — never
exact facility coordinates or shipment paths. See docs/DECISIONS.md D13.

## After-fix results (re-audited via Playwright MCP)

| # | Finding | Resolution | Evidence |
|---|---|---|---|
| B1 | No signature geospatial moment | Added the 3D Outbreak Globe (react-globe.gl) framing the US, state-centroid markers, anonymous proof arcs converging on real convergence, "COMMON ORIGIN VERIFIED" overlay, legend, replay control, 2D fallback, lazy-loaded. | `after/03`, `after/07` |
| B2 | Demo required navigation for the money moment | The globe convergence reveal lives on the Command Center; the scan on `/consumer` triggers the live third proof and the globe updates from verified state — the central moment needs no page hop. "Launch private trace" is the single obvious CTA. | `after/06`, `after/07` |
| B3 | Mobile nav wrapped tall | Header nav is now a single horizontally-scrollable row (`overflow-x-auto whitespace-nowrap`). | e2e mobile passing |
| B4 | No consolidated data legend | Persistent globe legend: public / synthetic / proof / disclosed. | `after/03` |
| Globe-1 | "Invalid hook call" (two React copies via react-globe.gl) | Vite `resolve.dedupe` + `optimizeDeps.include`. | console 0 errors |
| Globe-2 | Earth texture CDN CORS-blocked | Bundled `earth-dark.jpg` + `earth-topology.png` locally under `public/globe/` (offline-safe). | console 0 errors |
| Hero-1 | Stat labels overlapped when globe took a column | Restructured hero to `lg` split with a 2×2 stat grid. | `after/03` |

Two independent fresh-context verifiers confirmed P0 done earlier; this pass
adds the globe, the physical scan-to-Midnight pipeline, and demo labels — all
verified through the rendered UI and covered by new Playwright tests.

## New capabilities added this pass

- **Signature 3D Outbreak Globe** (with 2D/reduced-motion/mobile fallback).
- **Physical scan-to-Midnight pipeline**: GS1 QR/barcode (BarcodeDetector →
  ZXing) + image upload + OCR + manual correction → confirm → private vault
  lookup → genuine third `proveRelevantEvent` → truthful consumer result. The
  affected label converges the case on-chain and the globe reflects it.
- **Printable GS1 demo labels** (affected + control) at `/labels`.
- **Reset endpoint** for deterministic repeatable demos.
