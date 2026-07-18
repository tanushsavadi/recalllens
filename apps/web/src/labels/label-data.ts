/**
 * Deterministic physical-demo label definitions.
 *
 * RecallLens passports encode ONLY public lookup keys (GTIN + lot + expiry) +
 * a random high-entropy passport ID + issuer + ECDSA signature, as a GS1
 * Digital Link. No lineage token, secret, or key material is on any label.
 *
 * Passport IDs are FIXED so printed labels stay valid across demo resets and
 * the affected passport's commitment matches the Sentinel hold set.
 */
import {
  issuePassport,
  passportToDigitalLink,
  type Gs1Data,
  type ProductPassport,
} from "@recalllens/gs1";

export const LABEL_BASE = "https://id.recalllens.demo";

export interface DemoLabel {
  id: "affected" | "control" | "partner-shipment";
  title: string;
  subtitle: string;
  data: Gs1Data;
  /** fixed passport id (hex 32) — deterministic across resets */
  passportId: string;
  synthetic: true;
}

/** Consumer affected passport — Northstar's processed retail lot. */
export const LABEL_AFFECTED: DemoLabel = {
  id: "affected",
  title: "Affected demonstration passport",
  subtitle: "Intersects the Sentinel hold; after authorization: affected product confirmed",
  data: { gtin: "00810099110042", lot: "NFP-SHRED-26164-07", expiry: "2026-06-28" },
  passportId: "a11ec7ed0000000000000000000c0de5",
  synthetic: true,
};

/** Consumer unaffected control passport — the clean Sierra Verde lot. */
export const LABEL_CONTROL: DemoLabel = {
  id: "control",
  title: "Control (unaffected) demonstration passport",
  subtitle: "Returns no verified match",
  data: { gtin: "00810099110042", lot: "SVG-ICE-26171-B", expiry: "2026-07-05" },
  passportId: "c0ffee0000000000000000000000c1ea",
  synthetic: true,
};

/** Partner shipment label — Meridian scans this in its vault (same lot). */
export const LABEL_PARTNER: DemoLabel = {
  id: "partner-shipment",
  title: "Partner shipment label (Meridian Cold Chain)",
  subtitle: "Scanned inside the Partner Vault to locate the committed record",
  data: { gtin: "00810099110042", lot: "NFP-SHRED-26164-07", expiry: "2026-06-28" },
  passportId: "5b1b0e000000000000000000005b1b0e",
  synthetic: true,
};

export const DEMO_LABELS: DemoLabel[] = [LABEL_AFFECTED, LABEL_CONTROL, LABEL_PARTNER];

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
   * passport; it carries only the public FDA identifiers */
  qrPayload: "(01)00000000060401(10)60401(17)280209",
} as const;
