/**
 * RecallLens public-data-api.
 *
 * Serves:
 *   - Real public outbreak data (CDC adapter, live-or-cached).
 *   - Public on-chain RecallLens state (via the Midnight indexer) and gated
 *     proof submission (via the live devnet backend, or a clearly-labeled
 *     deterministic fallback).
 *   - openFDA historical recall context.
 *   - Recall blast-radius comparison (derived from synthetic fixtures).
 *   - Consumer intersection check (synthetic receipts).
 *   - Selective-disclosure authorization records (P1).
 *
 * Privacy boundary: NO private partner/consumer record is ever accepted from
 * or returned to a client. Proof requests carry only {caseId, orgId}; the
 * server reads the corresponding SYNTHETIC fixture locally.
 */
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { z } from "zod";
import {
  getOutbreak,
  searchFoodRecalls,
  getFdaAdvisory,
  classifyScan,
} from "@recalllens/source-adapters";
import {
  DEMO_CASE,
  computeRecallImpact,
  receipts,
  affectedEvents,
  AFFECTED_LINEAGE_TOKEN,
  organizations,
} from "@recalllens/demo-fixtures";
import {
  ConsumerCheckRequest,
  ConsumerVerifyRequest,
  DisclosurePackage,
} from "@recalllens/schemas";
import { verifyPassport, passportCommitment } from "@recalllens/gs1";
import { selectBackend } from "@recalllens/midnight-client";
import { WorkflowEngine } from "./workflow";

const app = new Hono();

// Permissive CORS for local dev / Vercel preview.
app.use("*", async (c, next) => {
  c.header("access-control-allow-origin", "*");
  c.header("access-control-allow-methods", "GET,POST,OPTIONS");
  c.header("access-control-allow-headers", "content-type");
  if (c.req.method === "OPTIONS") return c.body(null, 204);
  await next();
});

const backend = await selectBackend();
const workflow = new WorkflowEngine(backend);
console.log(
  `[public-data-api] chain backend: ${backend.mode} (${backend.info().network} @ ${backend.info().contractAddress})`,
);

app.get("/api/health", async (c) => {
  const checks: Record<string, { ok: boolean; detail: string }> = {};
  try {
    const o = await getOutbreak();
    checks.cdc = {
      ok: true,
      detail: o.live ? "live" : `cached (${o.liveError ?? "no live"})`,
    };
  } catch (e) {
    checks.cdc = { ok: false, detail: String(e) };
  }
  const info = backend.info();
  checks.chain = {
    ok: backend.mode === "live-devnet",
    detail: `${backend.mode} · ${info.network} · ${info.contractAddress}`,
  };
  const ok = Object.values(checks).every((x) => x.ok) || checks.cdc.ok;
  return c.json({ ok, checks });
});

app.get("/api/outbreak", async (c) => {
  const res = await getOutbreak();
  return c.json({
    snapshot: res.snapshot,
    live: res.live,
    ...(res.liveError ? { liveError: res.liveError } : {}),
  });
});

app.get("/api/case/:caseId", async (c) => {
  const caseId = c.req.param("caseId");
  const [chain, proofs] = await Promise.all([
    backend.getCaseState(caseId),
    backend.getProofs(caseId),
  ]);
  return c.json({ chain, proofs, mode: backend.mode });
});

/* ── ROLE-SEPARATED TRACE WORKFLOW ──────────────────────────────────────
 * The investigator can only REQUEST a match. Proof generation belongs to the
 * owning partner: scan-your-own-label → review predicate → approve. The old
 * /api/case/prove endpoint (which let any caller run any org's proof) is
 * intentionally REMOVED. */

app.get("/api/case/:caseId/requests", async (c) => {
  const requests = await workflow.matchRequests(c.req.param("caseId"));
  return c.json({ requests, mode: backend.mode });
});

app.post("/api/investigator/request-match", async (c) => {
  const body = z
    .object({ caseId: z.string(), orgId: z.string() })
    .safeParse(await c.req.json());
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  try {
    const request = await workflow.requestMatch(body.data.caseId, body.data.orgId);
    return c.json({ request });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
});

app.post("/api/partner/scan", async (c) => {
  const body = z
    .object({
      caseId: z.string(),
      actingOrgId: z.string(),
      gtin: z.string(),
      lot: z.string(),
    })
    .safeParse(await c.req.json());
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  try {
    const res = await workflow.partnerScan(
      body.data.caseId,
      body.data.actingOrgId,
      body.data.gtin,
      body.data.lot,
    );
    return c.json(res);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 403);
  }
});

app.post("/api/partner/approve", async (c) => {
  const body = z
    .object({ caseId: z.string(), actingOrgId: z.string() })
    .safeParse(await c.req.json());
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  try {
    const res = await workflow.partnerApprove(body.data.caseId, body.data.actingOrgId);
    return c.json(res);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 403);
  }
});

app.post("/api/partner/reject", async (c) => {
  const body = z
    .object({ caseId: z.string(), actingOrgId: z.string() })
    .safeParse(await c.req.json());
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const request = await workflow.partnerReject(body.data.caseId, body.data.actingOrgId);
  return c.json({ request });
});

app.post("/api/case/:caseId/reset", async (c) => {
  const caseId = c.req.param("caseId");
  workflow.reset();
  if (!backend.reset) {
    return c.json(
      { reset: true, chainReset: false, mode: backend.mode, note: "workflow reset; live chain state re-seeds via deploy script" },
      200,
    );
  }
  await backend.reset(caseId);
  return c.json({ reset: true, chainReset: true, mode: backend.mode });
});

/* ── SENTINEL ──────────────────────────────────────────────────────────── */

app.get("/api/sentinel/:caseId", async (c) => {
  return c.json(await workflow.sentinelStatus(c.req.param("caseId")));
});

app.post("/api/sentinel/approve-signal", async (c) => {
  const body = z
    .object({ caseId: z.string(), signalId: z.string(), actingOrgId: z.string() })
    .safeParse(await c.req.json());
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  try {
    const signal = await workflow.approveSignal(
      body.data.caseId,
      body.data.signalId,
      body.data.actingOrgId,
    );
    return c.json({ signal, status: await workflow.sentinelStatus(body.data.caseId) });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 403);
  }
});

app.post("/api/sentinel/issue-hold", async (c) => {
  const body = z
    .object({ caseId: z.string(), passportCommitments: z.array(z.string()).min(1) })
    .safeParse(await c.req.json());
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  try {
    const hold = await workflow.issueHold(body.data.caseId, body.data.passportCommitments);
    return c.json({ hold });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
});

app.post("/api/sentinel/authorize-recall", async (c) => {
  const body = z.object({ caseId: z.string() }).safeParse(await c.req.json());
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  try {
    const recall = await workflow.authorizeRecall(body.data.caseId);
    return c.json({ recall });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
});

/* ── REMOVAL VERIFICATION ──────────────────────────────────────────────── */

/* Removal confirmation is a PARTNER-REPORTED off-chain attestation recorded
 * by this service — the evidenceBasis field states exactly that so the UI
 * never overclaims. Idempotent per org. */
app.post("/api/partner/confirm-removal", async (c) => {
  const body = z.object({ orgId: z.string() }).safeParse(await c.req.json());
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  return c.json({ removal: workflow.confirmRemoval(body.data.orgId) });
});

app.get("/api/removal", (c) => c.json({ removal: workflow.getRemoval() }));

/* Whole-product lifecycle stage — one authoritative server-side state. */
app.get("/api/workflow/:caseId/stage", async (c) => {
  const caseId = c.req.param("caseId");
  const [stage, sentinel, chain, removal] = await Promise.all([
    workflow.stage(caseId),
    workflow.sentinelStatus(caseId),
    backend.getCaseState(caseId),
    Promise.resolve(workflow.getRemoval()),
  ]);
  const disclosure = workflow.getDisclosure();
  return c.json({
    stage,
    sentinel: {
      signals: sentinel.counts.signals,
      required: sentinel.policy.minSignals,
      thresholdReached: sentinel.thresholdReached,
    },
    hold: sentinel.hold ? { active: true, txId: sentinel.hold.txId } : { active: false },
    trace: {
      matchCount: chain.matchCount,
      threshold: chain.convergenceThreshold,
      converged: chain.converged,
    },
    disclosure: disclosure
      ? { sent: true, authorizationHash: disclosure.authorizationHash }
      : { sent: false },
    recall: sentinel.recallAuthorized
      ? { authorized: true, txId: sentinel.recallAuthorized.txId }
      : { authorized: false },
    removal: removal
      ? { confirmedBy: removal.confirmedBy, completedAt: removal.completedAt }
      : { confirmedBy: [], completedAt: null },
    mode: backend.mode,
  });
});

app.get("/api/case/:caseId/recall-impact", (c) => {
  const impact = computeRecallImpact(AFFECTED_LINEAGE_TOKEN);
  return c.json({
    ...impact,
    label: "Simulated impact using demonstration supply records",
  });
});

app.post("/api/consumer/check", async (c) => {
  const parsed = ConsumerCheckRequest.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const receipt = receipts.find((r) => r.receiptId === parsed.data.receiptId);
  if (!receipt) return c.json({ error: "unknown receipt" }, 404);

  // Intersection: does any receipt item carry the affected lineage token?
  const affected = receipt.items.some(
    (i) => i.lineageToken === AFFECTED_LINEAGE_TOKEN,
  );
  return c.json({
    affected,
    message: affected
      ? "A product on this receipt matches the verified affected lineage for this outbreak case."
      : "No product on this receipt intersects the verified affected lineage for this outbreak case.",
    guidance: affected
      ? "If you have symptoms of cyclosporiasis (watery diarrhea, loss of appetite, cramping), contact a healthcare provider. Do not consume any remaining product from this purchase."
      : "No action needed based on this receipt. Follow general food-safety guidance and monitor official updates.",
    sourceUrl: DEMO_CASE.sourceUrl,
  });
});

/* ── CONSUMER RECALL INTELLIGENCE ───────────────────────────────────────
 * The consumer verify is a READ-ONLY downstream operation. It NEVER runs a
 * supply-chain partner's proof (the old behavior was removed — see
 * docs/PRODUCT_REWORK_AUDIT.md C1). Precedence: official FDA identifiers →
 * authorized RecallLens recall → proof-verified hold → no match. */

app.post("/api/consumer/verify", async (c) => {
  const parsed = ConsumerVerifyRequest.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const input = parsed.data;

  // 1. Validate a scanned passport (if present) and derive its commitment.
  let passportInfo: {
    valid: boolean;
    issuer: string;
    passportId: string;
    tampered: boolean;
  } | null = null;
  let commitment: string | null = null;
  if (input.passport && input.gtin && input.lot && input.expiry !== undefined) {
    const verified = await verifyPassport({
      gtin: input.gtin,
      lot: input.lot,
      expiry: input.expiry ?? "",
      passportId: input.passport.passportId,
      issuer: input.passport.issuer,
      issuerCredentialRef: "did:demo:recalllens:issuer:1",
      signature: input.passport.signature,
    });
    passportInfo = {
      valid: verified.valid,
      issuer: input.passport.issuer,
      passportId: input.passport.passportId,
      tampered: verified.tampered,
    };
    commitment = verified.valid ? verified.commitment : null;
  }

  // 2. Check the hold registry / authorized recall (genuine chain-anchored
  //    where the live backend is active; membership itself is a local set
  //    check against the anchored commitment — documented demo limitation).
  //    The hold/recall EXISTENCE is reported even for passport-less scans so
  //    the receipt's "sources checked" list is truthful about coverage.
  const st = await workflow.sentinelStatus(DEMO_CASE.caseId);
  const hold = commitment ? workflow.holdMembership(commitment) : { member: false, txId: st.hold?.txId ?? null };
  const recall = commitment ? workflow.recallMembership(commitment) : { authorized: false, txId: st.recallAuthorized?.txId ?? null };

  // 3. Classify with full provenance.
  const receipt = await classifyScan(
    {
      gtin: input.gtin,
      lot: input.lot,
      expiry: input.expiry,
      productName: input.productName,
      scanOrigin: input.scanOrigin,
      passport: passportInfo,
    },
    {
      holdActive: !!st.hold,
      holdMember: hold.member,
      holdTxId: st.hold?.txId ?? hold.txId,
      recallActive: !!st.recallAuthorized,
      recallMember: recall.authorized,
      recallTxId: st.recallAuthorized?.txId ?? recall.txId,
      network: backend.info().network,
      contractAddress: backend.info().contractAddress,
      live: backend.mode === "live-devnet",
    },
  );
  return c.json(receipt);
});

/* Legacy passport-free FDA advisory lookup, used by the Command Center. */
app.get("/api/fda/advisory/:id", async (c) => {
  const id = c.req.param("id") === "lettuce" ? "lettuce" : "blueberries";
  const res = await getFdaAdvisory(id);
  return c.json(res);
});

/* ── ENCRYPTED SELECTIVE DISCLOSURE ─────────────────────────────────────
 * The PARTNER encrypts approved fields in-browser (ECDH+AES-GCM) and posts
 * ONLY the ciphertext package here; the server is a dumb mailbox. The
 * investigator fetches and decrypts client-side. Plaintext never transits. */

app.post("/api/disclosure/package", async (c) => {
  const raw = (await c.req.json()) as { replace?: boolean } & Record<string, unknown>;
  const parsed = DisclosurePackage.safeParse(raw);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  // Idempotent: a duplicate send for the same case+org returns the existing
  // package (409-style semantics with a 200 so the client can show it).
  const res = workflow.setDisclosure(parsed.data, raw.replace === true);
  return c.json({
    stored: res.stored,
    alreadyExisted: res.existing,
    authorizationHash: res.pkg.authorizationHash,
  });
});

app.get("/api/disclosure/package", (c) => {
  const pkg = workflow.getDisclosure();
  return c.json({ package: pkg });
});

app.get("/api/fda/recalls", async (c) => {
  try {
    const q = c.req.query("q") ?? "product_description:lettuce";
    const res = await searchFoodRecalls(q, 5);
    return c.json(res);
  } catch (e) {
    // Historical/supporting data — tolerate outages.
    return c.json({ meta: {}, results: [] });
  }
});

// Reference the affected fixture events so the count is honest at startup.
console.log(
  `[public-data-api] ${Object.keys(affectedEvents).length} synthetic affected events available for proofs`,
);

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[public-data-api] listening on http://127.0.0.1:${info.port}`);
});
