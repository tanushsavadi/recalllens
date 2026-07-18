/**
 * Static-demo client for the Vercel preview.
 *
 * When VITE_STATIC_DEMO=1 there is no backend: the app serves the pre-generated
 * demo-state.generated.json (real pureCircuits derivations) and simulates the
 * proof progression client-side. It is CLEARLY badged "deterministic fallback"
 * and "Synthetic demonstration data" in the UI, and proofs carry no real txId.
 * This is the honest way to show the full product on a static host where the
 * local Midnight devnet is unreachable. The genuine on-chain proof lives in the
 * local demo (npm run e2e:onchain).
 */
import demo from "../demo-state.generated.json";
import {
  ConsumerCheckResponse,
  type CaseStatusResponse,
  type OutbreakResponse,
  type RecallImpactResponse,
  type DisclosureAuthorization,
  type ScanCheckResponse,
} from "@recalllens/schemas";
import {
  receipts,
  AFFECTED_LINEAGE_TOKEN,
  lookupVaultLot,
  DEMO_CASE,
} from "@recalllens/demo-fixtures";

// Client-side mutable count of "run live" proofs beyond the pre-submitted two.
let liveProven = 0;

function caseStatus(): CaseStatusResponse {
  // Merge the pre-submitted "building" state with any client-run proofs.
  const base = demo.building as unknown as CaseStatusResponse;
  const converged = demo.converged as unknown as CaseStatusResponse;
  if (liveProven >= 1) return converged;
  return base;
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const staticApi = {
  async health() {
    return {
      ok: true,
      checks: {
        cdc: { ok: true, detail: "cached (static preview)" },
        chain: { ok: false, detail: "deterministic-fallback · static preview" },
      },
    };
  },
  async outbreak(): Promise<OutbreakResponse> {
    return demo.outbreak as unknown as OutbreakResponse;
  },
  async caseStatus(): Promise<CaseStatusResponse> {
    return caseStatus();
  },
  async submitProof() {
    // Simulate the third proof (deterministic fallback — no live tx).
    await new Promise((r) => setTimeout(r, 1400));
    liveProven = 1;
    const chain = (demo.converged as unknown as CaseStatusResponse).chain;
    const proof = (demo.converged as unknown as CaseStatusResponse).proofs.find(
      (p) => !p.preSubmitted,
    )!;
    return { accepted: true, proof, chain };
  },
  async recallImpact(): Promise<RecallImpactResponse> {
    return demo.recallImpact as unknown as RecallImpactResponse;
  },
  async consumerCheck(receiptId: string) {
    const receipt = receipts.find((r) => r.receiptId === receiptId);
    const affected =
      receipt?.items.some((i) => i.lineageToken === AFFECTED_LINEAGE_TOKEN) ??
      false;
    return ConsumerCheckResponse.parse({
      affected,
      message: affected
        ? "A product on this receipt matches the verified affected lineage for this outbreak case."
        : "No product on this receipt intersects the verified affected lineage for this outbreak case.",
      guidance: affected
        ? "If you have symptoms of cyclosporiasis (watery diarrhea, loss of appetite, cramping), contact a healthcare provider. Do not consume any remaining product from this purchase."
        : "No action needed based on this receipt. Follow general food-safety guidance and monitor official updates.",
      sourceUrl: demo.sourceUrl,
    });
  },
  async scanCheck(
    _caseId: string,
    gtin: string,
    lot: string,
  ): Promise<ScanCheckResponse> {
    const vault = lookupVaultLot(gtin, lot);
    const isAffected = vault?.lineageToken === AFFECTED_LINEAGE_TOKEN;
    const safety =
      "This is not proof that the product is safe, and not a medical diagnosis. Follow current CDC/FDA guidance.";
    if (isAffected) {
      // Simulate the third proof (deterministic fallback — no live tx).
      await new Promise((r) => setTimeout(r, 1400));
      liveProven = 1;
      const conv = demo.converged as unknown as CaseStatusResponse;
      return {
        outcome: "synthetic-positive",
        affected: true,
        matchedVault: true,
        title: "Affected purchase detected — synthetic positive demonstration",
        message:
          "The scanned lot matches the verified affected lineage. In the live demo this runs a genuine Compact-backed proof; this preview uses a deterministic fallback.",
        guidance:
          "If you have symptoms of cyclosporiasis (watery diarrhea, loss of appetite, cramping), contact a healthcare provider. Do not consume any remaining product from this purchase.",
        safetyDisclaimer:
          "The private partner records are synthetic; in the live demo the Compact proof and Midnight state transition are genuine. " +
          safety,
        sourceUrl: DEMO_CASE.sourceUrl,
        syntheticPrivateRecords: true,
        proofSubmitted: false,
        proof: conv.proofs.find((p) => !p.preSubmitted) ?? null,
        chain: conv.chain,
      };
    }
    return {
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
      safetyDisclaimer: safety,
      sourceUrl: DEMO_CASE.sourceUrl,
      syntheticPrivateRecords: true,
      proofSubmitted: false,
      proof: null,
      chain: (demo.building as unknown as CaseStatusResponse).chain,
    };
  },
  async authorizeDisclosure(
    caseId: string,
    orgId: string,
    requestedFields: string[],
    approved: boolean,
  ): Promise<DisclosureAuthorization> {
    const canonical = JSON.stringify({
      sep: "rl:disclosure:v1",
      caseId,
      orgId,
      fields: [...requestedFields].sort(),
      approved,
    });
    return {
      caseId,
      orgId,
      requestedFields,
      approved,
      authorizationHash: await sha256Hex(canonical),
      createdAt: "2026-07-18T08:00:00.000Z",
    };
  },
};

export const IS_STATIC_DEMO = import.meta.env.VITE_STATIC_DEMO === "1";
