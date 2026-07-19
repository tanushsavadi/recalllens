/**
 * Consumer Recall Intelligence engine.
 *
 * Classifies a scanned product into exactly ONE primary evidence level, with a
 * full evidence receipt. The receipt separates, independently:
 *   1. input provenance (what physically produced the identifiers)
 *   2. every source checked, each with its own result
 *   3. the decision basis for the level
 *   4. Midnight involvement (only true when Midnight-anchored state was used)
 *   5. data provenance (synthetic input vs official sources)
 *   6. exactly which fields left the device
 *
 * Source precedence (checked in order, strongest evidence wins):
 *   1. Official FDA advisory identifiers  → EXACT_OFFICIAL_RECALL_MATCH /
 *      POSSIBLE_ADVISORY_MATCH
 *   2. RecallLens authorized recall scope → AUTHORIZED_RECALL_MATCH
 *   3. RecallLens Sentinel precautionary hold → PROOF_VERIFIED_PRECAUTIONARY_HOLD
 *   4. Nothing / inadequate input → NO_VERIFIED_MATCH / INSUFFICIENT_DATA
 *   5. All sources unreachable → VERIFICATION_UNAVAILABLE
 */
import type {
  DecisionBasis,
  EvidenceLevel,
  EvidenceReceipt,
  EvidenceSource,
  InputProvenance,
  SourceCheck,
} from "@recalllens/schemas";
import { getFdaAdvisory, type FdaAdvisoryResult } from "./fda-adapter";

export interface ScanInput {
  gtin?: string;
  lot?: string;
  expiry?: string; // ISO or as-printed
  productName?: string;
  /** how the identifiers were obtained */
  scanOrigin?: "passport-qr" | "identifier-qr" | "manual";
  /** validated passport info, if a signed RecallLens passport was scanned */
  passport?: { valid: boolean; issuer: string; passportId: string; tampered: boolean } | null;
}

export interface NetworkEvidence {
  /** a Midnight-anchored hold exists for this case */
  holdActive: boolean;
  /** passport commitment is a member of the active proof-backed hold */
  holdMember: boolean;
  holdTxId: string | null;
  /** an authorized RecallLens recall predicate exists */
  recallActive: boolean;
  /** the passport is inside the authorized recall scope */
  recallMember: boolean;
  recallTxId: string | null;
  network: string | null;
  contractAddress: string | null;
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

/** Human network label — never the raw network id ("undeployed"). */
export function networkLabelFor(network: string | null, live: boolean): string | null {
  if (!network) return null;
  if (!live) return "Deterministic fallback (not a live chain read)";
  if (network === "undeployed") return "Local Midnight devnet";
  return `Midnight ${network}`;
}

function inputProvenanceOf(input: ScanInput): { provenance: InputProvenance; synthetic: boolean } {
  if (input.passport) {
    if (input.passport.tampered || !input.passport.valid) {
      return { provenance: "invalid-signature", synthetic: true };
    }
    // Every RecallLens passport is a synthetic demonstration credential.
    return { provenance: "signed-synthetic-passport", synthetic: true };
  }
  if (input.scanOrigin === "identifier-qr") {
    return { provenance: "public-identifier-card", synthetic: false };
  }
  return { provenance: "manual-entry", synthetic: false };
}

function fieldsTransmittedOf(input: ScanInput): string[] {
  const out: string[] = [];
  if (input.gtin) out.push(`GTIN=${input.gtin}`);
  if (input.lot) out.push(`lot=${input.lot}`);
  if (input.expiry) out.push(`best-by=${input.expiry}`);
  if (input.productName) out.push(`product name=${input.productName}`);
  if (input.passport) out.push("passport id + signature (public label fields)");
  return out;
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
  void now;
  const fetchAdvisory = opts.fetchAdvisory ?? (() => getFdaAdvisory("blueberries"));

  const { provenance, synthetic } = inputProvenanceOf(input);

  const noMidnight = (note: string) => ({
    involved: false,
    mode: null,
    networkLabel: null,
    contractAddress: null,
    txId: null,
    note,
  });

  const base = {
    inputProvenance: provenance,
    inputSynthetic: synthetic,
    fieldsMatched: [] as { field: string; value: string }[],
    fieldsMissing: [] as string[],
    midnight: noMidnight("Midnight state was not used for this result."),
    impactSimulated: false,
    dataLeftDevice: {
      fieldsTransmitted: fieldsTransmittedOf(input),
      imageTransmitted: false as const,
      note: "Only the confirmed identifiers above were sent to the RecallLens verification service. The raw image and any personal data never left the device.",
    },
    passport: input.passport ?? null,
  };

  /* ── source checks (each recorded independently) ─────────────────────── */

  let advisory: FdaAdvisoryResult | null = null;
  let advisoryError: string | null = null;
  try {
    advisory = await fetchAdvisory();
  } catch (e) {
    advisoryError = e instanceof Error ? e.message : String(e);
  }

  const checks: SourceCheck[] = [];

  // INSUFFICIENT_DATA: no usable identifier at all (checked before sources —
  // there is nothing to look up).
  if (!input.gtin && !input.productName && !input.lot) {
    return receipt("INSUFFICIENT_DATA", "insufficient-identifiers", {
      ...base,
      sourcesChecked: [
        {
          system: "On-device scan",
          kind: "device",
          result: "no usable identifier extracted",
          live: null,
          detail: null,
        },
      ],
      headline: "INSUFFICIENT DATA",
      explanation:
        "The scan did not yield a usable product identifier (GTIN/UPC, lot code, or product name).",
      guidance: "Rescan the barcode, upload a clearer photo, or enter the details manually.",
      whyThisLevel: "No GTIN/UPC, lot code, or product name was extracted from the scan.",
      source: null,
    });
  }

  /* FDA advisory check */
  let officialLevel: "exact" | "possible" | "none" = "none";
  let officialMatched: { field: string; value: string }[] = [];
  if (advisory) {
    const rec = advisory.advisory.recall;
    const nameMatch =
      !!input.productName &&
      !!rec.brand &&
      input.productName.toLowerCase().includes(rec.brand.toLowerCase()) &&
      /blueberr/i.test(input.productName);
    const lotMatch = !!input.lot && !!rec.lotCode && input.lot.trim() === rec.lotCode;
    const dateMatch =
      !!input.expiry && !!rec.bestByDate && months(input.expiry) === months(rec.bestByDate);
    if (lotMatch && (nameMatch || dateMatch)) {
      officialLevel = "exact";
      officialMatched = [
        ...(nameMatch ? [{ field: "brand/product", value: input.productName! }] : []),
        { field: "lot", value: input.lot! },
        ...(dateMatch ? [{ field: "best-by", value: input.expiry! }] : []),
        ...(rec.packageSize ? [{ field: "package size (advisory)", value: rec.packageSize }] : []),
      ];
    } else if (nameMatch && !lotMatch) {
      officialLevel = "possible";
    }
    checks.push({
      system: "FDA outbreak advisory",
      kind: "official",
      result:
        officialLevel === "exact"
          ? "exact identifier match"
          : officialLevel === "possible"
            ? "possible brand match — lot not confirmed"
            : "no match",
      live: advisory.live,
      detail: advisory.live
        ? "Fetched live from fda.gov this session"
        : "Cached official snapshot (live fetch unavailable)",
    });
  } else {
    checks.push({
      system: "FDA outbreak advisory",
      kind: "official",
      result: "unavailable",
      live: false,
      detail: advisoryError,
    });
  }

  /* RecallLens hold / recall-scope checks. Membership requires a valid signed
   * passport; without one the systems are still reported — as not applicable.
   * The system names say precisely what each check is: the hold COMMITMENT is
   * Midnight-anchored; the action is a targeted RecallLens action (never an
   * FDA recall). */
  const passportValid = !!input.passport?.valid;
  checks.push({
    system: "RecallLens Midnight-anchored hold",
    kind: "network",
    result: !network.holdActive
      ? "none active"
      : !passportValid
        ? "active — not checked (requires a signed passport)"
        : network.holdMember
          ? "match — passport is in the active hold set"
          : "no match",
    live: network.holdActive ? network.live : null,
    detail: network.holdActive && network.holdTxId ? `anchor tx ${network.holdTxId}` : null,
  });
  checks.push({
    system: "RecallLens authorized action",
    kind: "network",
    result: !network.recallActive
      ? "none authorized"
      : !passportValid
        ? "authorized — not checked (requires a signed passport)"
        : network.recallMember
          ? "match — passport is inside the authorized scope"
          : "no match",
    live: network.recallActive ? network.live : null,
    detail: network.recallActive && network.recallTxId ? `authorization tx ${network.recallTxId}` : null,
  });
  if (input.passport) {
    checks.push({
      system: "Passport signature",
      kind: "device",
      result: input.passport.valid ? "valid" : "INVALID",
      live: null,
      detail: `issuer ${input.passport.issuer} (synthetic demonstration credential)`,
    });
  }

  /** Midnight involvement: true only when Midnight-anchored state (an active
   * hold or authorized recall) was actually consulted for this scan. */
  const midnightConsulted = passportValid && (network.holdActive || network.recallActive);
  const midnightInfo = midnightConsulted
    ? {
        involved: true,
        mode: (network.live ? "live-devnet" : "deterministic-fallback") as
          | "live-devnet"
          | "deterministic-fallback",
        networkLabel: networkLabelFor(network.network, network.live),
        contractAddress: network.contractAddress,
        txId: network.recallMember
          ? network.recallTxId
          : network.holdMember
            ? network.holdTxId
            : (network.recallTxId ?? network.holdTxId),
        note: network.live
          ? "Hold/recall commitments are anchored on Midnight; set membership is resolved by the RecallLens service against the anchored commitment (documented demo limitation)."
          : "Deterministic fallback state — no live chain read, no transaction.",
      }
    : noMidnight(
        network.holdActive || network.recallActive
          ? "A Midnight-anchored hold/recall exists but membership requires a signed passport, which this scan did not include."
          : "No Midnight-anchored hold or authorized recall was active to check.",
      );

  /* ── 1. Official FDA advisory (strongest evidence) ───────────────────── */
  if (advisory && officialLevel === "exact") {
    const rec = advisory.advisory.recall;
    return receipt("EXACT_OFFICIAL_RECALL_MATCH", "official-exact-identifiers", {
      ...base,
      sourcesChecked: checks,
      fieldsMatched: officialMatched,
      fieldsMissing: ["GTIN/UPC — not provided by the FDA advisory"],
      headline: "EXACT OFFICIAL RECALL MATCH",
      explanation: `${advisory.advisory.productDescription} Recalling firm: ${rec.recallingFirm ?? "see advisory"}. Distribution: ${rec.distributionStates.join(", ") || "see advisory"}. Status: ${advisory.advisory.status}.`,
      guidance:
        "Do not eat, sell, or serve this product. Throw it away or return it to the place of purchase.",
      whyThisLevel:
        "The scanned identifiers (exact lot code plus a corroborating identifier) match those printed on the official FDA advisory.",
      source: officialSource(advisory),
      midnight: noMidnight(
        "This result comes purely from the official FDA source; Midnight state was not needed.",
      ),
    });
  }

  if (advisory && officialLevel === "possible") {
    const rec = advisory.advisory.recall;
    return receipt("POSSIBLE_ADVISORY_MATCH", "official-possible-brand", {
      ...base,
      sourcesChecked: checks,
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
      source: officialSource(advisory),
    });
  }

  /* ── 2. Authorized RecallLens recall scope ──────────────────────────── */
  if (network.recallActive && network.recallMember && passportValid) {
    return receipt("AUTHORIZED_RECALL_MATCH", "authorized-recall-scope-membership", {
      ...base,
      sourcesChecked: checks,
      fieldsMatched: [
        { field: "product passport", value: input.passport!.passportId.slice(0, 12) + "…" },
        ...(input.lot ? [{ field: "lot", value: input.lot }] : []),
      ],
      headline: "MATCHES TARGETED RECALL SCOPE",
      explanation:
        "This signed product passport matches the privately verified recall criteria authorized through RecallLens. This does not independently prove that the individual product is contaminated, and it is a RecallLens network action — not an FDA recall.",
      guidance:
        "Do not consume this product. Return it to the place of purchase or discard it, and monitor official updates.",
      whyThisLevel:
        "Valid passport signature + membership in the recall scope an investigator explicitly authorized (anchored on Midnight).",
      source: networkSource(network),
      midnight: midnightInfo,
    });
  }

  /* ── 3. Midnight-anchored precautionary hold ────────────────────────── */
  // Headline is precise about the MVP split: the hold COMMITMENT is anchored
  // on Midnight; passport membership against that commitment is resolved by
  // the RecallLens service (stated again in whyThisLevel + midnight.note).
  if (network.holdActive && network.holdMember && passportValid) {
    return receipt("PROOF_VERIFIED_PRECAUTIONARY_HOLD", "active-hold-membership", {
      ...base,
      sourcesChecked: checks,
      fieldsMatched: [
        { field: "product passport", value: input.passport!.passportId.slice(0, 12) + "…" },
        ...(input.lot ? [{ field: "lot", value: input.lot }] : []),
      ],
      headline: "SIGNED PASSPORT MATCHES A MIDNIGHT-ANCHORED HOLD",
      explanation:
        "This signed RecallLens passport matches a precautionary hold whose commitment is anchored on Midnight. The product is still under investigation. This is not an official government recall and does not prove that the product is contaminated.",
      guidance:
        "Set the product aside and do not consume it while the investigation is pending.",
      whyThisLevel:
        "The passport signature was verified on this device; the precautionary-hold commitment is anchored on the local Midnight devnet; RecallLens resolved this passport's membership against that anchored commitment (membership resolution is service-side in this MVP).",
      source: networkSource(network),
      midnight: midnightInfo,
    });
  }

  /* ── 4. Tampered passport is worth surfacing explicitly ─────────────── */
  if (input.passport && input.passport.tampered) {
    return receipt("INSUFFICIENT_DATA", "invalid-passport-signature", {
      ...base,
      sourcesChecked: checks,
      headline: "PASSPORT SIGNATURE INVALID",
      explanation:
        "The scanned RecallLens product passport failed signature verification — the label may be damaged, altered, or counterfeit.",
      guidance:
        "Do not rely on this label. Verify the product against official recall sources using its printed identifiers.",
      whyThisLevel: "The passport signature did not verify against the issuer key.",
      source: null,
    });
  }

  /* ── 5. All sources unavailable ─────────────────────────────────────── */
  if (!advisory && !network.holdActive && !network.recallActive) {
    return receipt("VERIFICATION_UNAVAILABLE", "sources-unavailable", {
      ...base,
      sourcesChecked: checks,
      headline: "VERIFICATION TEMPORARILY UNAVAILABLE",
      explanation:
        "The official advisory source could not be reached (live or cached) and no RecallLens hold/recall state was available to check.",
      guidance: "Try again shortly, or check the official FDA/CDC recall pages directly.",
      whyThisLevel: "No evidence source could be consulted for this scan.",
      source: null,
    });
  }

  /* ── 6. No verified match across everything actually checked ────────── */
  return receipt("NO_VERIFIED_MATCH", "no-match-across-checked-sources", {
    ...base,
    sourcesChecked: checks,
    fieldsMatched: [
      ...(input.gtin ? [{ field: "GTIN", value: input.gtin }] : []),
      ...(input.lot ? [{ field: "lot", value: input.lot }] : []),
    ],
    fieldsMissing: input.lot ? [] : ["lot code (improves matching precision)"],
    headline: "NO VERIFIED MATCH FOUND",
    explanation:
      "RecallLens found no intersection with the sources checked. This is not a guarantee that the product is safe.",
    guidance: "Follow general food-safety guidance and monitor official updates.",
    whyThisLevel:
      "Each source listed under “sources checked” was consulted and none matched these identifiers.",
    source: advisory ? officialSource(advisory, "FDA outbreak advisory (checked, no match)") : null,
    midnight: midnightInfo,
  });

  function receipt(
    level: EvidenceLevel,
    basis: DecisionBasis,
    fields: Omit<EvidenceReceipt, "level" | "basis" | "safetyDisclaimer"> &
      Partial<Pick<EvidenceReceipt, "safetyDisclaimer">>,
  ): EvidenceReceipt {
    return {
      level,
      basis,
      safetyDisclaimer: SAFETY_DISCLAIMER,
      ...fields,
    } as EvidenceReceipt;
  }
}

function officialSource(advisory: FdaAdvisoryResult, authority = "FDA outbreak advisory"): EvidenceSource {
  return {
    authority,
    kind: "official",
    url: advisory.sourceUrl,
    sourceTimestamp: advisory.advisory.lastUpdated,
    retrievedAt: advisory.retrievedAt,
    live: advisory.live,
    cadenceNote: advisory.live
      ? "Fetched live from fda.gov this session"
      : "Cached official snapshot (live fetch unavailable)",
  };
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
      ? `Read from ${networkLabelFor(network.network, true) ?? "the Midnight network"} · deployed contract`
      : "Deterministic fallback state (not a live chain read)",
  };
}
