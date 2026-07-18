/**
 * SYNTHETIC DEMONSTRATION DATA — private trace events for the demo network.
 *
 * The affected lot carries one shared random 256-bit lineage token
 * (AFFECTED_LINEAGE_TOKEN) propagated farm → processor → distributor →
 * restaurant, which is what lets three independent organizations prove
 * convergence on the same lineage without revealing their records.
 *
 * A second, unrelated lineage (CLEAN_LINEAGE_TOKEN) exercises the
 * "unrelated lineage does not converge" path and the targeted-recall
 * blast-radius comparison.
 *
 * All GLNs/GTINs are syntactically valid but fictional.
 */
import type { TraceEvent } from "@recalllens/schemas";

/** Random 256-bit lineage token for the affected lot (fixture constant). */
export const AFFECTED_LINEAGE_TOKEN =
  "7f3a2b911d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8";

/** Lineage token for an unrelated clean lot. */
export const CLEAN_LINEAGE_TOKEN =
  "0badf00d5eed0000aa11bb22cc33dd44ee55ff660000000000000000000000aa";

/** Fictional GTIN for "shredded iceberg lettuce, 5 lb foodservice case". */
export const LETTUCE_GTIN = "00810099110042";

// The July 2026 case window used by the demo outbreak case (public):
// harvest-to-service window covering the fixture events below.
export const CASE_WINDOW_START = "2026-06-01T00:00:00Z";
export const CASE_WINDOW_END = "2026-07-18T00:00:00Z";

const base = {
  productGtin: LETTUCE_GTIN,
  productDescription: "Shredded iceberg lettuce, 5 lb foodservice case",
  quantityUom: "CS" as const,
};

/**
 * Affected-lineage events. One per organization so that farm, processor and
 * distributor (and restaurant, as a 4th) can each prove an independent
 * private record intersecting the same lineage.
 */
export const affectedEvents: Record<string, TraceEvent> = {
  "org-sierra-verde": {
    ...base,
    eventId: "evt-svg-0611-hrv",
    eventType: "ObjectEvent",
    eventTime: "2026-06-11T14:30:00Z",
    bizStep: "harvesting",
    sourceGln: "0810099000017", // Sierra Verde field station (fictional)
    destinationGln: "0810099000024", // Northstar intake dock (fictional)
    lotCode: "SVG-ICE-26162-A",
    quantity: 640,
    lineageToken: AFFECTED_LINEAGE_TOKEN,
    blinding: "a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1",
  },
  "org-northstar": {
    ...base,
    eventId: "evt-nfp-0613-prc",
    eventType: "TransformationEvent",
    eventTime: "2026-06-13T09:15:00Z",
    bizStep: "processing",
    sourceGln: "0810099000024",
    destinationGln: "0810099000031", // Meridian cross-dock (fictional)
    lotCode: "NFP-SHRED-26164-07",
    quantity: 590,
    lineageToken: AFFECTED_LINEAGE_TOKEN,
    parentLineageToken: AFFECTED_LINEAGE_TOKEN,
    blinding: "b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2",
  },
  "org-meridian": {
    ...base,
    eventId: "evt-mcc-0615-shp",
    eventType: "ObjectEvent",
    eventTime: "2026-06-15T22:40:00Z",
    bizStep: "shipping",
    sourceGln: "0810099000031",
    destinationGln: "0810099000048", // QuickServe regional DC (fictional)
    lotCode: "MCC-OUT-26166-114",
    quantity: 560,
    lineageToken: AFFECTED_LINEAGE_TOKEN,
    blinding: "c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3",
    sensorSummary: { minTempC: 1.2, maxTempC: 4.9, breached: false },
  },
  "org-quickserve": {
    ...base,
    eventId: "evt-qsr-0618-rcv",
    eventType: "ObjectEvent",
    eventTime: "2026-06-18T07:05:00Z",
    bizStep: "receiving",
    sourceGln: "0810099000048",
    destinationGln: "0810099000055", // QuickServe store cluster (fictional)
    lotCode: "QSR-RCV-26169-330",
    quantity: 540,
    lineageToken: AFFECTED_LINEAGE_TOKEN,
    blinding: "d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4",
  },
};

/** A clean, unrelated lot from the same farm — must NOT converge. */
export const cleanEvents: Record<string, TraceEvent> = {
  "org-sierra-verde": {
    ...base,
    eventId: "evt-svg-0620-hrv-clean",
    eventType: "ObjectEvent",
    eventTime: "2026-06-20T13:00:00Z",
    bizStep: "harvesting",
    sourceGln: "0810099000017",
    destinationGln: "0810099000062", // different processor (fictional)
    lotCode: "SVG-ICE-26171-B",
    quantity: 480,
    lineageToken: CLEAN_LINEAGE_TOKEN,
    blinding: "e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5",
  },
};

export const allEvents: TraceEvent[] = [
  ...Object.values(affectedEvents),
  ...Object.values(cleanEvents),
];

/**
 * Private vault lookup: GTIN+lot → lineage token. This is what a scanned
 * physical label resolves against, INSIDE the private vault. The label carries
 * only the public GTIN+lot (lookup keys); the high-entropy lineage token stays
 * private and never appears on the label or the public ledger.
 *
 * The affected retail lot is Northstar's processed lot; the control is the
 * clean Sierra Verde lot. A GTIN+lot with no vault entry resolves to null →
 * "no verified intersection found" (never a fabricated affected result).
 */
export interface VaultLotEntry {
  gtin: string;
  lot: string;
  lineageToken: string;
  synthetic: true;
}

export const vaultLots: VaultLotEntry[] = [
  {
    gtin: LETTUCE_GTIN,
    lot: "NFP-SHRED-26164-07",
    lineageToken: AFFECTED_LINEAGE_TOKEN,
    synthetic: true,
  },
  {
    gtin: LETTUCE_GTIN,
    lot: "SVG-ICE-26171-B",
    lineageToken: CLEAN_LINEAGE_TOKEN,
    synthetic: true,
  },
];

export function lookupVaultLot(
  gtin: string,
  lot: string,
): VaultLotEntry | null {
  return (
    vaultLots.find(
      (v) => v.gtin === gtin && v.lot.toUpperCase() === lot.toUpperCase(),
    ) ?? null
  );
}
