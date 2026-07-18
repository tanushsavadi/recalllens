/**
 * Deploy RecallLens to the selected network and seed the demo:
 *   - deploy (threshold = 3)
 *   - register 3 orgs + commit their trace events
 *   - openCase bound to the CDC snapshot hash
 *   - optionally pre-submit the first N org proofs (--presubmit N)
 *
 * Writes .recalllens-deployment.json for the API/live backend.
 *
 * Usage:
 *   tsx src/scripts/deploy-and-seed.ts [--network undeployed] [--presubmit 2]
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { organizations, affectedEvents, DEMO_CASE } from "@recalllens/demo-fixtures";
import {
  openSession,
  deployRecallLens,
  registerAndCommit,
  openDemoCase,
  proveForOrg,
} from "../onchain";
import { saveDeployment } from "../deployment";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function presubmitCount(argv: string[]): number {
  const i = argv.indexOf("--presubmit");
  if (i >= 0 && argv[i + 1]) return Number(argv[i + 1]);
  return 0;
}

function cdcSnapshotHash(): string {
  // Bind the case to the checked-in CDC snapshot content.
  const p = path.resolve(
    __dirname,
    "..", "..", "..",
    "source-adapters",
    "fixtures",
    "cdc-cyclospora-07-26.raw.html",
  );
  const html = fs.readFileSync(p);
  return createHash("sha256").update(html).digest("hex");
}

async function main() {
  const argv = process.argv;
  const nPre = presubmitCount(argv);
  console.log("── RecallLens deploy + seed ──");
  const session = await openSession(argv);
  console.log(`network: ${session.network}`);

  try {
    const address = await deployRecallLens(session);
    console.log(`✅ deployed: ${address}`);

    const proveable = organizations
      .filter((o) => affectedEvents[o.orgId])
      .slice(0, DEMO_CASE.convergenceThreshold);

    for (const org of proveable) {
      const { registerTx, commitTx } = await registerAndCommit(session, address, org);
      console.log(`  registered ${org.name}  reg=${registerTx.slice(0, 10)} commit=${commitTx.slice(0, 10)}`);
    }

    const sourceHash = cdcSnapshotHash();
    const caseTx = await openDemoCase(session, address, sourceHash);
    console.log(`  opened case ${DEMO_CASE.caseId.slice(0, 12)}… tx=${caseTx.slice(0, 10)} sourceHash=${sourceHash.slice(0, 12)}…`);

    const preSubmittedOrgIds: string[] = [];
    for (let i = 0; i < nPre && i < proveable.length; i++) {
      const org = proveable[i];
      const { txId, blockHeight } = await proveForOrg(session, address, org);
      preSubmittedOrgIds.push(org.orgId);
      console.log(`  ⚡ pre-submitted proof ${org.name} tx=${txId.slice(0, 10)} block=${blockHeight}`);
    }

    saveDeployment({
      network: session.network,
      contractAddress: address,
      caseId: DEMO_CASE.caseId,
      deployedAt: new Date().toISOString(),
      seededOrgIds: proveable.map((o) => o.orgId),
      preSubmittedOrgIds,
    });
    console.log("✅ wrote .recalllens-deployment.json");
  } finally {
    await session.stop();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
