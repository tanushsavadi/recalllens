/**
 * SYNTHETIC DEMONSTRATION DATA — store/shipment distribution used to compute
 * the simulated broad-vs-targeted recall comparison.
 *
 * Numbers shown in the UI are DERIVED from these records at runtime; nothing
 * in the interface hardcodes an unexplained impact figure. The comparison is
 * always labeled "Simulated impact using demonstration supply records".
 */
import {
  AFFECTED_LINEAGE_TOKEN,
  CLEAN_LINEAGE_TOKEN,
  LETTUCE_GTIN,
} from "./trace-events";

export interface StoreShipment {
  storeId: string;
  storeName: string;
  state: string;
  productGtin: string;
  lineageToken: string;
  casesReceived: number;
  receivedAt: string;
}

/**
 * QuickServe Restaurant Group's (fictional) store-level receipts for the
 * broad supplier/date range an old-style recall would cover. Only the
 * AFFECTED_LINEAGE_TOKEN shipments intersect the verified lineage.
 */
export const storeShipments: StoreShipment[] = [
  // Affected lineage — 14 stores across the 5 outbreak states
  ...[
    ["IN", "Indianapolis South", 42],
    ["IN", "Fort Wayne Central", 36],
    ["IN", "Evansville East", 30],
    ["KY", "Louisville Riverside", 44],
    ["KY", "Lexington Commons", 38],
    ["MI", "Grand Rapids North", 40],
    ["MI", "Lansing Capitol", 34],
    ["MI", "Detroit Gateway", 46],
    ["OH", "Columbus Junction", 48],
    ["OH", "Cincinnati Crossing", 42],
    ["OH", "Cleveland Lakefront", 40],
    ["OH", "Dayton Plaza", 32],
    ["WV", "Charleston Hillside", 28],
    ["WV", "Morgantown Ridge", 26],
  ].map(([state, name, cases], i) => ({
    storeId: `qsr-${String(state).toLowerCase()}-${String(i + 1).padStart(3, "0")}`,
    storeName: `QuickServe #${100 + i} ${name}`,
    state: state as string,
    productGtin: LETTUCE_GTIN,
    lineageToken: AFFECTED_LINEAGE_TOKEN,
    casesReceived: cases as number,
    receivedAt: "2026-06-19T06:00:00Z",
  })),
  // Clean lineage — 61 stores that a broad recall would ALSO pull product from
  ...Array.from({ length: 61 }, (_, i) => {
    const states = ["IN", "KY", "MI", "OH", "WV", "IL", "PA", "TN", "VA", "WI"];
    const state = states[i % states.length];
    return {
      storeId: `qsr-clean-${String(i + 1).padStart(3, "0")}`,
      storeName: `QuickServe #${300 + i}`,
      state,
      productGtin: LETTUCE_GTIN,
      lineageToken: CLEAN_LINEAGE_TOKEN,
      casesReceived: 24 + (i % 5) * 6,
      receivedAt: "2026-06-21T06:00:00Z",
    };
  }),
];

export interface RecallImpact {
  broad: { stores: number; cases: number; states: string[] };
  targeted: { stores: number; cases: number; states: string[] };
  reductionPct: number;
}

/** Derive broad-vs-targeted impact from the fixture shipments. */
export function computeRecallImpact(
  affectedLineage: string = AFFECTED_LINEAGE_TOKEN,
): RecallImpact {
  const broadRows = storeShipments.filter((s) => s.productGtin === LETTUCE_GTIN);
  const targetedRows = broadRows.filter((s) => s.lineageToken === affectedLineage);
  const sum = (rows: StoreShipment[]) =>
    rows.reduce((acc, r) => acc + r.casesReceived, 0);
  const states = (rows: StoreShipment[]) =>
    [...new Set(rows.map((r) => r.state))].sort();
  const broadCases = sum(broadRows);
  const targetedCases = sum(targetedRows);
  return {
    broad: { stores: broadRows.length, cases: broadCases, states: states(broadRows) },
    targeted: {
      stores: targetedRows.length,
      cases: targetedCases,
      states: states(targetedRows),
    },
    reductionPct:
      broadCases === 0
        ? 0
        : Math.round(((broadCases - targetedCases) / broadCases) * 1000) / 10,
  };
}
