/**
 * On-chain engine for RecallLens — the genuine proof-backed path.
 *
 * Responsibilities:
 *   - build a seed wallet + providers against the selected Midnight network
 *   - deploy the contract (threshold = 3)
 *   - registerOrganization + commitTraceEvent for the synthetic orgs
 *   - openCase bound to the CDC source-snapshot hash
 *   - proveRelevantEvent for a given org (REAL ZK proof + settled tx)
 *   - read public state via the indexer
 *
 * Each proveRelevantEvent uses that org's own private state (orgSecret +
 * traceEvent) via a per-org privateStateId, so three distinct credentials
 * produce three distinct nullifiers — one caller-chosen secret cannot inflate
 * convergence.
 *
 * No private record ever leaves this process: witness fields are read from the
 * local synthetic fixtures and consumed inside the local proof server.
 */
import { WebSocket } from "ws";
import { deployContract, findDeployedContract } from "@midnight-ntwrk/midnight-js-contracts";
import {
  organizations,
  affectedEvents,
  DEMO_CASE,
  DEMO_REGISTRAR_SECRET,
} from "@recalllens/demo-fixtures";
import type { Organization, TraceEvent } from "@recalllens/schemas";
import { resolveNetwork, getOrCreateSeed, type NetworkConfig, type NetworkId } from "./network";
import { createWallet, persistWalletState, unshieldedToken, type WalletContext } from "./wallet";
import { createProviders, loadCompiledContract } from "./providers";
import {
  createRecallLensPrivateState,
  witnesses as recallWitnesses,
} from "@recalllens/contract";
import { hexToBytes, eventTimeUnix, productHash } from "./crypto";
import * as Rx from "rxjs";

// @ts-expect-error wallet sync requires a global WebSocket
globalThis.WebSocket = WebSocket;

function traceEventToContract(ev: TraceEvent) {
  return {
    lineageToken: hexToBytes(ev.lineageToken),
    productHash: productHash(ev.productGtin),
    eventTime: eventTimeUnix(ev.eventTime),
    blinding: hexToBytes(ev.blinding),
  };
}

export interface OnchainSession {
  network: NetworkId;
  networkConfig: NetworkConfig;
  walletCtx: WalletContext;
  providers: ReturnType<typeof createProviders>;
  stop: () => Promise<void>;
}

/** Build wallet + providers and wait for a funded, DUST-ready wallet. */
export async function openSession(argv: string[] = process.argv): Promise<OnchainSession> {
  const { network, config } = resolveNetwork({ argv });
  const seed = getOrCreateSeed(network);
  const walletCtx = await createWallet({ network, networkConfig: config, seed });
  const state = await walletCtx.wallet.waitForSyncedState();
  await persistWalletState(network, walletCtx);

  const balance = state.unshielded.balances[unshieldedToken().raw] ?? 0n;
  if (network === "undeployed" && balance === 0n) {
    await walletCtx.wallet.stop();
    throw new Error("Genesis wallet has 0 NIGHT — devnet may not have minted.");
  }

  // Ensure DUST is available (register NIGHT UTXOs, then wait for balance).
  const dustState = await Rx.firstValueFrom(
    walletCtx.wallet.state().pipe(Rx.filter((s: any) => s.isSynced)),
  );
  const unregistered = dustState.unshielded.availableCoins.filter(
    (c: any) => !c.meta?.registeredForDustGeneration,
  );
  if (unregistered.length > 0) {
    const recipe = await walletCtx.wallet.registerNightUtxosForDustGeneration(
      unregistered,
      walletCtx.unshieldedKeystore.getPublicKey(),
      (payload: any) => walletCtx.unshieldedKeystore.signData(payload),
    );
    const finalized = await walletCtx.wallet.finalizeRecipe(recipe);
    await walletCtx.wallet.submitTransaction(finalized);
  }
  if (dustState.dust.balance(new Date()) === 0n) {
    await Rx.firstValueFrom(
      walletCtx.wallet.state().pipe(
        Rx.throttleTime(5000),
        Rx.filter((s: any) => s.isSynced),
        Rx.filter((s: any) => s.dust.balance(new Date()) > 0n),
      ),
    );
  }

  const providers = createProviders(walletCtx, config);
  return {
    network,
    networkConfig: config,
    walletCtx,
    providers,
    stop: async () => {
      await persistWalletState(network, walletCtx);
      await walletCtx.wallet.stop();
    },
  };
}

const DEPLOY_PRIVATE_STATE_ID = "recalllens:deploy";

/**
 * Admin private state for registrar-gated circuits (register/commit/openCase/
 * closeCase). Carries the registrar secret so getRegistrarSecret() can prove
 * caller == registrar in-circuit. org[0]'s event is a harmless placeholder for
 * the traceEvent field, which these admin circuits do not read.
 */
function adminPrivateState() {
  const org = organizations[0];
  const ev = affectedEvents[org.orgId];
  return createRecallLensPrivateState(
    hexToBytes(org.orgSecret),
    traceEventToContract(ev),
    hexToBytes(DEMO_REGISTRAR_SECRET),
  );
}

/** Deploy a fresh RecallLens contract with the demo threshold + registrar. */
export async function deployRecallLens(session: OnchainSession): Promise<string> {
  const { pureCircuits } = await import("@recalllens/contract");
  const registrarCommitment = pureCircuits.deriveRegistrarCommitment(
    hexToBytes(DEMO_REGISTRAR_SECRET),
  );
  const compiled = await loadCompiledContract(recallWitnesses);
  const deployed: any = await deployContract(session.providers, {
    compiledContract: compiled as any,
    args: [BigInt(DEMO_CASE.convergenceThreshold), registrarCommitment],
    privateStateId: DEPLOY_PRIVATE_STATE_ID,
    initialPrivateState: adminPrivateState(),
  });
  return deployed.deployTxData.public.contractAddress as string;
}

async function adminHandle(session: OnchainSession, address: string) {
  const compiled = await loadCompiledContract(recallWitnesses);
  return (await findDeployedContract(session.providers, {
    compiledContract: compiled as any,
    contractAddress: address,
    privateStateId: DEPLOY_PRIVATE_STATE_ID,
    initialPrivateState: adminPrivateState(),
  })) as any;
}

/** Register an org credential commitment + commit its trace event. */
export async function registerAndCommit(
  session: OnchainSession,
  address: string,
  org: Organization,
): Promise<{ registerTx: string; commitTx: string }> {
  const { pureCircuits } = await import("@recalllens/contract");
  const handle = await adminHandle(session, address);
  const ev = affectedEvents[org.orgId];

  const orgCommit = pureCircuits.deriveOrgCommitment(hexToBytes(org.orgSecret));
  const r = await handle.callTx.registerOrganization(orgCommit);

  const evCommit = pureCircuits.deriveEventCommitment(
    hexToBytes(ev.lineageToken),
    productHash(ev.productGtin),
    eventTimeUnix(ev.eventTime),
    hexToBytes(ev.blinding),
  );
  const c = await handle.callTx.commitTraceEvent(evCommit);

  return { registerTx: r.public.txId, commitTx: c.public.txId };
}

/** Open the demo outbreak case bound to the given source-snapshot hash. */
export async function openDemoCase(
  session: OnchainSession,
  address: string,
  sourceHashHex: string,
): Promise<string> {
  const handle = await adminHandle(session, address);
  const res = await handle.callTx.openCase(
    hexToBytes(DEMO_CASE.caseId),
    hexToBytes(sourceHashHex),
    productHash(DEMO_CASE.productGtin),
    eventTimeUnix(DEMO_CASE.windowStart),
    eventTimeUnix(DEMO_CASE.windowEnd),
  );
  return res.public.txId;
}

/**
 * Prove one org's committed event matches the case — a REAL ZK proof and a
 * settled transaction. Uses a per-org privateStateId so the org's own secret +
 * event are the witnesses.
 */
export async function proveForOrg(
  session: OnchainSession,
  address: string,
  org: Organization,
): Promise<{ txId: string; blockHeight: number | null }> {
  const compiled = await loadCompiledContract(recallWitnesses);
  const ev = affectedEvents[org.orgId];
  const handle = (await findDeployedContract(session.providers, {
    compiledContract: compiled as any,
    contractAddress: address,
    privateStateId: `recalllens:org:${org.orgId}`,
    initialPrivateState: createRecallLensPrivateState(
      hexToBytes(org.orgSecret),
      traceEventToContract(ev),
    ),
  })) as any;

  const res = await handle.callTx.proveRelevantEvent(hexToBytes(DEMO_CASE.caseId));
  return {
    txId: res.public.txId,
    blockHeight: res.public.blockHeight ?? null,
  };
}

/* ── SENTINEL on-chain operations (genuine circuits) ─────────────────────── */

/** Deterministic synthetic signal record for an org (same lineage as its event). */
export function signalForOrg(org: Organization, category: number) {
  const ev = affectedEvents[org.orgId];
  return {
    lineageToken: hexToBytes(ev.lineageToken),
    productHash: productHash(ev.productGtin),
    signalTime: eventTimeUnix(ev.eventTime), // in the case window by construction
    category: BigInt(category),
    // deterministic per-org signal blinding (distinct from the event blinding)
    blinding: hexToBytes(ev.blinding.slice(0, 62) + "5e"),
  };
}

/** Open the Sentinel case (registrar-gated). */
export async function openSentinelCaseOnChain(
  session: OnchainSession,
  address: string,
): Promise<string> {
  const handle = await adminHandle(session, address);
  const res = await handle.callTx.openSentinelCase(
    hexToBytes(DEMO_CASE.caseId),
    productHash(DEMO_CASE.productGtin),
    eventTimeUnix(DEMO_CASE.windowStart),
    eventTimeUnix(DEMO_CASE.windowEnd),
  );
  return res.public.txId;
}

/** Commit an org's signal commitment (reuses commitTraceEvent's tree). */
export async function commitSignalForOrg(
  session: OnchainSession,
  address: string,
  org: Organization,
  category: number,
): Promise<string> {
  const { pureCircuits } = await import("@recalllens/contract");
  const handle = await adminHandle(session, address);
  const s = signalForOrg(org, category);
  const commitment = pureCircuits.deriveSignalCommitment(
    s.lineageToken,
    s.productHash,
    s.signalTime,
    s.category,
    s.blinding,
  );
  const res = await handle.callTx.commitTraceEvent(commitment);
  return res.public.txId;
}

/** The org itself submits its safety signal — REAL ZK proof + settled tx. */
export async function submitSignalForOrg(
  session: OnchainSession,
  address: string,
  org: Organization,
  category: number,
): Promise<{ txId: string; nullifier: string }> {
  const { pureCircuits } = await import("@recalllens/contract");
  const compiled = await loadCompiledContract(recallWitnesses);
  const ev = affectedEvents[org.orgId];
  const s = signalForOrg(org, category);
  const handle = (await findDeployedContract(session.providers, {
    compiledContract: compiled as any,
    contractAddress: address,
    privateStateId: `recalllens:sentinel:${org.orgId}`,
    initialPrivateState: createRecallLensPrivateState(
      hexToBytes(org.orgSecret),
      traceEventToContract(ev),
      undefined,
      s,
    ),
  })) as any;
  const res = await handle.callTx.submitSafetySignal(
    hexToBytes(DEMO_CASE.caseId),
    BigInt(category),
  );
  const nullifier = pureCircuits.deriveSignalNullifier(
    hexToBytes(DEMO_CASE.caseId),
    hexToBytes(org.orgSecret),
  );
  return {
    txId: res.public.txId,
    nullifier: Array.from(nullifier as Uint8Array)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(""),
  };
}

/** Registrar anchors the precautionary hold (requires threshold reached). */
export async function issueHoldOnChain(
  session: OnchainSession,
  address: string,
  holdCommitmentHex: string,
): Promise<string> {
  const { pureCircuits } = await import("@recalllens/contract");
  const handle = await adminHandle(session, address);
  // sentinelTag derives from the affected lineage (public math, same as UI)
  const anyAffected = Object.values(affectedEvents)[0];
  const tag = pureCircuits.deriveSentinelTag(
    hexToBytes(DEMO_CASE.caseId),
    hexToBytes(anyAffected.lineageToken),
  );
  const res = await handle.callTx.issuePrecautionaryHold(
    hexToBytes(DEMO_CASE.caseId),
    tag,
    hexToBytes(holdCommitmentHex),
  );
  return res.public.txId;
}

/** Registrar authorizes the recall predicate (requires an existing hold). */
export async function authorizeRecallOnChain(
  session: OnchainSession,
  address: string,
  predicateHashHex: string,
): Promise<string> {
  const handle = await adminHandle(session, address);
  const res = await handle.callTx.authorizeRecallPredicate(
    hexToBytes(DEMO_CASE.caseId),
    hexToBytes(predicateHashHex),
  );
  return res.public.txId;
}
