import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type TraceEvent = { lineageToken: Uint8Array;
                           productHash: Uint8Array;
                           eventTime: bigint;
                           blinding: Uint8Array
                         };

export type CaseInfo = { sourceHash: Uint8Array;
                         productHash: Uint8Array;
                         windowStart: bigint;
                         windowEnd: bigint;
                         open: boolean
                       };

export type SafetySignal = { lineageToken: Uint8Array;
                             productHash: Uint8Array;
                             signalTime: bigint;
                             category: bigint;
                             blinding: Uint8Array
                           };

export type SentinelCaseInfo = { productHash: Uint8Array;
                                 windowStart: bigint;
                                 windowEnd: bigint;
                                 open: boolean
                               };

export type Witnesses<PS> = {
  getOrgSecret(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  getRegistrarSecret(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  getTraceEvent(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, TraceEvent];
  getEventPath(context: __compactRuntime.WitnessContext<Ledger, PS>,
               commitment_0: Uint8Array): [PS, { leaf: Uint8Array,
                                                 path: { sibling: { field: bigint
                                                                  },
                                                         goes_left: boolean
                                                       }[]
                                               }];
  getOrgPath(context: __compactRuntime.WitnessContext<Ledger, PS>,
             orgCommitment_0: Uint8Array): [PS, { leaf: Uint8Array,
                                                  path: { sibling: { field: bigint
                                                                   },
                                                          goes_left: boolean
                                                        }[]
                                                }];
  getSafetySignal(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, SafetySignal];
}

export type ImpureCircuits<PS> = {
  registerOrganization(context: __compactRuntime.CircuitContext<PS>,
                       orgCommitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  commitTraceEvent(context: __compactRuntime.CircuitContext<PS>,
                   eventCommitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  openCase(context: __compactRuntime.CircuitContext<PS>,
           caseId_0: Uint8Array,
           sourceHash_0: Uint8Array,
           productHash_0: Uint8Array,
           windowStart_0: bigint,
           windowEnd_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  closeCase(context: __compactRuntime.CircuitContext<PS>, caseId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  openSentinelCase(context: __compactRuntime.CircuitContext<PS>,
                   caseId_0: Uint8Array,
                   productHash_0: Uint8Array,
                   windowStart_0: bigint,
                   windowEnd_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  proveRelevantEvent(context: __compactRuntime.CircuitContext<PS>,
                     caseId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  submitSafetySignal(context: __compactRuntime.CircuitContext<PS>,
                     caseId_0: Uint8Array,
                     category_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  issuePrecautionaryHold(context: __compactRuntime.CircuitContext<PS>,
                         caseId_0: Uint8Array,
                         sentinelTag_0: Uint8Array,
                         holdCommitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  authorizeRecallPredicate(context: __compactRuntime.CircuitContext<PS>,
                           caseId_0: Uint8Array,
                           predicateHash_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  registerOrganization(context: __compactRuntime.CircuitContext<PS>,
                       orgCommitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  commitTraceEvent(context: __compactRuntime.CircuitContext<PS>,
                   eventCommitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  openCase(context: __compactRuntime.CircuitContext<PS>,
           caseId_0: Uint8Array,
           sourceHash_0: Uint8Array,
           productHash_0: Uint8Array,
           windowStart_0: bigint,
           windowEnd_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  closeCase(context: __compactRuntime.CircuitContext<PS>, caseId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  openSentinelCase(context: __compactRuntime.CircuitContext<PS>,
                   caseId_0: Uint8Array,
                   productHash_0: Uint8Array,
                   windowStart_0: bigint,
                   windowEnd_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  proveRelevantEvent(context: __compactRuntime.CircuitContext<PS>,
                     caseId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  submitSafetySignal(context: __compactRuntime.CircuitContext<PS>,
                     caseId_0: Uint8Array,
                     category_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  issuePrecautionaryHold(context: __compactRuntime.CircuitContext<PS>,
                         caseId_0: Uint8Array,
                         sentinelTag_0: Uint8Array,
                         holdCommitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  authorizeRecallPredicate(context: __compactRuntime.CircuitContext<PS>,
                           caseId_0: Uint8Array,
                           predicateHash_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
  deriveEventCommitment(lineageToken_0: Uint8Array,
                        productHash_0: Uint8Array,
                        eventTime_0: bigint,
                        blinding_0: Uint8Array): Uint8Array;
  deriveOrgCommitment(orgSecret_0: Uint8Array): Uint8Array;
  deriveCaseTag(caseId_0: Uint8Array, lineageToken_0: Uint8Array): Uint8Array;
  deriveOrgNullifier(caseId_0: Uint8Array, orgSecret_0: Uint8Array): Uint8Array;
  deriveRegistrarCommitment(registrarSecret_0: Uint8Array): Uint8Array;
  deriveSignalCommitment(lineageToken_0: Uint8Array,
                         productHash_0: Uint8Array,
                         signalTime_0: bigint,
                         category_0: bigint,
                         blinding_0: Uint8Array): Uint8Array;
  deriveSentinelTag(caseId_0: Uint8Array, lineageToken_0: Uint8Array): Uint8Array;
  deriveSignalNullifier(caseId_0: Uint8Array, orgSecret_0: Uint8Array): Uint8Array;
}

export type Circuits<PS> = {
  deriveEventCommitment(context: __compactRuntime.CircuitContext<PS>,
                        lineageToken_0: Uint8Array,
                        productHash_0: Uint8Array,
                        eventTime_0: bigint,
                        blinding_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  deriveOrgCommitment(context: __compactRuntime.CircuitContext<PS>,
                      orgSecret_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  deriveCaseTag(context: __compactRuntime.CircuitContext<PS>,
                caseId_0: Uint8Array,
                lineageToken_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  deriveOrgNullifier(context: __compactRuntime.CircuitContext<PS>,
                     caseId_0: Uint8Array,
                     orgSecret_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  deriveRegistrarCommitment(context: __compactRuntime.CircuitContext<PS>,
                            registrarSecret_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  deriveSignalCommitment(context: __compactRuntime.CircuitContext<PS>,
                         lineageToken_0: Uint8Array,
                         productHash_0: Uint8Array,
                         signalTime_0: bigint,
                         category_0: bigint,
                         blinding_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  deriveSentinelTag(context: __compactRuntime.CircuitContext<PS>,
                    caseId_0: Uint8Array,
                    lineageToken_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  deriveSignalNullifier(context: __compactRuntime.CircuitContext<PS>,
                        caseId_0: Uint8Array,
                        orgSecret_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  registerOrganization(context: __compactRuntime.CircuitContext<PS>,
                       orgCommitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  commitTraceEvent(context: __compactRuntime.CircuitContext<PS>,
                   eventCommitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  openCase(context: __compactRuntime.CircuitContext<PS>,
           caseId_0: Uint8Array,
           sourceHash_0: Uint8Array,
           productHash_0: Uint8Array,
           windowStart_0: bigint,
           windowEnd_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  closeCase(context: __compactRuntime.CircuitContext<PS>, caseId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  openSentinelCase(context: __compactRuntime.CircuitContext<PS>,
                   caseId_0: Uint8Array,
                   productHash_0: Uint8Array,
                   windowStart_0: bigint,
                   windowEnd_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  proveRelevantEvent(context: __compactRuntime.CircuitContext<PS>,
                     caseId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  submitSafetySignal(context: __compactRuntime.CircuitContext<PS>,
                     caseId_0: Uint8Array,
                     category_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  issuePrecautionaryHold(context: __compactRuntime.CircuitContext<PS>,
                         caseId_0: Uint8Array,
                         sentinelTag_0: Uint8Array,
                         holdCommitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  authorizeRecallPredicate(context: __compactRuntime.CircuitContext<PS>,
                           caseId_0: Uint8Array,
                           predicateHash_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  orgRegistry: {
    isFull(): boolean;
    checkRoot(rt_0: { field: bigint }): boolean;
    root(): __compactRuntime.MerkleTreeDigest;
    firstFree(): bigint;
    pathForLeaf(index_0: bigint, leaf_0: Uint8Array): __compactRuntime.MerkleTreePath<Uint8Array>;
    findPathForLeaf(leaf_0: Uint8Array): __compactRuntime.MerkleTreePath<Uint8Array> | undefined;
    history(): Iterator<__compactRuntime.MerkleTreeDigest>
  };
  eventTree: {
    isFull(): boolean;
    checkRoot(rt_0: { field: bigint }): boolean;
    root(): __compactRuntime.MerkleTreeDigest;
    firstFree(): bigint;
    pathForLeaf(index_0: bigint, leaf_0: Uint8Array): __compactRuntime.MerkleTreePath<Uint8Array>;
    findPathForLeaf(leaf_0: Uint8Array): __compactRuntime.MerkleTreePath<Uint8Array> | undefined;
    history(): Iterator<__compactRuntime.MerkleTreeDigest>
  };
  cases: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): CaseInfo;
    [Symbol.iterator](): Iterator<[Uint8Array, CaseInfo]>
  };
  matchCount: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): { read(): bigint }
  };
  orgNullifiers: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  converged: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<[Uint8Array, boolean]>
  };
  readonly threshold: bigint;
  readonly registrarCommitment: Uint8Array;
  sentinelCases: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): SentinelCaseInfo;
    [Symbol.iterator](): Iterator<[Uint8Array, SentinelCaseInfo]>
  };
  signalCount: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): { read(): bigint }
  };
  sentinelQaSeen: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<[Uint8Array, boolean]>
  };
  sentinelColdSeen: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<[Uint8Array, boolean]>
  };
  sentinelExposureSeen: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<[Uint8Array, boolean]>
  };
  sentinelNullifiers: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  sentinelThresholdReached: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<[Uint8Array, boolean]>
  };
  holds: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Uint8Array;
    [Symbol.iterator](): Iterator<[Uint8Array, Uint8Array]>
  };
  recallAuthorizations: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Uint8Array;
    [Symbol.iterator](): Iterator<[Uint8Array, Uint8Array]>
  };
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>,
               convergenceThreshold_0: bigint,
               registrarCommitment__0: Uint8Array): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
