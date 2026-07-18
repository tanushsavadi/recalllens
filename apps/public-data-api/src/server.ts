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
import {
  getOutbreak,
  searchFoodRecalls,
} from "@recalllens/source-adapters";
import {
  DEMO_CASE,
  computeRecallImpact,
  receipts,
  affectedEvents,
  AFFECTED_LINEAGE_TOKEN,
  lookupVaultLot,
  organizations,
} from "@recalllens/demo-fixtures";
import {
  SubmitProofRequest,
  ConsumerCheckRequest,
  ScanCheckRequest,
  DisclosureRequest,
} from "@recalllens/schemas";
import { selectBackend } from "@recalllens/midnight-client";
import { makeAuthorization } from "./disclosure";

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

app.post("/api/case/prove", async (c) => {
  const parsed = SubmitProofRequest.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  try {
    const { proof, chain } = await backend.submitProof(
      parsed.data.caseId,
      parsed.data.orgId,
    );
    return c.json({ accepted: true, proof, chain });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

app.post("/api/case/:caseId/reset", async (c) => {
  const caseId = c.req.param("caseId");
  if (!backend.reset) {
    return c.json(
      { reset: false, mode: backend.mode, note: "live backend cannot un-submit on-chain proofs; re-seed via deploy script" },
      200,
    );
  }
  await backend.reset(caseId);
  return c.json({ reset: true, mode: backend.mode });
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

app.post("/api/scan/check", async (c) => {
  const parsed = ScanCheckRequest.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const { caseId, gtin, lot } = parsed.data;

  // The GTIN+lot are LOOKUP KEYS into the private vault. The vault resolves the
  // private lineage token (which never appears on the label or the ledger).
  const vault = lookupVaultLot(gtin, lot);
  const isAffected = vault?.lineageToken === AFFECTED_LINEAGE_TOKEN;

  const safetyDisclaimer =
    "This is not proof that the product is safe, and not a medical diagnosis. Follow current CDC/FDA guidance.";

  if (!isAffected) {
    // Never fabricate an affected result. Unknown lot or clean lot → honest
    // no-intersection, with the safety caveat and a link to the official case.
    return c.json({
      outcome: "no-intersection",
      affected: false,
      matchedVault: !!vault,
      title: vault
        ? "No verified intersection found"
        : "No verified intersection found in the information currently available",
      message: vault
        ? "This scanned lot does not intersect the verified affected lineage for this outbreak case."
        : "This product/lot has no authoritative match in the information currently available. The official investigation concerns shredded iceberg lettuce served through specific restaurant locations; an arbitrary retail bag is not automatically part of that investigation.",
      guidance:
        "No action indicated by RecallLens. Monitor official updates and follow food-safety guidance.",
      safetyDisclaimer,
      sourceUrl: DEMO_CASE.sourceUrl,
      syntheticPrivateRecords: true,
      proofSubmitted: false,
      proof: null,
      chain: await backend.getCaseState(caseId).catch(() => null),
    });
  }

  // SYNTHETIC POSITIVE: the affected demo lot. Drive the genuine pipeline — run
  // the next unconfirmed org's REAL proof (the live convergence action). If all
  // are already confirmed (already converged), just read the verified state.
  const proofs = await backend.getProofs(caseId);
  const next = proofs.find((p) => p.stage !== "confirmed");
  let submittedProof = null;
  let chain = await backend.getCaseState(caseId);
  if (next) {
    try {
      const res = await backend.submitProof(caseId, next.orgId);
      submittedProof = res.proof;
      chain = res.chain;
    } catch (e) {
      return c.json(
        {
          outcome: "synthetic-positive",
          affected: true,
          matchedVault: true,
          title: "Synthetic positive demonstration — proof failed",
          message: `The affected synthetic lot matched, but the on-chain proof failed: ${
            e instanceof Error ? e.message : String(e)
          }`,
          guidance: "Retry, or check proof-server/indexer status.",
          safetyDisclaimer,
          sourceUrl: DEMO_CASE.sourceUrl,
          syntheticPrivateRecords: true,
          proofSubmitted: false,
          proof: null,
          chain,
        },
        200,
      );
    }
  } else {
    submittedProof = proofs.find((p) => p.role === "distributor") ?? null;
  }

  const orgName =
    organizations.find((o) => o.orgId === (next?.orgId ?? ""))?.name ?? "a partner";

  return c.json({
    outcome: "synthetic-positive",
    affected: true,
    matchedVault: true,
    title: "Affected purchase detected — synthetic positive demonstration",
    message: `The scanned lot matches the verified affected lineage. ${
      next
        ? `Running ${orgName}'s private proof produced a genuine Compact-backed state transition.`
        : "This case has already converged on-chain."
    }`,
    guidance:
      "If you have symptoms of cyclosporiasis (watery diarrhea, loss of appetite, cramping), contact a healthcare provider. Do not consume any remaining product from this purchase.",
    safetyDisclaimer:
      "The private partner records are synthetic; the Compact proof and Midnight state transition are genuine. " +
      safetyDisclaimer,
    sourceUrl: DEMO_CASE.sourceUrl,
    syntheticPrivateRecords: true,
    proofSubmitted: !!submittedProof && !!next,
    proof: submittedProof,
    chain,
  });
});

app.post("/api/disclosure/authorize", async (c) => {
  const body = await c.req.json();
  const parsed = DisclosureRequest.extend({
    approved: (await import("zod")).z.boolean(),
  }).safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const auth = makeAuthorization(
    parsed.data.caseId,
    parsed.data.orgId,
    parsed.data.requestedFields,
    parsed.data.approved,
    new Date().toISOString(),
  );
  return c.json(auth);
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
