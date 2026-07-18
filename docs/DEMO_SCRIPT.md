# RecallLens — Two-Minute Demo Script

**Tagline:** "Find the source, not the secrets."

## Pre-flight (once, before presenting)

```bash
npm run health            # devnet node/indexer/proof-server + API all green
npm run demo:reset        # clear any prior deployment/wallet state
npm run demo:seed         # deploy (registrar-gated), register 3 orgs, open case,
                          # pre-submit 2 of 3 proofs (leaves the 3rd live)
npm run demo:api          # API in live-devnet mode on :8787
npm run dev:web           # web app on http://127.0.0.1:5173
```

Print a demo label from `/labels` (affected lot) and tape it to a bag of
lettuce. Open the app on the **Command Center**. Optionally have a phone ready
on **Consumer Check → Scan a product**.

---

**[0:00 — The stakes]**
"This is a real, active outbreak. CDC has linked 1,644+ Cyclospora cases across
five states to shredded iceberg lettuce served at Taco Bell. This data is pulled
from the CDC's official page." *(point to the LIVE/CACHED badge + retrieved
timestamp; the globe shows the five affected states highlighted over the US.)*

**[0:20 — The traceback privacy problem]**
"The slowest step is traceback — finding the common lot across farms,
processors, and distributors. Today that means companies handing investigators
their supplier lists, invoices, and routes. They stall — and regulators
over-recall, destroying safe food."

**[0:40 — Two partners already proved privately]**
*(the globe shows 2/3 — two green proof arcs.)* "Two independent companies have
already proven, privately, that they touched the same lineage. The public ledger
recorded only anonymous tags and one-time nullifiers — no company data."

**[1:00 — Scan the physical package (the live third proof)]**
*(hold up the lettuce bag; on Consumer Check, Scan a product → camera at the QR)*
"A consumer scans the actual package. The barcode and any OCR happen locally —
the raw image never leaves the device. They confirm the GTIN, lot, and best-by."
*(the fields collapse into a sealed proof card)* "The GTIN and lot are just
lookup keys into the private vault. Confirming runs the **genuine third
Compact proof** on Midnight — a real zero-knowledge proof, a real settled
transaction."

**[1:20 — Convergence]**
*(result: "Affected purchase detected — synthetic positive"; back on the
Command Center the globe's third arc lands and shows "COMMON ORIGIN VERIFIED")*
"Three independent credentialed organizations converged on the same lineage —
and **we found the common source without publishing a single company's supply
graph on-chain**. Zero raw partner records on the public ledger."

**[1:35 — Narrowed recall + honest result]**
*(Investigation → recall blast radius)* "That precision takes the recall from
2,710 cases across 75 stores down to 526 cases across the 14 stores that
actually touched this lineage — 80% of product spared (simulated from demo
records)." *(back to the consumer result)* "And the result is honest: the
private partner records are synthetic, but the Compact proof is genuine. It even
says this is not proof the product is safe, and not a diagnosis — follow CDC/FDA."

**[1:55 — Close]**
"Epidemiology and lab testing still decide causation; RecallLens is the
privacy-preserving coordination layer. It takes outbreak response from the first
signal to the final consumer warning — **finding the source, not the secrets**."

---

## Honest, reliable demo notes

- The affected label runs a **genuine** on-chain proof (real proof server, node,
  indexer). The first two proofs are pre-submitted (documented above); the third
  is live. Nothing fakes success — a failure surfaces honestly with proof stages.
- If the live network hiccups, restart the API with `RECALLLENS_USE_LIVE=0`
  (deterministic fallback, clearly badged "deterministic fallback", no txId) —
  and say so; never call the fallback a live proof.
- Reproduce the genuine proof any time: `npm run e2e:onchain` prints tx ids +
  decoded public state.
- The **control** label returns "No verified intersection found" — use it to
  show the truthful negative path. A random retail bag returns the same honest
  "no verified intersection in the information currently available" + safety
  caveat.
- Reset & repeat: `npm run demo:reset && npm run demo:seed` gives a fresh 2/3
  state for the next run.
