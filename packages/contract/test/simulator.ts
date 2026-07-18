// RecallLens circuit simulator.
//
// A thin wrapper over the compiler-generated `Contract` class and the
// @midnight-ntwrk/compact-runtime context helpers (`createConstructorContext` /
// `createCircuitContext`, which internally build the QueryContext + CostModel used
// by the official example-bboard simulator pattern). It lets tests call circuits
// as plain methods while persisting the evolving public ledger state and swapping
// the prover's private state per call (each organization has its own secret+event;
// the registrar has its own credential secret for the admission circuits).

import {
  createConstructorContext,
  createCircuitContext,
  type CircuitContext,
} from "@midnight-ntwrk/compact-runtime";
import {
  Contract,
  ledger,
  type Ledger,
} from "../src/managed/recalllens/contract/index.js";
import {
  witnesses,
  type RecallLensPrivateState,
} from "../src/witnesses.js";

// A default coin public key for the caller. RecallLens does not use ownPublicKey()
// or caller-based access control, so this value is irrelevant to correctness.
const COIN_PK = "0".repeat(64);

// A stable contract address for the simulated deployment.
const CONTRACT_ADDRESS = "0".repeat(64);

// An all-zero private state. The admission circuits consult getRegistrarSecret, so
// callers must pass a state carrying the correct registrar secret; this default is
// only used for the constructor (which reads no witnesses) and commitTraceEvent.
const ZERO_PRIVATE_STATE: RecallLensPrivateState = {
  orgSecret: new Uint8Array(32),
  registrarSecret: new Uint8Array(32),
  traceEvent: {
    lineageToken: new Uint8Array(32),
    productHash: new Uint8Array(32),
    eventTime: 0n,
    blinding: new Uint8Array(32),
  },
};

// Build a private state that carries only a registrar secret (for admission calls).
function registrarState(registrarSecret: Uint8Array): RecallLensPrivateState {
  return { ...ZERO_PRIVATE_STATE, registrarSecret };
}

export class RecallLensSimulator {
  private readonly contract: Contract<RecallLensPrivateState>;
  // The evolving public ledger state (ChargedState), persisted across calls.
  private chargedState: unknown;
  private privateState: RecallLensPrivateState;

  // threshold: convergence threshold; registrarCommitment: deriveRegistrarCommitment
  // of the registrar secret, computed client-side (see tests/utils).
  constructor(threshold: bigint, registrarCommitment: Uint8Array) {
    this.contract = new Contract<RecallLensPrivateState>(witnesses);
    this.privateState = ZERO_PRIVATE_STATE;
    const ctorCtx = createConstructorContext(ZERO_PRIVATE_STATE, COIN_PK);
    const res = this.contract.initialState(ctorCtx, threshold, registrarCommitment);
    // ContractState.data is the ChargedState we thread through subsequent calls.
    this.chargedState = (res.currentContractState as { data: unknown }).data;
    this.privateState = res.currentPrivateState;
  }

  /** Decode the current public ledger state into a typed object. */
  public getLedger(): Ledger {
    return ledger(this.chargedState as never);
  }

  private buildContext(ps: RecallLensPrivateState): CircuitContext<RecallLensPrivateState> {
    return createCircuitContext<RecallLensPrivateState>(
      CONTRACT_ADDRESS,
      COIN_PK,
      this.chargedState as never,
      ps,
    );
  }

  private persist(res: {
    context: CircuitContext<RecallLensPrivateState>;
  }): void {
    this.chargedState = res.context.currentQueryContext.state;
    this.privateState = res.context.currentPrivateState;
  }

  // --- Registrar-gated admission circuits -----------------------------------
  // Each takes the registrar secret so tests can exercise the gate with the
  // correct secret (success) or a wrong one ("Not the registrar").

  public registerOrganization(
    orgCommitment: Uint8Array,
    registrarSecret: Uint8Array,
  ): void {
    const res = this.contract.impureCircuits.registerOrganization(
      this.buildContext(registrarState(registrarSecret)),
      orgCommitment,
    );
    this.persist(res);
  }

  public openCase(
    caseId: Uint8Array,
    sourceHash: Uint8Array,
    productHash: Uint8Array,
    windowStart: bigint,
    windowEnd: bigint,
    registrarSecret: Uint8Array,
  ): void {
    const res = this.contract.impureCircuits.openCase(
      this.buildContext(registrarState(registrarSecret)),
      caseId,
      sourceHash,
      productHash,
      windowStart,
      windowEnd,
    );
    this.persist(res);
  }

  public closeCase(caseId: Uint8Array, registrarSecret: Uint8Array): void {
    const res = this.contract.impureCircuits.closeCase(
      this.buildContext(registrarState(registrarSecret)),
      caseId,
    );
    this.persist(res);
  }

  // --- Open circuits --------------------------------------------------------

  // commitTraceEvent is NOT registrar-gated (an opaque leaf is inert on its own).
  public commitTraceEvent(eventCommitment: Uint8Array): void {
    const res = this.contract.impureCircuits.commitTraceEvent(
      this.buildContext(ZERO_PRIVATE_STATE),
      eventCommitment,
    );
    this.persist(res);
  }

  // The core circuit. The prover's private state (org secret + raw event) is
  // supplied per call, modelling a specific organization proving with a specific
  // held event. Open to any registered org — no registrar secret required.
  public proveRelevantEvent(
    caseId: Uint8Array,
    proverState: RecallLensPrivateState,
  ): void {
    const res = this.contract.impureCircuits.proveRelevantEvent(
      this.buildContext(proverState),
      caseId,
    );
    this.persist(res);
  }
}
