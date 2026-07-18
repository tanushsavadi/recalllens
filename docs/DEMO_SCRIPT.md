# RecallLens — Demo Script

**Tagline:** "Find the source, not the secrets."

**Presenter disclosure (say this up front):**
"The government source data is real. The physical scans, Compact proofs,
Midnight transactions and encrypted workflow are genuine. The participating
companies and private supply records are synthetic because real companies do
not publish their supply graphs — that is precisely the problem RecallLens
solves."

## Pre-flight

```bash
npm run health          # devnet + API green
npm run demo:reset && npm run demo:seed   # fresh state:
                        #   Sentinel 2/3 signals · trace 2/3 proofs (~4 min)
npm run demo:api        # live-devnet API
npm run dev:web         # http://127.0.0.1:5173
```

Print the demo kit from `/labels`: affected passport (tape to a safe lettuce
bag), control passport, partner shipment label, FDA blueberries test card.

## DEMO A — Official consumer recall (~40s, real government data)

1. Consumer Check → Enter values manually (or scan the FDA test card).
2. GTIN `00000000060401` · lot `60401` · best-by `2028-02-09` · product
   "GreenWise Organic IQF Frozen Blueberries".
3. → **EXACT OFFICIAL RECALL MATCH** with the FDA source link, live/cached
   status, update + retrieval timestamps, matched fields.
4. Point out: no Midnight claim here — this is pure official-source
   verification, and the receipt says exactly that.

## DEMO B — RecallLens end-to-end (~90s guided + one longer proof)

**Detect (Sentinel).** Open Sentinel: 2 signals privately verified (Day −9 QA,
Day −7 cold-chain), third awaiting its owner. Click "Review as owner" →
"Acting as QuickServe" → **Approve final signal proof** → genuine
`submitSafetySignal` settles (~60s) → **EARLY RISK CONVERGENCE DETECTED**
("not yet a confirmed outbreak").

**Contain.** Issue confidential precautionary hold → genuine
`issuePrecautionaryHold` anchors the hold commitment.

**Warn early.** Scan the lettuce passport as a consumer →
**PROOF-VERIFIED PRECAUTIONARY HOLD** — "not yet an official government
recall" — with the anchor tx in the evidence receipt.

**Trace.** Investigation → Send private-match request (note: the investigator
has no proof button — it *cannot* run Meridian's proof). Switch to Vault →
Meridian → the exact predicate is shown → scan the partner shipment label
(GTIN `00810099110042`, lot `NFP-SHRED-26164-07`) → committed record located →
**Approve and generate private proof** → genuine `proveRelevantEvent` (~60s) →
back on Investigation: **SHARED SUPPLY LINEAGE VERIFIED** — "narrows the
investigation but does not independently establish contamination or
causation."

**Disclose minimally.** In Meridian's vault: approve sourceGln + lotCode +
eventDate, reject destinationGln → "Encrypt approved fields" (in-browser
ECDH+AES-GCM; only ciphertext transits) → Investigation: decrypt →
**PROBABLE SOURCE NARROWED**.

**Act.** Issue targeted confidential hold → authorize → **AUTHORIZED
RECALLLENS DEMONSTRATION RECALL** (never called an FDA recall). The
blast-radius panel stays labeled "Simulated impact using demonstration supply
records."

**Protect + prove removal.** Re-scan the lettuce → **AFFECTED PRODUCT
CONFIRMED** with official general safety guidance and the genuine tx evidence
in the receipt. Partners confirm quarantine/removal in their vaults.

Optional: scan the control passport → **NO VERIFIED MATCH FOUND** ("not a
guarantee that the product is safe").

## Reliability

- Cached FDA/CDC snapshots take over automatically if live fetches fail
  (badged CACHED).
- `RECALLLENS_USE_LIVE=0` runs the clearly-badged deterministic fallback — say
  so if used; never call it a live proof.
- A failed genuine proof surfaces its error and allows retry; success is never
  simulated.
- Reset between runs: `npm run demo:reset && npm run demo:seed`.
