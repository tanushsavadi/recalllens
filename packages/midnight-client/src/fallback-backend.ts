/**
 * FallbackBackend — deterministic, in-memory implementation used when the live
 * Midnight devnet is unavailable, so the demo never dead-ends.
 *
 * It computes the SAME public values the contract would (caseTag, orgNullifier)
 * via the compiled `pureCircuits`, and enforces the SAME distinct-org nullifier
 * rule. It is ALWAYS reported as mode: "deterministic-fallback" and its proofs
 * carry no txId — it is never presented as a live proof.
 *
 * This mirrors the contract's logic in JS for presentation only; correctness of
 * the actual ZK circuit is proven by the contract's simulator tests and the
 * live devnet path.
 */
import type { CaseChainState, OrgProof } from "@recalllens/schemas";
import {
  organizations,
  affectedEvents,
  DEMO_CASE,
} from "@recalllens/demo-fixtures";
import type { ChainBackend } from "./backend";
import {
  caseTag as deriveCaseTag,
  orgNullifier as deriveOrgNullifier,
  eventCommitment,
  orgCommitment,
  bytesToHex,
} from "./crypto";

interface CaseRuntime {
  nullifiers: Set<string>; // hex
  matchByTag: Map<string, number>;
  caseTag: string | null;
  proofs: Map<string, OrgProof>;
}

export class FallbackBackend implements ChainBackend {
  readonly mode = "deterministic-fallback" as const;
  private cases = new Map<string, CaseRuntime>();
  // Precompute anchored commitments so counts are honest and non-trivial.
  private readonly eventCommitmentCount = Object.keys(affectedEvents).length;
  private readonly registeredOrgCount = organizations.length;

  constructor(private nowFn: () => Date = () => new Date()) {}

  info() {
    return {
      contractAddress: "(fallback — no on-chain deployment)",
      network: "deterministic-fallback",
    };
  }

  private runtime(caseId: string): CaseRuntime {
    let rt = this.cases.get(caseId);
    if (!rt) {
      rt = {
        nullifiers: new Set(),
        matchByTag: new Map(),
        caseTag: null,
        proofs: new Map(
          organizations
            .filter((o) => affectedEvents[o.orgId])
            .slice(0, DEMO_CASE.convergenceThreshold)
            .map((o) => [
              o.orgId,
              {
                orgId: o.orgId,
                orgName: o.name,
                role: o.role,
                stage: "queued" as const,
                orgNullifier: null,
                txId: null,
                blockHeight: null,
                preSubmitted: false,
                error: null,
                updatedAt: this.nowFn().toISOString(),
              },
            ]),
        ),
      };
      this.cases.set(caseId, rt);
    }
    return rt;
  }

  async reset(caseId: string): Promise<void> {
    this.cases.delete(caseId);
  }

  async getCaseState(caseId: string): Promise<CaseChainState> {
    const rt = this.runtime(caseId);
    const count = rt.caseTag ? (rt.matchByTag.get(rt.caseTag) ?? 0) : 0;
    return {
      contractAddress: this.info().contractAddress,
      network: this.info().network,
      caseId,
      caseOpen: true,
      caseTag: rt.caseTag,
      matchCount: count,
      convergenceThreshold: DEMO_CASE.convergenceThreshold,
      converged: count >= DEMO_CASE.convergenceThreshold,
      nullifiers: [...rt.nullifiers],
      eventCommitmentCount: this.eventCommitmentCount,
      registeredOrgCount: this.registeredOrgCount,
    };
  }

  async getProofs(caseId: string): Promise<OrgProof[]> {
    return [...this.runtime(caseId).proofs.values()];
  }

  async submitProof(
    caseId: string,
    orgId: string,
  ): Promise<{ proof: OrgProof; chain: CaseChainState }> {
    const rt = this.runtime(caseId);
    const org = organizations.find((o) => o.orgId === orgId);
    const ev = affectedEvents[orgId];
    if (!org || !ev) throw new Error(`no affected fixture for org ${orgId}`);

    // Sanity: recompute the commitments (matches what the circuit would prove).
    eventCommitment(ev);
    orgCommitment(org);

    const tag = bytesToHex(deriveCaseTag(caseId, ev.lineageToken));
    const nullifier = bytesToHex(deriveOrgNullifier(caseId, org.orgSecret));

    // Enforce the SAME distinct-org rule the contract enforces.
    if (rt.nullifiers.has(nullifier)) {
      throw new Error("Organization already counted for this case");
    }
    rt.nullifiers.add(nullifier);
    rt.caseTag = tag;
    rt.matchByTag.set(tag, (rt.matchByTag.get(tag) ?? 0) + 1);

    const proof: OrgProof = {
      orgId,
      orgName: org.name,
      role: org.role,
      stage: "confirmed",
      orgNullifier: nullifier,
      txId: null, // no tx — deterministic fallback, honestly
      blockHeight: null,
      preSubmitted: false,
      error: null,
      updatedAt: this.nowFn().toISOString(),
    };
    rt.proofs.set(orgId, proof);

    return { proof, chain: await this.getCaseState(caseId) };
  }
}
