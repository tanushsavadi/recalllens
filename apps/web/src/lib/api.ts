/**
 * Typed client for the public-data-api. All responses validated with Zod.
 *
 * Role separation is enforced server-side; this client just namespaces the
 * calls so pages can only reach the operations their role owns.
 */
import { z } from "zod";
import {
  OutbreakResponse,
  CaseStatusResponse,
  HealthResponse,
  ConsumerCheckResponse,
  RecallImpactResponse,
  MatchRequest,
  SentinelStatus,
  SentinelSignal,
  EvidenceReceipt,
  DisclosurePackage,
} from "@recalllens/schemas";
import { DEMO_CASE_ID as FIXTURE_CASE_ID } from "@recalllens/demo-fixtures";

const BASE = import.meta.env.VITE_API_BASE ?? "/api";

async function getJson<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return schema.parse(await res.json());
}

async function postJson<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = "";
    try {
      const j = (await res.json()) as { error?: unknown };
      detail = typeof j.error === "string" ? j.error : JSON.stringify(j.error ?? j);
    } catch {
      /* ignore */
    }
    throw new Error(detail || `${path} → ${res.status}`);
  }
  return schema.parse(await res.json());
}

export const api = {
  health: () => getJson("/health", HealthResponse),
  outbreak: () => getJson("/outbreak", OutbreakResponse),
  caseStatus: (caseId: string) => getJson(`/case/${caseId}`, CaseStatusResponse),
  recallImpact: (caseId: string) =>
    getJson(`/case/${caseId}/recall-impact`, RecallImpactResponse),
  reset: (caseId: string) =>
    postJson(`/case/${caseId}/reset`, {}, z.object({ reset: z.boolean() }).passthrough()),

  /* role: investigator */
  investigator: {
    matchRequests: (caseId: string) =>
      getJson(
        `/case/${caseId}/requests`,
        z.object({ requests: z.array(MatchRequest), mode: z.string() }),
      ),
    requestMatch: (caseId: string, orgId: string) =>
      postJson("/investigator/request-match", { caseId, orgId }, z.object({ request: MatchRequest })),
    issueHold: (caseId: string, passportCommitments: string[]) =>
      postJson(
        "/sentinel/issue-hold",
        { caseId, passportCommitments },
        z.object({ hold: z.object({ holdCommitment: z.string(), txId: z.string().nullable(), issuedAt: z.string(), memberCount: z.number() }) }),
      ),
    authorizeRecall: (caseId: string) =>
      postJson(
        "/sentinel/authorize-recall",
        { caseId },
        z.object({ recall: z.object({ predicateHash: z.string(), txId: z.string().nullable(), authorizedAt: z.string() }) }),
      ),
    getDisclosurePackage: () =>
      getJson("/disclosure/package", z.object({ package: DisclosurePackage.nullable() })),
  },

  /* role: partner */
  partner: {
    scan: (caseId: string, actingOrgId: string, gtin: string, lot: string) =>
      postJson(
        "/partner/scan",
        { caseId, actingOrgId, gtin, lot },
        z.object({
          request: MatchRequest,
          record: z.object({ lotCode: z.string(), eventTime: z.string(), bizStep: z.string() }),
        }),
      ),
    approve: (caseId: string, actingOrgId: string) =>
      postJson(
        "/partner/approve",
        { caseId, actingOrgId },
        z.object({ request: MatchRequest }).passthrough(),
      ),
    reject: (caseId: string, actingOrgId: string) =>
      postJson("/partner/reject", { caseId, actingOrgId }, z.object({ request: MatchRequest })),
    sendDisclosurePackage: (pkg: unknown) =>
      postJson(
        "/disclosure/package",
        pkg,
        z
          .object({ stored: z.boolean(), alreadyExisted: z.boolean().optional() })
          .passthrough(),
      ),
    confirmRemoval: (orgId: string) =>
      postJson(
        "/partner/confirm-removal",
        { orgId },
        z.object({
          removal: z.object({
            confirmedBy: z.array(z.string()),
            completedAt: z.string().nullable(),
            evidenceBasis: z.string(),
          }),
        }),
      ),
  },

  /* role: consumer */
  consumer: {
    check: (receiptId: string, caseId: string) =>
      postJson("/consumer/check", { receiptId, caseId }, ConsumerCheckResponse),
    verify: (input: {
      gtin?: string;
      lot?: string;
      expiry?: string;
      productName?: string;
      scanOrigin?: "passport-qr" | "identifier-qr" | "manual";
      passport?: { passportId: string; issuer: string; signature: string };
    }) => postJson("/consumer/verify", input, EvidenceReceipt),
  },

  /* sentinel */
  sentinel: {
    status: (caseId: string) => getJson(`/sentinel/${caseId}`, SentinelStatus),
    approveSignal: (caseId: string, signalId: string, actingOrgId: string) =>
      postJson(
        "/sentinel/approve-signal",
        { caseId, signalId, actingOrgId },
        z.object({ signal: SentinelSignal, status: SentinelStatus }),
      ),
  },

  removal: () =>
    getJson(
      "/removal",
      z.object({
        removal: z
          .object({
            confirmedBy: z.array(z.string()),
            completedAt: z.string().nullable(),
            evidenceBasis: z.string(),
          })
          .nullable(),
      }),
    ),

  /** One authoritative whole-product lifecycle snapshot. */
  workflowStage: (caseId: string) =>
    getJson(
      `/workflow/${caseId}/stage`,
      z.object({
        stage: z.string(),
        sentinel: z.object({
          signals: z.number(),
          required: z.number(),
          thresholdReached: z.boolean(),
        }),
        hold: z.object({ active: z.boolean(), txId: z.string().nullable().optional() }),
        trace: z.object({
          matchCount: z.number(),
          threshold: z.number(),
          converged: z.boolean(),
        }),
        disclosure: z.object({ sent: z.boolean(), authorizationHash: z.string().optional() }),
        recall: z.object({ authorized: z.boolean(), txId: z.string().nullable().optional() }),
        removal: z.object({
          confirmedBy: z.array(z.string()),
          completedAt: z.string().nullable(),
        }),
        mode: z.string(),
      }),
    ),
};

export const DEMO_CASE_ID = FIXTURE_CASE_ID;
