/**
 * Generate a static demo snapshot for the Vercel preview.
 *
 * Uses the REAL pureCircuits derivations (via FallbackBackend + crypto) and the
 * REAL CDC cached snapshot, so every value in the static preview is a genuine
 * derivation — not a hand-written mock. The preview is clearly labeled
 * "deterministic fallback" / "Synthetic demonstration data" in the UI.
 *
 * Writes apps/web/src/demo-state.generated.json.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { FallbackBackend } from "../fallback-backend";
import { getCachedSnapshot } from "@recalllens/source-adapters";
import {
  DEMO_CASE_ID,
  organizations,
  affectedEvents,
  computeRecallImpact,
  AFFECTED_LINEAGE_TOKEN,
  DEMO_CASE,
} from "@recalllens/demo-fixtures";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const fixedNow = () => new Date("2026-07-18T08:00:00Z");

  // "Building" state: 2 of 3 pre-submitted (mirrors the seeded live demo).
  const building = new FallbackBackend(fixedNow);
  const proveable = organizations
    .filter((o) => affectedEvents[o.orgId])
    .slice(0, DEMO_CASE.convergenceThreshold);
  await building.submitProof(DEMO_CASE_ID, proveable[0].orgId);
  await building.submitProof(DEMO_CASE_ID, proveable[1].orgId);
  const buildingChain = await building.getCaseState(DEMO_CASE_ID);
  const buildingProofs = (await building.getProofs(DEMO_CASE_ID)).map((p) =>
    proveable.slice(0, 2).some((o) => o.orgId === p.orgId)
      ? { ...p, preSubmitted: true, txId: "(pre-submitted)" }
      : p,
  );

  // "Converged" state: all 3.
  const converged = new FallbackBackend(fixedNow);
  for (const o of proveable) await converged.submitProof(DEMO_CASE_ID, o.orgId);
  const convergedChain = await converged.getCaseState(DEMO_CASE_ID);
  const convergedProofs = (await converged.getProofs(DEMO_CASE_ID)).map((p, i) =>
    i < 2
      ? { ...p, preSubmitted: true, txId: "(pre-submitted)" }
      : { ...p, txId: "(static-demo)" },
  );

  const snap = getCachedSnapshot();
  const impact = computeRecallImpact(AFFECTED_LINEAGE_TOKEN);

  const out = {
    note: "Static demonstration snapshot for the Vercel preview. Values are real pureCircuits derivations; proofs here are a deterministic fallback, not live on-chain proofs.",
    caseId: DEMO_CASE_ID,
    outbreak: { snapshot: snap, live: false, liveError: "static preview" },
    building: { chain: buildingChain, proofs: buildingProofs, mode: "deterministic-fallback" },
    converged: { chain: convergedChain, proofs: convergedProofs, mode: "deterministic-fallback" },
    recallImpact: {
      ...impact,
      label: "Simulated impact using demonstration supply records",
    },
    affectedLineageToken: AFFECTED_LINEAGE_TOKEN,
    sourceUrl: DEMO_CASE.sourceUrl,
  };

  const outPath = path.resolve(
    __dirname, "..", "..", "..", "..", "apps", "web", "src", "demo-state.generated.json",
  );
  fs.writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`);
  console.log("Wrote", outPath);
  console.log("building matchCount:", buildingChain.matchCount, "converged:", convergedChain.converged);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
