/**
 * Consumer Recall Intelligence engine.
 *
 * Classifies a scanned product into exactly ONE primary evidence level, with a
 * full evidence receipt (source, timestamps, matched/missing fields, and why
 * the level was chosen). No opaque confidence score — the exact evidence is
 * shown.
 *
 * Source precedence (checked in order, strongest evidence wins):
 *   1. Official FDA advisory identifiers  → EXACT_OFFICIAL_RECALL_MATCH /
 *      POSSIBLE_ADVISORY_MATCH
 *   2. RecallLens authorized recall predicate → AUTHORIZED_RECALL_MATCH
 *   3. RecallLens Sentinel precautionary hold → PROOF_VERIFIED_PRECAUTIONARY_HOLD
 *   4. Nothing / inadequate input → NO_VERIFIED_MATCH / INSUFFICIENT_DATA
 *
 * Note the ordering nuance: an AUTHORIZED recall outranks a plain hold; an
 * exact OFFICIAL match outranks both because it is government-confirmed.
 */
import type { EvidenceLevel, EvidenceReceipt, EvidenceSource } from "@recalllens/schemas";
import { getFdaAdvisory, type FdaAdvisoryResult } from "./fda-adapter";

export interface ScanInput {
  gtin?: string;
  lot?: string;
  expiry?: string; // ISO or as-printed
  productName?: string;
  /** validated passport info, if a signed RecallLens passport was scanned */
  passport?: { valid: boolean; issuer: string; passportId: string; tampered: boolean } | null;
}

export interface NetworkEvidence {
  /** passport commitment is a member of an active proof-backed hold */
  holdMember: boolean;
  holdTxId: string | null;
  /** an authorized RecallLens recall predicate matches */
  recallAuthorized: boolean;
  recallTxId: string | null;
  network: string | null;
  live: boolean;
}

const SAFETY_DISCLAIMER =
  "This is not a guarantee that the product is safe, and not a medical diagnosis. Follow current CDC/FDA guidance.";

function months(s: string): string {
  // normalize "February 9, 2028" ↔ "2028-02-09" comparisons
  const MONTHS = ["january","february","march","april","may","june","july","august","september","october","november","december"];
  const m1 = s.toLowerCase().match(/([a-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (m1) {
    const mi = MONTHS.indexOf(m1[1]);
    if (mi >= 0) return `${m1[3]}-${String(mi + 1).padStart(2, "0")}-${m1[2].padStart(2, "0")}`;
  }
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m2) return s;
  return s.toLowerCase();
}

/**
 * Classify a scan. `fetchAdvisory` is injectable for tests; defaults to the
 * live-or-cached FDA blueberries advisory (the demo's official-recall source).
 */
export async function classifyScan(
  input: ScanInput,
  network: NetworkEvidence,
  opts: {
    fetchAdvisory?: () => Promise<FdaAdvisoryResult>;
    now?: () => Date;
  } = {},
): Promise<EvidenceReceipt> {
  const now = opts.now ?? (() => new Date());
  const fetchAdvisory = opts.fetchAdvisory ?? (() => getFdaAdvisory("blueberries"));

  const base = {
    fieldsMatched: [] as { field: string; value: string }[],
    fieldsMissing: [] as string[],
    midnightInvolved: false,
    txId: null as string | null,
    network: null as string | null,
    syntheticData: false,
    dataLeftDevice:
      "Only the confirmed product identifiers (GTIN, lot, date) were sent to the RecallLens verification service. No image or personal data left the device.",
    passport: input.passport ?? null,
  };

  // INSUFFICIENT_DATA: no usable identifier at all.
  if (!input.gtin && !input.productName) {
    return receipt("INSUFFICIENT_DATA", {
      ...base,
      headline: "INSUFFICIENT DATA",
      explanation:
        "The scan did not yield a usable product identifier (GTIN/UPC or product name).",
      guidance: "Rescan the barcode, upload a clearer photo, or enter the details manually.",
      whyThisLevel: "No GTIN/UPC or product name was extracted from the scan.",
      source: null,
    });
  }

  /* ── 1. Official FDA advisory check ─────────────────────────────────── */
  let advisory: FdaAdvisoryResult | null = null;
  try {
    advisory = await fetchAdvisory();
  } catch {
    advisory = null; // engine still works from network + no-match levels
  }

  if (advisory) {
    const rec = advisory.advisory.recall;
    const source: EvidenceSource = {
      authority: "FDA outbreak advisory",
      kind: "official",
      url: advisory.sourceUrl,
      sourceTimestamp: advisory.advisory.lastUpdated,
      retrievedAt: advisory.retrievedAt,
      live: advisory.live,
      cadenceNote: advisory.live
        ? "Fetched live from fda.gov this session"
        : "Cached official snapshot (live fetch unavailable)",
    };

    const nameMatch =
      !!input.productName &&
      !!rec.brand &&
      input.productName.toLowerCase().includes(rec.brand.toLowerCase()) &&
      /blueberr/i.test(input.productName);
    const lotMatch = !!input.lot && !!rec.lotCode && input.lot.trim() === rec.lotCode;
    const dateMatch =
      !!input.expiry && !!rec.bestByDate && months(input.expiry) === months(rec.bestByDate);

    // Exact match requires the lot plus at least one corroborating identifier
    // (brand/product name, or the printed best-by date) — two independent
    // identifiers from the official advisory.
    if (lotMatch && (nameMatch || dateMatch)) {
      const matched = [
        ...(nameMatch ? [{ field: "brand/product", value: input.productName! }] : []),
        { field: "lot", value: input.lot! },
        ...(dateMatch ? [{ field: "best-by", value: input.expiry! }] : []),
        ...(rec.packageSize ? [{ field: "package size (advisory)", value: rec.packageSize }] : []),
      ];
      return receipt("EXACT_OFFICIAL_RECALL_MATCH", {
        ...base,
        fieldsMatched: matched,
        fieldsMissing: [
          ...(dateMatch ? [] : ["best-by date"]),
          "GTIN/UPC (not printed on the FDA advisory)",
        ],
        headline: "EXACT OFFICIAL RECALL MATCH",
        explanation: `${advisory.advisory.productDescription} Recalling firm: ${rec.recallingFirm ?? "see advisory"}. Distribution: ${rec.distributionStates.join(", ") || "see advisory"}. Status: ${advisory.advisory.status}.`,
        guidance:
          "Do not eat, sell, or serve this product. Throw it away or return it to the place of purchase.",
        whyThisLevel:
          "The scanned identifiers (exact lot code plus a corroborating identifier) match those printed on the official FDA advisory.",
        source,
      });
    }

    if (nameMatch && !lotMatch) {
      return receipt("POSSIBLE_ADVISORY_MATCH", {
        ...base,
        fieldsMatched: [{ field: "brand/product", value: input.productName! }],
        fieldsMissing: [
          input.lot ? `lot (scanned "${input.lot}" ≠ advisory "${rec.lotCode}")` : "lot code",
          ...(input.expiry ? [] : ["best-by date"]),
        ],
        headline: "POSSIBLE MATCH—VERIFY LOT",
        explanation: `The product/brand may match an active FDA advisory (${advisory.advisory.title}), but the exact lot could not be confirmed.`,
        guidance:
          "Check the printed lot code and best-by date on your package against the official advisory before consuming.",
        whyThisLevel:
          "Product/brand matched the advisory but the lot code did not match or was missing.",
        source,
      });
    }
  }

  /* ── 2. Authorized RecallLens recall predicate ──────────────────────── */
  if (network.recallAuthorized && input.passport?.valid) {
    return receipt("AUTHORIZED_RECALL_MATCH", {
      ...base,
      fieldsMatched: [
        { field: "product passport", value: input.passport.passportId.slice(0, 12) + "…" },
        ...(input.lot ? [{ field: "lot", value: input.lot }] : []),
      ],
      fieldsMissing: [],
      headline: "AFFECTED PRODUCT CONFIRMED",
      explanation:
        "An investigator converted the proof-verified precautionary hold into an authorized RecallLens demonstration recall, and this product's signed passport intersects the affected predicate. This is a RecallLens network action, not an FDA recall.",
      guidance:
        "Do not consume this product. Return it to the place of purchase or discard it, and monitor official updates.",
      whyThisLevel:
        "Valid passport signature + membership in the authorized recall predicate anchored on Midnight.",
      source: networkSource(network),
      midnightInvolved: true,
      txId: network.recallTxId,
      network: network.network,
      syntheticData: true,
    });
  }

  /* ── 3. Proof-verified precautionary hold ───────────────────────────── */
  if (network.holdMember && input.passport?.valid) {
    return receipt("PROOF_VERIFIED_PRECAUTIONARY_HOLD", {
      ...base,
      fieldsMatched: [
        { field: "product passport", value: input.passport.passportId.slice(0, 12) + "…" },
        ...(input.lot ? [{ field: "lot", value: input.lot }] : []),
      ],
      fieldsMissing: [],
      headline: "PROOF-VERIFIED PRECAUTIONARY HOLD",
      explanation:
        "This lot is connected to a private supply lineage currently under investigation. It is not yet an official government recall. Do not consume it pending review.",
      guidance:
        "Set the product aside. Check back for the official outcome of the investigation.",
      whyThisLevel:
        "Valid passport signature + the passport commitment is a member of an active RecallLens Sentinel hold backed by genuine Midnight state.",
      source: networkSource(network),
      midnightInvolved: true,
      txId: network.holdTxId,
      network: network.network,
      syntheticData: true,
    });
  }

  /* ── 4. Tampered passport is worth surfacing explicitly ─────────────── */
  if (input.passport && input.passport.tampered) {
    return receipt("INSUFFICIENT_DATA", {
      ...base,
      headline: "PASSPORT SIGNATURE INVALID",
      explanation:
        "The scanned RecallLens product passport failed signature verification — the label may be damaged, altered, or counterfeit.",
      guidance:
        "Do not rely on this label. Verify the product against official recall sources using its printed identifiers.",
      whyThisLevel: "The passport signature did not verify against the issuer key.",
      source: null,
    });
  }

  /* ── 5. No verified match ───────────────────────────────────────────── */
  return receipt("NO_VERIFIED_MATCH", {
    ...base,
    fieldsMatched: [
      ...(input.gtin ? [{ field: "GTIN", value: input.gtin }] : []),
      ...(input.lot ? [{ field: "lot", value: input.lot }] : []),
    ],
    fieldsMissing: input.lot ? [] : ["lot code (improves matching precision)"],
    headline: "NO VERIFIED MATCH FOUND",
    explanation:
      "RecallLens found no matching official recall or proof-verified RecallLens hold. This is not a guarantee that the product is safe.",
    guidance: "Follow general food-safety guidance and monitor official updates.",
    whyThisLevel:
      "The identifiers did not match any active official advisory, authorized recall predicate, or Sentinel hold.",
    source: advisory
      ? {
          authority: "FDA outbreak advisory (checked, no match)",
          kind: "official",
          url: advisory.sourceUrl,
          sourceTimestamp: advisory.advisory.lastUpdated,
          retrievedAt: advisory.retrievedAt,
          live: advisory.live,
          cadenceNote: null,
        }
      : null,
  });

  function receipt(
    level: EvidenceLevel,
    fields: Omit<EvidenceReceipt, "level" | "safetyDisclaimer"> &
      Partial<Pick<EvidenceReceipt, "safetyDisclaimer">>,
  ): EvidenceReceipt {
    void now;
    return {
      level,
      safetyDisclaimer: SAFETY_DISCLAIMER,
      ...fields,
    } as EvidenceReceipt;
  }
}

function networkSource(network: NetworkEvidence): EvidenceSource {
  return {
    authority: "RecallLens network (Midnight)",
    kind: "network",
    url: null,
    sourceTimestamp: null,
    retrievedAt: new Date().toISOString(),
    live: network.live,
    cadenceNote: network.live
      ? "Read from live Midnight devnet state"
      : "Deterministic fallback state (not a live chain read)",
  };
}
