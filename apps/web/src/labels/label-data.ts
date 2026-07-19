/**
 * Deterministic physical-demo label definitions.
 *
 * RecallLens passports encode ONLY public lookup keys (GTIN + lot + expiry) +
 * a random high-entropy passport ID + issuer + ECDSA signature, as a GS1
 * Digital Link. No lineage token, secret, or key material is on any label.
 *
 * Passport IDs are FIXED so printed labels stay valid across demo resets and
 * Passport A's commitment matches the Sentinel hold set.
 *
 * PHYSICAL-FACING NAMES ARE NEUTRAL (Passport A / Passport B / Partner
 * Shipment): the printed card never reveals the expected scan outcome — the
 * signed payload and the live network state determine the result. The
 * presenter mapping lives in docs/DEMO_SCRIPT.md, not on the card.
 */
import {
  issuePassport,
  passportToDigitalLink,
  type Gs1Data,
  type ProductPassport,
} from "@recalllens/gs1";

export const LABEL_BASE = "https://id.recalllens.demo";

export interface DemoLabel {
  id: "passport-a" | "passport-b" | "partner-shipment";
  /** printed on the card — outcome-neutral */
  title: string;
  /** printed on the card — outcome-neutral */
  subtitle: string;
  data: Gs1Data;
  /** fixed passport id (hex 32) — deterministic across resets */
  passportId: string;
  synthetic: true;
}

/** Passport A — Northstar's processed retail lot (presenter doc: this is the
 * lot that intersects the Sentinel hold / authorized recall scope). */
export const LABEL_A: DemoLabel = {
  id: "passport-a",
  title: "RecallLens Synthetic Product Passport A",
  subtitle: "Scan in Consumer Check — the live network state decides the result",
  data: { gtin: "00810099110042", lot: "NFP-SHRED-26164-07", expiry: "2026-06-28" },
  passportId: "a11ec7ed0000000000000000000c0de5",
  synthetic: true,
};

/** Passport B — the Sierra Verde lot (presenter doc: control). */
export const LABEL_B: DemoLabel = {
  id: "passport-b",
  title: "RecallLens Synthetic Product Passport B",
  subtitle: "Scan in Consumer Check — the live network state decides the result",
  data: { gtin: "00810099110042", lot: "SVG-ICE-26171-B", expiry: "2026-07-05" },
  passportId: "c0ffee0000000000000000000000c1ea",
  synthetic: true,
};

/** Partner shipment passport — Meridian scans this in its vault (same lot as A). */
export const LABEL_PARTNER: DemoLabel = {
  id: "partner-shipment",
  title: "RecallLens Synthetic Partner Shipment Passport",
  subtitle: "Scanned inside the Partner Vault to locate the committed record",
  data: { gtin: "00810099110042", lot: "NFP-SHRED-26164-07", expiry: "2026-06-28" },
  passportId: "5b1b0e000000000000000000005b1b0e",
  synthetic: true,
};

/* Back-compat aliases for existing imports (Sentinel hold set uses A). */
export const LABEL_AFFECTED = LABEL_A;
export const LABEL_CONTROL = LABEL_B;

export const DEMO_LABELS: DemoLabel[] = [LABEL_A, LABEL_B, LABEL_PARTNER];

/** Issue the signed passport for a demo label (deterministic passportId). */
export async function labelPassport(label: DemoLabel): Promise<ProductPassport> {
  return issuePassport({ ...label.data, passportId: label.passportId });
}

export async function labelDigitalLink(label: DemoLabel): Promise<string> {
  return passportToDigitalLink(await labelPassport(label), LABEL_BASE);
}

/* ── FDA official recall TEST CARD (public identifiers, not a passport) ── */

export const FDA_TEST_CARD = {
  title: "FDA OFFICIAL RECALL TEST CARD—PUBLIC IDENTIFIERS, NOT ORIGINAL PACKAGING",
  productName: "GreenWise Organic IQF Frozen Blueberries",
  size: "10 oz",
  lot: "60401",
  bestBy: "February 9, 2028",
  bestByIso: "2028-02-09",
  sourceUrl:
    "https://www.fda.gov/food/outbreaks-foodborne-illness/outbreak-investigation-e-coli-frozen-blueberries-july-2026",
  note: "Identifiers are printed on the public FDA advisory. Scanning this card checks them against the live/cached official source. Do not obtain recalled food — use this printed card.",
  /** plain (unsigned) element string for the QR — this is NOT a RecallLens
   * passport; it carries ONLY the identifiers the FDA advisory actually
   * publishes: lot (AI 10) + best-by (AI 17). The advisory publishes NO
   * GTIN/UPC and we never fabricate one. */
  qrPayload: "(10)60401(17)280209",
} as const;
