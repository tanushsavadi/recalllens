# RecallLens — Demo Script

**Tagline:** "Find the source, not the secrets."

**Presenter disclosure (say this up front):**
"The government source data is real. The physical scans, Compact proofs,
Midnight transactions and encrypted workflow are genuine. The participating
companies and private supply records are synthetic because real companies do
not publish their supply graphs — that is precisely the problem RecallLens
solves."

## Presenter-only passport mapping (never printed on the cards)

The printed cards are OUTCOME-NEUTRAL — they never state the expected result.
For the presenter:

| Card | Lot | What it will do |
|---|---|---|
| **Passport A** | `NFP-SHRED-26164-07` | in the Sentinel hold set → hold result; after authorization → matches recall scope |
| **Passport B** | `SVG-ICE-26171-B` | control → no verified match (neutral blue result) |
| **Partner Shipment Passport** | `NFP-SHRED-26164-07` | scanned by Meridian in the Partner Vault |
| **FDA test card** | `60401` + best-by 2028-02-09 | exact official recall match (live/cached fda.gov). The advisory publishes NO GTIN — the card and QR carry only lot + best-by. |

## Pre-flight

```bash
npm run health          # devnet + API green
npm run demo:reset && npm run demo:seed   # fresh state:
                        #   Sentinel 2/3 signals · trace 2/3 proofs (~4 min)
npm run demo:api        # live-devnet API
npm run dev:web         # http://127.0.0.1:5173
```

Print the demo kit from `/labels` (print CSS renders white cards with
high-contrast QRs): tape **Passport A** to a safe lettuce bag.

## DEMO A — Official consumer recall (~40s, real government data)

1. Consumer Check → scan the FDA test card (or enter values manually).
2. Lot `60401` · best-by `2028-02-09` · product
   "GreenWise Organic IQF Frozen Blueberries". No GTIN — the FDA advisory
   does not publish one and RecallLens never fabricates identifiers.
3. → **EXACT OFFICIAL RECALL MATCH** with the FDA source link, live/cached
   status, per-source results, and "GTIN/UPC — not provided by the FDA
   advisory" honestly listed under fields missing.
4. Point out: "Midnight involved: no" — this is pure official-source
   verification, and the receipt says exactly that.

## DEMO B — RecallLens end-to-end (~90s guided + longer proofs)

**Detect (Sentinel).** Open Sentinel: 2 signals privately verified (Day −9 QA,
Day −7 cold-chain), third awaiting its owner. Click "Review as owner" →
"Acting as QuickServe" → **Approve final signal proof** → honest staged
progress (generate → prove → submit → confirm, ~60–90s) → genuine
`submitSafetySignal` settles → **EARLY RISK CONVERGENCE DETECTED**
("not yet a confirmed outbreak"). The status pill reads
"Sentinel verified · Trace 2/3".

**Contain.** Issue confidential precautionary hold → genuine
`issuePrecautionaryHold` anchors the hold commitment. Pill:
"Hold active · Trace 2/3".

**Warn early.** Scan Passport A as a consumer →
**PROOF-VERIFIED PRECAUTIONARY HOLD** — "not yet an official government
recall" — the receipt separates input provenance (synthetic signed passport),
per-source results, and Midnight involvement ("Local Midnight devnet ·
deployed contract" + the anchor tx).

**Trace.** Investigation → Send private-match request (note: the investigator
has no proof button — it *cannot* run Meridian's proof). Switch to Vault →
Meridian → the exact predicate is shown → scan the Partner Shipment Passport →
committed record located → **Approve and generate private proof** → genuine
`proveRelevantEvent` (~60–90s) → back on Investigation: **SHARED SUPPLY
LINEAGE VERIFIED** — "narrows the investigation but does not independently
establish contamination or causation." Pill: "Shared lineage verified 3/3".

**Disclose minimally.** In Meridian's vault: approve sourceGln + lotCode +
eventDate, reject destinationGln → "Encrypt approved fields" (in-browser
ECDH+AES-GCM; only ciphertext transits; the send is idempotent — a reload can
never re-send) → Investigation: decrypt → **RELEVANT SHIPMENT IDENTIFIED**.

**Act.** "Review recall predicate…" shows the exact scope, hold commitment,
effect, and authority (RecallLens action — NOT an FDA recall) → confirm →
genuine `authorizeRecallPredicate` settles → **AUTHORIZED RECALLLENS
DEMONSTRATION RECALL**. Authorization is server-gated: impossible before
trace convergence AND a received disclosure, and it cannot run twice.

**Protect + report removal.** Re-scan Passport A → **MATCHES AUTHORIZED
RECALL SCOPE** ("does not independently prove that the individual product is
contaminated") with the genuine tx in the receipt. Partners report
quarantine/removal in their vaults — shown as a **partner-reported, off-chain
attestation**, never called cryptographically verified.

Optional: scan Passport B → **NO VERIFIED MATCH FOUND** in neutral blue
("not a guarantee that the product is safe"), listing every source checked.

## Reliability

- Cached FDA/CDC snapshots take over automatically if live fetches fail
  (badged CACHED).
- `RECALLLENS_USE_LIVE=0` runs the clearly-badged deterministic fallback — say
  so if used; never call it a live proof. Fallback proofs show "previously
  verified during demo setup" (never fabricated tx text).
- A failed genuine proof surfaces its error and allows retry; success is never
  simulated.
- Reset between runs: `npm run demo:reset && npm run demo:seed`.
