/**
 * ChainBackend — the interface the API uses to read public case state and
 * submit organization proofs.
 *
 * Two implementations:
 *   - LiveDevnetBackend  (src/live-backend.ts): real deploy + real ZK proofs +
 *     real indexer reads against the local Midnight devnet.
 *   - FallbackBackend    (src/fallback-backend.ts): deterministic, in-memory,
 *     computes the SAME public values (caseTag, orgNullifier) using the
 *     contract's exported pure-circuit hashing so the demo stays reliable if
 *     the network is down. It is ALWAYS labeled "deterministic-fallback" and
 *     never claimed to be a live proof.
 */
import type { CaseChainState, OrgProof } from "@recalllens/schemas";

export type ChainMode = "live-devnet" | "deterministic-fallback";

export interface ChainBackend {
  readonly mode: ChainMode;
  /** contract address + network for display */
  info(): { contractAddress: string; network: string };
  /** current public state for a case */
  getCaseState(caseId: string): Promise<CaseChainState>;
  /** all tracked org proofs for a case (pre-submitted + live) */
  getProofs(caseId: string): Promise<OrgProof[]>;
  /**
   * Submit one organization's private match proof. Reads the org's SYNTHETIC
   * fixture locally, builds the witness, produces the proof, submits the tx,
   * and returns the updated proof + case state. Never accepts private records
   * over the wire.
   */
  submitProof(
    caseId: string,
    orgId: string,
  ): Promise<{ proof: OrgProof; chain: CaseChainState }>;
  /**
   * Reset demo state. For the deterministic fallback this clears in-memory
   * nullifiers/counts back to the initial (pre-submitted) state, enabling
   * repeatable demos and isolated E2E tests. The live backend cannot un-submit
   * on-chain proofs, so it is a no-op there (re-seed via the deploy script).
   */
  reset?(caseId: string): Promise<void>;
}
