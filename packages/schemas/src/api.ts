/**
 * HTTP contract between the web app and the public-data-api.
 *
 * Single source of truth so both sides validate the same shapes. The API
 * exposes: public outbreak data (real CDC), public on-chain RecallLens state
 * (read via the Midnight indexer), and gated proof-submission endpoints.
 *
 * IMPORTANT: no private partner/consumer record ever crosses this boundary.
 * Proof submissions carry only a role/orgId reference; the API's proof runner
 * reads the corresponding SYNTHETIC fixture locally and produces the ZK proof.
 */
import { z } from "zod";
import { OutbreakSnapshot } from "./public-data";
import { Hex32 } from "./epcis";

export const HealthResponse = z.object({
  ok: z.boolean(),
  checks: z.record(z.string(), z.object({ ok: z.boolean(), detail: z.string() })),
});
export type HealthResponse = z.infer<typeof HealthResponse>;

export const OutbreakResponse = z.object({
  snapshot: OutbreakSnapshot,
  live: z.boolean(),
  liveError: z.string().optional(),
});
export type OutbreakResponse = z.infer<typeof OutbreakResponse>;

/** Public on-chain state for a case, read from the Midnight indexer. */
export const CaseChainState = z.object({
  contractAddress: z.string(),
  network: z.string(),
  caseId: Hex32,
  caseOpen: z.boolean(),
  /** the case-scoped anonymous lineage tag (public) */
  caseTag: Hex32.nullable(),
  /** number of distinct verified organization proofs for the tag */
  matchCount: z.number().int().nonnegative(),
  convergenceThreshold: z.number().int().positive(),
  converged: z.boolean(),
  /** org nullifiers recorded on-chain (opaque hashes) */
  nullifiers: z.array(Hex32),
  /** count of anchored event commitments (opaque) */
  eventCommitmentCount: z.number().int().nonnegative(),
  /** count of registered organization credentials (opaque) */
  registeredOrgCount: z.number().int().nonnegative(),
});
export type CaseChainState = z.infer<typeof CaseChainState>;

export const ProofStage = z.enum([
  "queued",
  "building-witness",
  "proving",
  "submitting",
  "confirmed",
  "failed",
]);
export type ProofStage = z.infer<typeof ProofStage>;

/** A submitted (or pre-submitted) organization proof, tracked by the API. */
export const OrgProof = z.object({
  orgId: z.string(),
  orgName: z.string(),
  role: z.string(),
  stage: ProofStage,
  /** the org nullifier this proof produced (public), once known */
  orgNullifier: Hex32.nullable(),
  txId: z.string().nullable(),
  blockHeight: z.number().int().nullable(),
  /** whether this was pre-submitted before the live demo */
  preSubmitted: z.boolean(),
  error: z.string().nullable(),
  updatedAt: z.string(),
});
export type OrgProof = z.infer<typeof OrgProof>;

export const CaseStatusResponse = z.object({
  chain: CaseChainState,
  proofs: z.array(OrgProof),
  /** honest label: is the chain a real network or a deterministic fallback */
  mode: z.enum(["live-devnet", "deterministic-fallback"]),
});
export type CaseStatusResponse = z.infer<typeof CaseStatusResponse>;

export const SubmitProofRequest = z.object({
  caseId: Hex32,
  /** which synthetic org submits (API reads its fixture locally) */
  orgId: z.string(),
});
export type SubmitProofRequest = z.infer<typeof SubmitProofRequest>;

export const SubmitProofResponse = z.object({
  accepted: z.boolean(),
  proof: OrgProof,
  chain: CaseChainState,
});
export type SubmitProofResponse = z.infer<typeof SubmitProofResponse>;

/** Consumer check: purely local intersection, but exposed for the demo API. */
export const ConsumerCheckRequest = z.object({
  receiptId: z.string(),
  caseId: Hex32,
});
export const ConsumerCheckResponse = z.object({
  affected: z.boolean(),
  message: z.string(),
  guidance: z.string(),
  sourceUrl: z.string().url(),
});
export type ConsumerCheckResponse = z.infer<typeof ConsumerCheckResponse>;

/** Selective disclosure authorization record (P1). */
export const DisclosureRequest = z.object({
  caseId: Hex32,
  orgId: z.string(),
  requestedFields: z.array(z.string()).min(1),
});
export const DisclosureAuthorization = z.object({
  caseId: Hex32,
  orgId: z.string(),
  requestedFields: z.array(z.string()),
  approved: z.boolean(),
  /** hash binding the approved field set to the case + org (public) */
  authorizationHash: Hex32,
  createdAt: z.string(),
});
export type DisclosureAuthorization = z.infer<typeof DisclosureAuthorization>;

/** Scan-driven consumer check: GTIN + lot from a physical label. */
export const ScanCheckRequest = z.object({
  caseId: Hex32,
  gtin: z.string().regex(/^\d{8,14}$/),
  lot: z.string().min(1),
  expiry: z.string().optional(),
});
export type ScanCheckRequest = z.infer<typeof ScanCheckRequest>;

export const ScanCheckResponse = z.object({
  /** "synthetic-positive" only for the synthetic demo affected lot */
  outcome: z.enum(["synthetic-positive", "no-intersection"]),
  affected: z.boolean(),
  /** whether this GTIN+lot matched a private vault entry */
  matchedVault: z.boolean(),
  title: z.string(),
  message: z.string(),
  guidance: z.string(),
  /** honest caveat shown on every result */
  safetyDisclaimer: z.string(),
  sourceUrl: z.string().url(),
  /** true when the private records behind this result are synthetic */
  syntheticPrivateRecords: z.boolean(),
  /** on synthetic-positive: whether a genuine Compact proof was submitted */
  proofSubmitted: z.boolean(),
  proof: OrgProof.nullable(),
  chain: CaseChainState.nullable(),
});
export type ScanCheckResponse = z.infer<typeof ScanCheckResponse>;

export const RecallImpactResponse = z.object({
  broad: z.object({ stores: z.number(), cases: z.number(), states: z.array(z.string()) }),
  targeted: z.object({ stores: z.number(), cases: z.number(), states: z.array(z.string()) }),
  reductionPct: z.number(),
  label: z.string(),
});
export type RecallImpactResponse = z.infer<typeof RecallImpactResponse>;
