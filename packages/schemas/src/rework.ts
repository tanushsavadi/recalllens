/**
 * Schemas for the product rework: role-separated workflow, consumer Recall
 * Intelligence evidence levels, Sentinel early-warning, product passports,
 * and encrypted selective disclosure.
 */
import { z } from "zod";
import { Hex32 } from "./epcis";
import { CaseChainState, OrgProof } from "./api";

/* ── Roles ─────────────────────────────────────────────────────────────── */

export const DemoRole = z.enum(["investigator", "partner", "consumer"]);
export type DemoRole = z.infer<typeof DemoRole>;

/* ── Role-separated private-match workflow ─────────────────────────────── */

export const MatchRequestStatus = z.enum([
  "none", // investigator has not asked this org yet
  "requested", // investigator sent a private-match request
  "scanned", // partner located its committed record (label scanned)
  "proving", // partner approved; genuine proof running
  "proven", // settled on-chain
  "rejected", // partner declined
]);
export type MatchRequestStatus = z.infer<typeof MatchRequestStatus>;

export const MatchRequest = z.object({
  caseId: Hex32,
  orgId: z.string(),
  orgName: z.string(),
  role: z.string(),
  status: MatchRequestStatus,
  /** the exact predicate the partner reviews before approving */
  predicate: z.object({
    productGtin: z.string(),
    windowStart: z.string(),
    windowEnd: z.string(),
    description: z.string(),
  }),
  txId: z.string().nullable(),
  preSubmitted: z.boolean(),
  updatedAt: z.string(),
});
export type MatchRequest = z.infer<typeof MatchRequest>;

/* ── Consumer Recall Intelligence ──────────────────────────────────────── */

export const EvidenceLevel = z.enum([
  "EXACT_OFFICIAL_RECALL_MATCH",
  "PROOF_VERIFIED_PRECAUTIONARY_HOLD",
  "AUTHORIZED_RECALL_MATCH",
  "POSSIBLE_ADVISORY_MATCH",
  "NO_VERIFIED_MATCH",
  "INSUFFICIENT_DATA",
  "VERIFICATION_UNAVAILABLE",
]);
export type EvidenceLevel = z.infer<typeof EvidenceLevel>;

export const EvidenceSource = z.object({
  authority: z.string(), // e.g. "FDA", "openFDA enforcement", "RecallLens network"
  kind: z.enum(["official", "network", "synthetic"]),
  url: z.string().nullable(),
  sourceTimestamp: z.string().nullable(), // when the authority last updated
  retrievedAt: z.string(), // when we fetched it
  live: z.boolean(), // live fetch vs cached snapshot
  cadenceNote: z.string().nullable(), // e.g. "weekly-updated enforcement data"
});
export type EvidenceSource = z.infer<typeof EvidenceSource>;

/** What kind of physical input produced this scan. */
export const InputProvenance = z.enum([
  // a signed RecallLens demonstration passport (synthetic by definition)
  "signed-synthetic-passport",
  // a card carrying only public identifiers (e.g. the FDA advisory test card)
  "public-identifier-card",
  // the user typed the identifiers
  "manual-entry",
  // a passport whose signature failed verification
  "invalid-signature",
]);
export type InputProvenance = z.infer<typeof InputProvenance>;

/** One evidence system that was consulted for this scan, with its own result. */
export const SourceCheck = z.object({
  /** e.g. "FDA outbreak advisory", "RecallLens precautionary hold",
   * "RecallLens authorized recall scope", "Passport signature" */
  system: z.string(),
  kind: z.enum(["official", "network", "device"]),
  /** plain-language outcome for THIS system, e.g. "no match", "match",
   * "valid", "invalid", "none active", "not checked — no signed passport" */
  result: z.string(),
  /** live fetch / live state vs cached; null when not meaningful (device) */
  live: z.boolean().nullable(),
  detail: z.string().nullable(),
});
export type SourceCheck = z.infer<typeof SourceCheck>;

/** Machine-readable decision basis for the receipt's level. */
export const DecisionBasis = z.enum([
  "official-exact-identifiers",
  "official-possible-brand",
  "authorized-recall-scope-membership",
  "active-hold-membership",
  "no-match-across-checked-sources",
  "invalid-passport-signature",
  "insufficient-identifiers",
  "sources-unavailable",
]);
export type DecisionBasis = z.infer<typeof DecisionBasis>;

/** Midnight involvement, stated precisely. */
export const MidnightInvolvement = z.object({
  /** true ONLY when a Midnight-anchored fact was used for this result */
  involved: z.boolean(),
  mode: z.enum(["live-devnet", "deterministic-fallback"]).nullable(),
  /** human label, e.g. "Local Midnight devnet" — never the raw network id */
  networkLabel: z.string().nullable(),
  contractAddress: z.string().nullable(),
  txId: z.string().nullable(),
  /** e.g. "no Midnight-anchored hold or recall was active to check" */
  note: z.string().nullable(),
});
export type MidnightInvolvement = z.infer<typeof MidnightInvolvement>;

/** The "evidence receipt" shown with every consumer result. */
export const EvidenceReceipt = z.object({
  level: EvidenceLevel,
  headline: z.string(),
  explanation: z.string(),
  guidance: z.string(),
  safetyDisclaimer: z.string(),
  /* 1. input provenance */
  inputProvenance: InputProvenance,
  /** the scanned INPUT is synthetic demonstration data (independent of
   * whether the sources checked are official) */
  inputSynthetic: z.boolean(),
  /* 2. every system checked, each with its own result */
  sourcesChecked: z.array(SourceCheck),
  /* 3. decision basis */
  basis: DecisionBasis,
  whyThisLevel: z.string(),
  /** primary source backing the level (e.g. the FDA advisory for an official
   * match); null when no single source decided the result */
  source: EvidenceSource.nullable(),
  fieldsMatched: z.array(z.object({ field: z.string(), value: z.string() })),
  fieldsMissing: z.array(z.string()),
  /* 4. Midnight involvement */
  midnight: MidnightInvolvement,
  /* 5. simulated-impact note (never claimed measured) */
  impactSimulated: z.boolean(),
  /* 6. data leaving the device — exact, no broader claim */
  dataLeftDevice: z.object({
    fieldsTransmitted: z.array(z.string()),
    imageTransmitted: z.literal(false),
    note: z.string(),
  }),
  passport: z
    .object({
      valid: z.boolean(),
      issuer: z.string(),
      passportId: z.string().regex(/^[0-9a-f]{32}$/),
      tampered: z.boolean(),
    })
    .nullable(),
});
export type EvidenceReceipt = z.infer<typeof EvidenceReceipt>;

export const ConsumerVerifyRequest = z.object({
  /** GTIN is OPTIONAL: official advisories may publish no GTIN/UPC and we
   * never fabricate one. At least one identifier must be present. */
  gtin: z.string().regex(/^\d{8,14}$/).optional(),
  lot: z.string().optional(),
  expiry: z.string().optional(),
  productName: z.string().optional(),
  /** how the identifiers were obtained (drives input-provenance reporting) */
  scanOrigin: z.enum(["passport-qr", "identifier-qr", "manual"]).optional(),
  /** signed passport fields when a RecallLens passport QR was scanned */
  passport: z
    .object({
      passportId: z.string().regex(/^[0-9a-f]{32}$/),
      issuer: z.string(),
      signature: z.string(),
    })
    .optional(),
});
export type ConsumerVerifyRequest = z.infer<typeof ConsumerVerifyRequest>;

/* ── Sentinel ──────────────────────────────────────────────────────────── */

export const SignalCategory = z.enum([
  "PROCESSOR_QA_SIGNAL",
  "COLD_CHAIN_SIGNAL",
  "EXPOSURE_CLUSTER_SIGNAL",
]);
export type SignalCategory = z.infer<typeof SignalCategory>;

export const SentinelSignal = z.object({
  signalId: z.string(),
  category: SignalCategory,
  ownerOrgId: z.string(),
  ownerName: z.string(),
  highConfidence: z.boolean(),
  status: z.enum(["pending-approval", "proven", "rejected"]),
  dayOffset: z.number(), // e.g. -9 for "Day −9" on the replay timeline
  summary: z.string(), // human summary; raw evidence stays private
  txId: z.string().nullable(),
  nullifier: Hex32.nullable(),
  preSubmitted: z.boolean(),
});
export type SentinelSignal = z.infer<typeof SentinelSignal>;

export const SentinelPolicy = z.object({
  minSignals: z.number(),
  minOrgs: z.number(),
  minCategories: z.number(),
  requiresHighConfidence: z.boolean(),
});

export const SentinelStatus = z.object({
  caseId: Hex32,
  replayBadge: z.string(), // the honest "synthetic pre-outbreak replay" label
  signals: z.array(SentinelSignal),
  policy: SentinelPolicy,
  counts: z.object({
    signals: z.number(),
    orgs: z.number(),
    categories: z.number(),
    highConfidence: z.number(),
  }),
  thresholdReached: z.boolean(),
  hold: z
    .object({
      holdCommitment: Hex32,
      txId: z.string().nullable(),
      issuedAt: z.string(),
      /** number of passport commitments in the hold set (opaque) */
      memberCount: z.number(),
    })
    .nullable(),
  recallAuthorized: z
    .object({ predicateHash: Hex32, txId: z.string().nullable(), authorizedAt: z.string() })
    .nullable(),
  mode: z.enum(["live-devnet", "deterministic-fallback"]),
});
export type SentinelStatus = z.infer<typeof SentinelStatus>;

/* ── Encrypted selective disclosure ────────────────────────────────────── */

export const DisclosureField = z.enum([
  "sourceGln",
  "lotCode",
  "eventDate",
  "destinationGln",
]);

export const DisclosurePackage = z.object({
  caseId: Hex32,
  orgId: z.string(),
  approvedFields: z.array(DisclosureField),
  rejectedFields: z.array(DisclosureField),
  /** base64url AES-GCM ciphertext — the ONLY payload that transits */
  ciphertext: z.string(),
  iv: z.string(),
  /** ephemeral ECDH public key (JWK) used to derive the AES key */
  ephemeralPublicKey: z.string(),
  authorizationHash: Hex32,
  ciphertextDigest: Hex32,
  createdAt: z.string(),
});
export type DisclosurePackage = z.infer<typeof DisclosurePackage>;

/* ── Workflow status (whole-product state machine) ─────────────────────── */

export const WorkflowStage = z.enum([
  "sentinel-signals",
  "sentinel-threshold",
  "hold-issued",
  "trace-requested",
  "trace-verified",
  "disclosure-complete",
  "recall-authorized",
  "removal-confirmed",
]);
export type WorkflowStage = z.infer<typeof WorkflowStage>;

export const WorkflowStatus = z.object({
  stage: WorkflowStage,
  sentinel: SentinelStatus,
  trace: z.object({
    chain: CaseChainState,
    requests: z.array(MatchRequest),
    proofs: z.array(OrgProof),
  }),
  disclosure: DisclosurePackage.nullable(),
  removal: z
    .object({ confirmedBy: z.array(z.string()), completedAt: z.string().nullable() })
    .nullable(),
  mode: z.enum(["live-devnet", "deterministic-fallback"]),
});
export type WorkflowStatus = z.infer<typeof WorkflowStatus>;
