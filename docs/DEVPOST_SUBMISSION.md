# RecallLens — Devpost Submission

## Demo video
https://youtu.be/56mWNj5ZfLg

## Tagline
Find the source, not the secrets. Privacy-preserving food-safety network on
Midnight: detect early, verify privately, contain quickly, trace precisely,
warn consumers, prove removal.

## Inspiration
Every foodborne-outbreak headline hides the same bottleneck: traceback. When the
CDC links illnesses to a food, investigators must find the common lot across
dozens of companies' records. Companies are slow to hand over supplier lists,
customer lists, invoices, and routes — it's their most sensitive data — so days
pass and regulators issue over-broad recalls that trash safe product and cost
billions. The July 2026 Cyclospora outbreak tied to shredded iceberg lettuce at
Taco Bell (1,644+ cases across 5 states) is exactly this pattern. What if
companies could prove their records converge on the same source **without
revealing the records**?

## What it does
RecallLens is a privacy-preserving coordination layer for outbreak traceback:

1. Pulls the **real, current CDC outbreak** (live-or-cached, honestly badged).
2. Lets independently-credentialed farms, processors, and distributors keep
   their supply records local and anchor only hiding commitments on-chain.
3. Runs **zero-knowledge proofs** that their private records match the outbreak
   case and share the same secret lineage — revealing only an anonymous lineage
   tag and a one-time nullifier.
4. Flips a public **convergence** flag when three *independent* credentialed
   organizations prove the same lineage — "shared supply lineage verified" — so
   investigators can target the recall precisely (the UI is explicit this does
   not establish contamination or causation).
5. Lets a consumer scan a product against official FDA recalls,
   Midnight-anchored precautionary holds, and authorized RecallLens recalls —
   with a full evidence receipt.

## How we built it
- **Midnight / Compact** — one contract (`recalllens.compact`, compiler 0.31.1)
  with two Merkle trees (org credentials, event commitments), public case
  definitions, per-tag match counts, a public nullifier set, and a registrar
  authority gate. Proofs are real ZK proofs (PLONK keys generated, no
  `--skip-zk`), settled as real transactions on a local Midnight devnet, and
  read back through the indexer.
- **Client** reuses the contract's exported `pure circuit` hashes so off-chain
  commitments byte-match the circuit (single hashing path, parity-tested).
- **Web** — React 19 + Vite + Tailwind; an @xyflow/react convergence graph
  driven by real proof state; Recharts for the recall blast-radius.
- **Source adapters** — CDC HTML parser validated with Zod against the real
  archived page, with a checked-in timestamped snapshot fallback; openFDA for
  historical recalls.

## Midnight is essential, not decorative
The entire product is "prove intersection without revealing the sets." That is a
zero-knowledge multi-party problem: each organization's supply graph must stay
private while a shared lineage is proven and a distinct-organization count is
enforced. Nullifiers derived from registered credentials stop one party from
inflating convergence; Merkle membership hides which event and which org proved.
Without Midnight's confidential proofs, this is just a database that leaks
everything it's meant to protect.

## The signature moment: scan a real package
On the Command Center, a **3D Outbreak & Evidence Globe** frames the US, marks
the five affected states (state granularity only — no fabricated coordinates),
and shows coarse, anonymous proof arcs. The physical demo uses a safe lettuce
bag carrying a **signed RecallLens Product Passport**: a consumer scan checks
it against the Midnight-anchored precautionary hold (barcode + OCR entirely
on-device, raw image never uploaded); then — in the Partner Vault, as Meridian
— the same physical label locates the partner's own committed record, and the
partner's approval runs the **genuine third Compact proof**, converging the
investigator's view to "SHARED SUPPLY LINEAGE VERIFIED" from real on-chain
state. An arbitrary retail bag honestly returns "no verified match found — not
a guarantee the product is safe."

## What we're honest about
- A ZK proof shows authenticated records satisfy the case predicates — it does
  **not** establish that a lineage caused an outbreak. Epidemiology and lab
  testing do. The UI says so.
- All partner/consumer data is **synthetic** and labeled; the real data is the
  public CDC outbreak. Accurate claim: **zero raw partner records on the public
  ledger**.
- Admission trusts a registrar (a credentialing authority). Selective
  disclosure now genuinely encrypts approved fields in-browser (ECDH+AES-GCM);
  the demo's hold-membership resolver is a documented production limitation.

## Verified results (this build)
- Contract compiles with full ZK keygen; **contract simulator tests pass**
  (tampered event, duplicate nullifier, wrong predicate, unregistered org,
  unrelated lineage, 3-org convergence, registrar gate).
- **Genuine on-chain run**: deploy → register 3 orgs → open case (bound to the
  CDC snapshot hash) → 3 real ZK proofs → match count 1→2→3, convergence flips,
  duplicate proof rejected — all read back from the indexer.
- Production web build passes; central Playwright journey passes on desktop and
  mobile; browser console clean.

## What's next
Registrar as an accredited multi-sig body; real signed org attestations; larger
anonymity sets; encrypted selective-disclosure delivery; local receipt/OCR
capture; an investigator MCP with human-confirmation gates.

## Try it
`npm install && npm run compile:contract && npm run demo:seed && npm run demo:api`
then `npm run dev:web`. Reproduce the genuine proof with `npm run e2e:onchain`.

## Product rework additions (final build)

- **RecallLens Sentinel** — early-warning layer with genuine Compact circuits:
  independent orgs privately prove safety signals (QA / cold-chain / exposure
  cluster) against the same hidden lineage; a transparent threshold (3 signals,
  3 orgs by nullifier construction, ≥2 categories, ≥1 high-confidence) opens a
  confidential case and a Midnight-anchored precautionary hold. Labeled a
  synthetic pre-outbreak replay — never an outbreak prediction.
- **Role-separated workflow** — investigators request; partners scan their own
  shipment labels and approve their own proofs; consumers only verify. Enforced
  server-side (tested 403/404 guards).
- **Consumer Recall Intelligence** — six explicit evidence levels over real FDA
  advisory pages (live-or-cached with provenance), Midnight-anchored holds and
  authorized recalls; every result ships an evidence receipt. Includes a real
  official-recall test card (GreenWise frozen blueberries, lot 60401).
- **Signed Product Passports** — ECDSA P-256 GS1 Digital Link labels; tampering
  is detected and surfaced.
- **Encrypted minimum disclosure** — field-by-field approval, in-browser
  ECDH+AES-GCM; only ciphertext transits.
