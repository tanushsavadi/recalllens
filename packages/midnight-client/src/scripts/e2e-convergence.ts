/**
 * End-to-end convergence proof against a live network — the P0 evidence.
 *
 * Deploys a fresh contract, seeds 3 orgs, opens the case, then runs THREE real
 * proveRelevantEvent proofs from three DISTINCT org credentials, reading the
 * public state after each to show the match count climbing 1 → 2 → 3 and the
 * convergence flag flipping. Also asserts a 4th proof from an already-counted
 * org is rejected (nullifier reuse).
 *
 * Prints tx ids + decoded public state so the run is verifiable evidence.
 *
 * Usage: tsx src/scripts/e2e-convergence.ts [--network undeployed]
 */
import { organizations, affectedEvents, DEMO_CASE } from "@recalllens/demo-fixtures";
import {
  openSession,
  deployRecallLens,
  registerAndCommit,
  openDemoCase,
  proveForOrg,
} from "../onchain";
import { readCaseState } from "../reader";
import { caseTag, bytesToHex } from "../crypto";
import { AFFECTED_LINEAGE_TOKEN } from "@recalllens/demo-fixtures";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function sourceHash(): string {
  const p = path.resolve(
    __dirname, "..", "..", "..", "source-adapters", "fixtures",
    "cdc-cyclospora-07-26.raw.html",
  );
  return createHash("sha256").update(fs.readFileSync(p)).digest("hex");
}

async function main() {
  const session = await openSession(process.argv);
  const { ledger } = await import("@recalllens/contract");
  const { indexerPublicDataProvider } = await import(
    "@midnight-ntwrk/midnight-js-indexer-public-data-provider"
  );
  const provider = indexerPublicDataProvider(
    session.networkConfig.indexer,
    session.networkConfig.indexerWS,
  );
  const expectedTag = bytesToHex(caseTag(DEMO_CASE.caseId, AFFECTED_LINEAGE_TOKEN));

  const readState = () =>
    readCaseState(
      provider as any,
      ledger,
      address,
      session.network,
      DEMO_CASE.caseId,
      expectedTag,
    );

  let address = "";
  try {
    address = await deployRecallLens(session);
    console.log(`deployed: ${address}`);

    const orgs = organizations
      .filter((o) => affectedEvents[o.orgId])
      .slice(0, DEMO_CASE.convergenceThreshold);

    for (const org of orgs) {
      const { registerTx, commitTx } = await registerAndCommit(session, address, org);
      console.log(`registered+committed ${org.name} reg=${registerTx.slice(0,10)} commit=${commitTx.slice(0,10)}`);
    }
    const caseTx = await openDemoCase(session, address, sourceHash());
    console.log(`openCase tx=${caseTx.slice(0,10)}`);

    let i = 0;
    for (const org of orgs) {
      i++;
      const { txId } = await proveForOrg(session, address, org);
      const st = await readState();
      console.log(
        `proof ${i}/${orgs.length} ${org.name} tx=${txId.slice(0,10)} → matchCount=${st.matchCount} converged=${st.converged} nullifiers=${st.nullifiers.length}`,
      );
    }

    // Duplicate-nullifier check: re-prove org[0] → must be rejected.
    let duplicateRejected = false;
    try {
      await proveForOrg(session, address, orgs[0]);
    } catch (e) {
      duplicateRejected = true;
      console.log(`duplicate proof correctly rejected: ${(e as Error).message.slice(0, 80)}`);
    }

    const final = await readState();
    console.log("\n=== FINAL PUBLIC STATE ===");
    console.log(JSON.stringify(final, null, 2));

    const ok =
      final.matchCount === DEMO_CASE.convergenceThreshold &&
      final.converged === true &&
      final.nullifiers.length === DEMO_CASE.convergenceThreshold &&
      duplicateRejected;
    console.log(ok ? "\n✅ E2E CONVERGENCE PASSED" : "\n❌ E2E CONVERGENCE FAILED");
    if (!ok) process.exitCode = 1;
  } finally {
    await session.stop();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
