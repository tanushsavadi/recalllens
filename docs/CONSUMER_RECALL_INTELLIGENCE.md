# Consumer Recall Intelligence

The consumer verify pipeline returns exactly ONE primary evidence level with a
full **evidence receipt** (no opaque confidence scores — the exact evidence is
shown).

## Pipeline (Scan → Confirm → Verify → Result)

1. **Scan** — camera (BarcodeDetector → ZXing fallback), image upload (barcode
   → local OCR fallback), or manual entry. All image processing is on-device;
   only confirmed identifiers are transmitted.
2. **Confirm** — GTIN, lot, best-by, optional product name; extraction method
   shown; every field correctable.
3. **Verify** — precedence order (strongest wins):
   1. Official FDA advisory identifiers (live-or-cached, provenance attached)
   2. Authorized RecallLens recall predicate (Midnight-anchored)
   3. Proof-verified Sentinel hold (Midnight-anchored)
   4. No / insufficient evidence
4. **Result** — level + headline + guidance + safety disclaimer + evidence
   receipt.

## Evidence levels

| Level | Headline | Trigger |
|---|---|---|
| EXACT_OFFICIAL_RECALL_MATCH | EXACT OFFICIAL RECALL MATCH | exact lot + ≥1 corroborating identifier (brand/product or best-by) match the official FDA advisory |
| PROOF_VERIFIED_PRECAUTIONARY_HOLD | PROOF-VERIFIED PRECAUTIONARY HOLD | valid passport signature + commitment ∈ active hold (chain-anchored). Copy: "not yet an official government recall" |
| AUTHORIZED_RECALL_MATCH | AFFECTED PRODUCT CONFIRMED | investigator converted the hold into an authorized RecallLens demonstration recall; passport intersects the predicate. Copy: "not an FDA recall" |
| POSSIBLE_ADVISORY_MATCH | POSSIBLE MATCH—VERIFY LOT | brand/category matches, lot/date unconfirmed |
| NO_VERIFIED_MATCH | NO VERIFIED MATCH FOUND | nothing matched. Mandatory copy: "This is not a guarantee that the product is safe." |
| INSUFFICIENT_DATA | INSUFFICIENT DATA / PASSPORT SIGNATURE INVALID | no usable identifiers, or tampered passport |

## Evidence receipt fields

Authority · official/network/synthetic kind · canonical URL · source update
timestamp · retrieval timestamp · live/cached status + cadence note (openFDA
labeled weekly-updated) · fields matched · fields missing · why this level ·
Midnight involvement (+ network & tx id only when a real chain event exists) ·
synthetic-data flag · exactly what left the device · passport validity.

## Truthfulness rules encoded in the engine

- An exact OFFICIAL match outranks all network evidence (government-confirmed
  beats network-verified) — tested.
- Network results are only produced for a passport whose ECDSA signature
  verifies; tampered passports surface "PASSPORT SIGNATURE INVALID".
- "No verified match" never claims safety.
- A hold is never called a recall; an authorized RecallLens recall is never
  called an FDA recall.
- Midnight involvement is only reported when a real anchored event backs it
  (fallback mode reports "no tx" explicitly).

## Sources

FDA advisory pages (live-or-cached, sha256-pinned snapshots), openFDA
enforcement (weekly-updated; 2026 records absent — stated), USDA FoodData
Central (optional key; labeled cached sample otherwise). See
SOURCE_PROVENANCE.md.
