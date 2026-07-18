/**
 * The public demo outbreak case definition, shared by the deploy script, the
 * API, and the web app so all three agree on the same caseId.
 *
 * caseId is a fixed 32-byte value for the July 2026 Cyclospora demo case.
 * sourceHash is the sha256 of the checked-in CDC snapshot content (the raw
 * archived HTML) — computed by the deploy script and recorded on-chain so the
 * case is bound to a specific official source snapshot.
 */
import {
  CASE_WINDOW_START,
  CASE_WINDOW_END,
  LETTUCE_GTIN,
} from "./trace-events";

// 32-byte (64 hex char) fixed identifier for the July 2026 Cyclospora demo case.
export const DEMO_CASE_ID =
  "cdc07260cc10ee5511223344556677889900aabbccddeeff0011223344556677";

/**
 * SYNTHETIC registrar/coordinator credential secret (32-byte hex).
 * The registrar is the trust anchor that admits organizations and opens cases.
 * In production this would be held by an accredited coordinator; here it is a
 * fixed constant so the demo is reproducible (and, being in a public repo, not
 * confidential — see THREAT_MODEL.md).
 */
export const DEMO_REGISTRAR_SECRET =
  "5e91574a12026c0016de11b1a7ede9c0c00d1a7e5ea112b7005ec0ffee00a5a5";

export const DEMO_CASE = {
  caseId: DEMO_CASE_ID,
  title: "Cyclospora — Shredded Iceberg Lettuce (July 2026)",
  productGtin: LETTUCE_GTIN,
  windowStart: CASE_WINDOW_START,
  windowEnd: CASE_WINDOW_END,
  sourceUrl: "https://www.cdc.gov/cyclosporiasis/outbreaks/07-26/index.html",
  convergenceThreshold: 3,
} as const;
