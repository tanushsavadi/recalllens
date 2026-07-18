/**
 * Typed client for the public-data-api. All responses validated with Zod.
 */
import {
  OutbreakResponse,
  CaseStatusResponse,
  SubmitProofResponse,
  HealthResponse,
  ConsumerCheckResponse,
  ScanCheckResponse,
  RecallImpactResponse,
  DisclosureAuthorization,
} from "@recalllens/schemas";
import { DEMO_CASE_ID as FIXTURE_CASE_ID } from "@recalllens/demo-fixtures";
import { staticApi, IS_STATIC_DEMO } from "./static-demo";
import type { z } from "zod";

const BASE = import.meta.env.VITE_API_BASE ?? "/api";

async function getJson<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return schema.parse(await res.json());
}

async function postJson<T>(
  path: string,
  body: unknown,
  schema: z.ZodType<T>,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = "";
    try {
      detail = JSON.stringify(await res.json());
    } catch {
      /* ignore */
    }
    throw new Error(`${path} → ${res.status} ${detail}`);
  }
  return schema.parse(await res.json());
}

const liveApi = {
  health: () => getJson("/health", HealthResponse),
  outbreak: () => getJson("/outbreak", OutbreakResponse),
  caseStatus: (caseId: string) =>
    getJson(`/case/${caseId}`, CaseStatusResponse),
  submitProof: (caseId: string, orgId: string) =>
    postJson("/case/prove", { caseId, orgId }, SubmitProofResponse),
  recallImpact: (caseId: string) =>
    getJson(`/case/${caseId}/recall-impact`, RecallImpactResponse),
  consumerCheck: (receiptId: string, caseId: string) =>
    postJson(
      "/consumer/check",
      { receiptId, caseId },
      ConsumerCheckResponse,
    ),
  scanCheck: (
    caseId: string,
    gtin: string,
    lot: string,
    expiry?: string,
  ) =>
    postJson(
      "/scan/check",
      { caseId, gtin, lot, expiry },
      ScanCheckResponse,
    ),
  authorizeDisclosure: (
    caseId: string,
    orgId: string,
    requestedFields: string[],
    approved: boolean,
  ) =>
    postJson(
      "/disclosure/authorize",
      { caseId, orgId, requestedFields, approved },
      DisclosureAuthorization,
    ),
};

// On a static host (Vercel preview) with no backend, serve the pre-generated
// demo snapshot. Clearly badged in the UI; proofs are a deterministic fallback.
export const api = IS_STATIC_DEMO
  ? {
      health: staticApi.health,
      outbreak: staticApi.outbreak,
      caseStatus: (_caseId: string) => staticApi.caseStatus(),
      submitProof: (_caseId: string, _orgId: string) => staticApi.submitProof(),
      recallImpact: (_caseId: string) => staticApi.recallImpact(),
      consumerCheck: (receiptId: string, _caseId: string) =>
        staticApi.consumerCheck(receiptId),
      scanCheck: (caseId: string, gtin: string, lot: string, _expiry?: string) =>
        staticApi.scanCheck(caseId, gtin, lot),
      authorizeDisclosure: staticApi.authorizeDisclosure,
    }
  : liveApi;

export const DEMO_CASE_ID = FIXTURE_CASE_ID;
