/**
 * EPCIS 2.0-shaped domain model for RecallLens.
 *
 * A focused subset of GS1 EPCIS 2.0 JSON event structure — enough to model
 * harvest → pack → process → ship → receive → serve for the demo supply
 * chain, plus RecallLens-specific privacy fields (lineage token, blinding).
 *
 * This is NOT a full EPCIS implementation and we do not claim conformance
 * certification. Field names follow EPCIS 2.0 JSON bindings where a direct
 * equivalent exists (eventTime, bizStep, epcList-like product/lot fields,
 * sourceList/destinationList via GLNs).
 */
import { z } from "zod";

/** hex-encoded 32-byte value (64 hex chars) */
export const Hex32 = z
  .string()
  .regex(/^[0-9a-f]{64}$/, "expected 64 lowercase hex chars (32 bytes)");

export const Gtin = z.string().regex(/^\d{8,14}$/, "GTIN must be 8-14 digits");
export const Gln = z.string().regex(/^\d{13}$/, "GLN must be 13 digits");

export const BusinessStep = z.enum([
  "harvesting",
  "packing",
  "processing", // transformation (e.g. shredding lettuce)
  "shipping",
  "receiving",
  "serving", // sale / final service to consumer
  "quarantine",
  "destruction",
]);
export type BusinessStep = z.infer<typeof BusinessStep>;

export const EpcisEventType = z.enum([
  "ObjectEvent",
  "AggregationEvent",
  "TransformationEvent",
]);
export type EpcisEventType = z.infer<typeof EpcisEventType>;

/** Optional cold-chain sensor summary (private; never leaves the vault). */
export const SensorSummary = z.object({
  minTempC: z.number(),
  maxTempC: z.number(),
  breached: z.boolean(),
});
export type SensorSummary = z.infer<typeof SensorSummary>;

/**
 * A private trace event as held in a partner's local vault.
 *
 * PRIVACY: every field in this object is private runtime data. Only a hiding
 * commitment (hash including the random `blinding`) is ever anchored on the
 * public ledger. `lineageToken` is a random 256-bit value propagated along
 * the physical lot — it is the anonymity anchor (not the guessable lot code).
 */
export const TraceEvent = z.object({
  eventId: z.string().min(1),
  eventType: EpcisEventType,
  eventTime: z.string().datetime(), // ISO 8601, converted to unix seconds for circuits
  bizStep: BusinessStep,
  /** GS1 GTIN of the product (e.g. shredded iceberg lettuce case) */
  productGtin: Gtin,
  /** human product description — private */
  productDescription: z.string(),
  /** GLN of the originating facility — private */
  sourceGln: Gln,
  /** GLN of the receiving facility — private */
  destinationGln: Gln,
  /** internal lot code — private AND guessable; never hashed on its own */
  lotCode: z.string(),
  quantity: z.number().nonnegative(),
  quantityUom: z.string().default("CS"),
  /** random 256-bit lineage token propagated with the physical lot (hex) */
  lineageToken: Hex32,
  /** for TransformationEvent: lineage token of the input lot (hex) */
  parentLineageToken: Hex32.optional(),
  /** random 256-bit commitment blinding factor (hex) */
  blinding: Hex32,
  sensorSummary: SensorSummary.optional(),
});
export type TraceEvent = z.infer<typeof TraceEvent>;

/** Organization roles in the demo network. */
export const OrgRole = z.enum([
  "farm",
  "processor",
  "distributor",
  "restaurant",
  "retailer",
  "regulator",
]);
export type OrgRole = z.infer<typeof OrgRole>;

/**
 * A demo organization. `orgSecret` is the registered credential secret —
 * private, held only in the org's vault. Its commitment H("rl:org", secret)
 * is what appears in the on-chain registry.
 */
export const Organization = z.object({
  orgId: z.string().min(1),
  name: z.string().min(1),
  role: OrgRole,
  /** private credential secret (hex, 32 bytes) */
  orgSecret: Hex32,
  synthetic: z.literal(true), // every fixture org is synthetic by construction
});
export type Organization = z.infer<typeof Organization>;

/** Public outbreak case definition (mirrors on-chain case struct). */
export const OutbreakCase = z.object({
  caseId: Hex32,
  title: z.string(),
  /** sha256 of the official source snapshot backing this case */
  sourceHash: Hex32,
  /** hash of product predicate (GTIN-derived, see crypto.ts) */
  productHash: Hex32,
  windowStartUnix: z.number().int().nonnegative(),
  windowEndUnix: z.number().int().nonnegative(),
  sourceUrl: z.string().url(),
});
export type OutbreakCase = z.infer<typeof OutbreakCase>;

/** A synthetic consumer receipt for the P1 consumer check. */
export const ConsumerReceipt = z.object({
  receiptId: z.string(),
  merchantName: z.string(),
  purchasedAt: z.string().datetime(),
  items: z.array(
    z.object({
      description: z.string(),
      productGtin: Gtin,
      /** lineage token of the served lot, if traceable (hex) */
      lineageToken: Hex32.optional(),
    }),
  ),
  synthetic: z.literal(true),
});
export type ConsumerReceipt = z.infer<typeof ConsumerReceipt>;

export function eventTimeUnix(ev: Pick<TraceEvent, "eventTime">): bigint {
  return BigInt(Math.floor(new Date(ev.eventTime).getTime() / 1000));
}
