/**
 * Public-state reader — decodes RecallLens ledger state from the indexer.
 */
import type { CaseChainState } from "@recalllens/schemas";
import { DEMO_CASE } from "@recalllens/demo-fixtures";
import { bytesToHex } from "./crypto";

/**
 * Query the contract's public state via the indexer and decode the RecallLens
 * ledger for a given case. `caseTagHex` is the expected case tag (computed from
 * the affected lineage) so we can read that tag's match count; on-chain the tag
 * is anonymous, so we look up the count for the tag the affected orgs produce.
 */
export async function readCaseState(
  publicDataProvider: { queryContractState: (a: string) => Promise<{ data: any } | null> },
  ledgerFn: (data: any) => any,
  contractAddress: string,
  network: string,
  caseId: string,
  expectedCaseTagHex: string | null,
): Promise<CaseChainState> {
  const state = await publicDataProvider.queryContractState(contractAddress);
  if (!state) {
    throw new Error(`no contract state at ${contractAddress}`);
  }
  const l = ledgerFn(state.data);

  const caseIdBytes = hexToBytesLocal(caseId);
  const caseOpen = l.cases.member(caseIdBytes)
    ? l.cases.lookup(caseIdBytes).open
    : false;

  const nullifiers: string[] = [];
  for (const n of l.orgNullifiers) nullifiers.push(bytesToHex(n));

  let matchCount = 0;
  let converged = false;
  let caseTag = expectedCaseTagHex;
  if (expectedCaseTagHex) {
    const tagBytes = hexToBytesLocal(expectedCaseTagHex);
    matchCount = l.matchCount.member(tagBytes)
      ? Number(l.matchCount.lookup(tagBytes).read())
      : 0;
    converged = l.converged.member(tagBytes)
      ? l.converged.lookup(tagBytes)
      : false;
  }

  const eventCommitmentCount = Number(l.eventTree.firstFree());
  const registeredOrgCount = Number(l.orgRegistry.firstFree());

  return {
    contractAddress,
    network,
    caseId,
    caseOpen,
    caseTag,
    matchCount,
    convergenceThreshold: Number(l.threshold ?? DEMO_CASE.convergenceThreshold),
    converged,
    nullifiers,
    eventCommitmentCount,
    registeredOrgCount,
  };
}

function hexToBytesLocal(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++)
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}
