/**
 * LiveDevnetBackend — real deploy + real ZK proofs + real indexer reads.
 *
 * Enabled only when a deployment record exists AND the devnet is reachable.
 * Otherwise tryCreateLiveBackend() returns null and the caller uses the
 * honest deterministic fallback.
 *
 * The engine keeps a single wallet session alive. Proof generation is a real
 * ZK proof against the local proof server and a settled transaction; state is
 * read back through the indexer, never fabricated.
 */
import type { CaseChainState, OrgProof, ProofStage } from "@recalllens/schemas";
import {
  organizations,
  affectedEvents,
  DEMO_CASE,
  AFFECTED_LINEAGE_TOKEN,
} from "@recalllens/demo-fixtures";
import type { ChainBackend } from "./backend";
import { loadDeployment } from "./deployment";
import { readCaseState } from "./reader";
import {
  caseTag as deriveCaseTag,
  orgNullifier as deriveOrgNullifier,
  bytesToHex,
} from "./crypto";
import type { OnchainSession } from "./onchain";

async function devnetReachable(indexerUrl: string): Promise<boolean> {
  try {
    const res = await fetch(indexerUrl.replace(/\/graphql.*$/, "/graphql"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "{ __typename }" }),
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function tryCreateLiveBackend(): Promise<ChainBackend | null> {
  const dep = loadDeployment();
  if (!dep) return null;

  // Only attempt for local devnet by default; public networks add sync latency.
  const { NETWORK_CONFIGS } = await import("./network");
  const cfg = NETWORK_CONFIGS[dep.network as keyof typeof NETWORK_CONFIGS];
  if (!cfg) return null;
  if (!(await devnetReachable(cfg.indexer))) return null;

  const backend = new LiveDevnetBackend(dep.contractAddress, dep.network, dep.preSubmittedOrgIds ?? []);
  await backend.init();
  return backend;
}

export class LiveDevnetBackend implements ChainBackend {
  readonly mode = "live-devnet" as const;
  private session: OnchainSession | null = null;
  private proofs = new Map<string, OrgProof>();
  private ledgerFn: ((d: any) => any) | null = null;
  private expectedCaseTag: string | null = null;

  constructor(
    private contractAddress: string,
    private network: string,
    private preSubmittedOrgIds: string[],
  ) {}

  info() {
    return { contractAddress: this.contractAddress, network: this.network };
  }

  async init(): Promise<void> {
    // Compute the expected case tag from the affected lineage (public math).
    this.expectedCaseTag = bytesToHex(
      deriveCaseTag(DEMO_CASE.caseId, AFFECTED_LINEAGE_TOKEN),
    );

    // Load the compiled ledger() decoder.
    const mod = await import("@recalllens/contract");
    this.ledgerFn = mod.ledger;

    // Seed the proof list. Orgs already proven on-chain are marked confirmed;
    // pre-submitted ones are flagged.
    const proveable = organizations
      .filter((o) => affectedEvents[o.orgId])
      .slice(0, DEMO_CASE.convergenceThreshold);
    const chain = await this.safeState();
    const provenNullifiers = new Set(chain?.nullifiers ?? []);

    for (const o of proveable) {
      const nullifier = bytesToHex(
        deriveOrgNullifier(DEMO_CASE.caseId, o.orgSecret),
      );
      const alreadyProven = provenNullifiers.has(nullifier);
      const preSubmitted = this.preSubmittedOrgIds.includes(o.orgId);
      this.proofs.set(o.orgId, {
        orgId: o.orgId,
        orgName: o.name,
        role: o.role,
        stage: alreadyProven ? "confirmed" : "queued",
        orgNullifier: alreadyProven ? nullifier : null,
        txId: alreadyProven && preSubmitted ? "(pre-submitted)" : null,
        blockHeight: null,
        preSubmitted,
        error: null,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  private async ensureSession(): Promise<OnchainSession> {
    if (this.session) return this.session;
    const { openSession } = await import("./onchain");
    this.session = await openSession(["node", "script", "--network", this.network]);
    return this.session;
  }

  private async safeState(): Promise<CaseChainState | null> {
    try {
      const { indexerPublicDataProvider } = await import(
        "@midnight-ntwrk/midnight-js-indexer-public-data-provider"
      );
      const { NETWORK_CONFIGS } = await import("./network");
      const cfg = NETWORK_CONFIGS[this.network as keyof typeof NETWORK_CONFIGS];
      const provider = indexerPublicDataProvider(cfg.indexer, cfg.indexerWS);
      return await readCaseState(
        provider as any,
        this.ledgerFn!,
        this.contractAddress,
        this.network,
        DEMO_CASE.caseId,
        this.expectedCaseTag,
      );
    } catch {
      return null;
    }
  }

  async getCaseState(): Promise<CaseChainState> {
    const s = await this.safeState();
    if (s) return s;
    // Reading failed — surface an honest zeroed state rather than fabricate.
    return {
      contractAddress: this.contractAddress,
      network: this.network,
      caseId: DEMO_CASE.caseId,
      caseOpen: true,
      caseTag: this.expectedCaseTag,
      matchCount: 0,
      convergenceThreshold: DEMO_CASE.convergenceThreshold,
      converged: false,
      nullifiers: [],
      eventCommitmentCount: 0,
      registeredOrgCount: 0,
    };
  }

  async getProofs(): Promise<OrgProof[]> {
    // Reconcile confirmed set with on-chain nullifiers each read.
    const chain = await this.safeState();
    const proven = new Set(chain?.nullifiers ?? []);
    for (const [orgId, p] of this.proofs) {
      const org = organizations.find((o) => o.orgId === orgId)!;
      const nullifier = bytesToHex(deriveOrgNullifier(DEMO_CASE.caseId, org.orgSecret));
      if (proven.has(nullifier) && p.stage !== "confirmed") {
        this.proofs.set(orgId, {
          ...p,
          stage: "confirmed",
          orgNullifier: nullifier,
          updatedAt: new Date().toISOString(),
        });
      }
    }
    return [...this.proofs.values()];
  }

  private setStage(orgId: string, stage: ProofStage, patch: Partial<OrgProof> = {}) {
    const p = this.proofs.get(orgId);
    if (!p) return;
    this.proofs.set(orgId, { ...p, stage, ...patch, updatedAt: new Date().toISOString() });
  }

  async submitProof(
    _caseId: string,
    orgId: string,
  ): Promise<{ proof: OrgProof; chain: CaseChainState }> {
    const org = organizations.find((o) => o.orgId === orgId);
    if (!org || !affectedEvents[orgId]) {
      throw new Error(`no affected fixture for org ${orgId}`);
    }
    try {
      this.setStage(orgId, "building-witness");
      const session = await this.ensureSession();
      this.setStage(orgId, "proving");
      const { proveForOrg } = await import("./onchain");
      const { txId, blockHeight } = await proveForOrg(session, this.contractAddress, org);
      this.setStage(orgId, "confirmed", {
        txId,
        blockHeight,
        orgNullifier: bytesToHex(deriveOrgNullifier(DEMO_CASE.caseId, org.orgSecret)),
      });
    } catch (e) {
      this.setStage(orgId, "failed", {
        error: e instanceof Error ? e.message : String(e),
      });
      throw e;
    }
    return {
      proof: this.proofs.get(orgId)!,
      chain: await this.getCaseState(),
    };
  }
}
