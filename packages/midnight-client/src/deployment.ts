/**
 * Deployment record for the RecallLens contract on a given network.
 * Small JSON side-file so the API and scripts agree on the contract address.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * The deployment record lives at the monorepo root so every workspace package
 * (scripts run from packages/midnight-client, the API run from
 * apps/public-data-api) resolves the SAME file regardless of cwd.
 * packages/midnight-client/src → up 3 = repo root.
 */
function repoRoot(): string {
  return path.resolve(__dirname, "..", "..", "..");
}

export interface RecallLensDeployment {
  network: string;
  contractAddress: string;
  caseId: string;
  deployedAt: string;
  /** org fixtures that were registered + committed at seed time */
  seededOrgIds: string[];
  /** how many org proofs were pre-submitted before the live demo */
  preSubmittedOrgIds: string[];
  /** GENUINE settled tx ids for proofs pre-submitted at seed time, by orgId.
   * These are real runtime receipts — never placeholders. Optional for
   * backward compatibility with older deployment records. */
  preSubmittedProofTxIds?: Record<string, string>;
  /** GENUINE settled tx ids for Sentinel signals pre-submitted at seed time */
  preSubmittedSignalTxIds?: Record<string, string>;
}

const FILE = ".recalllens-deployment.json";

function filePath(): string {
  return path.join(repoRoot(), FILE);
}

export function loadDeployment(): RecallLensDeployment | null {
  const p = filePath();
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8")) as RecallLensDeployment;
  } catch {
    return null;
  }
}

export function saveDeployment(d: RecallLensDeployment): void {
  fs.writeFileSync(filePath(), `${JSON.stringify(d, null, 2)}\n`);
}
