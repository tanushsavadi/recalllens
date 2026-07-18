// RecallLens — TypeScript witness implementations.
//
// These witnesses run locally on the prover's machine and supply the private
// inputs that `proveRelevantEvent` consumes. Their return values are confidential
// (PLONK private inputs) and are untrusted by the contract: the circuit re-derives
// every commitment from these fields and binds the supplied Merkle paths to those
// derivations (`assert(path.leaf == commitment)`), so a dishonest witness cannot
// smuggle in a mismatched event or an unregistered credential.
//
// IMPORTANT (client/circuit hash parity): the contract exports the five hash
// derivations as `pure circuit`s, surfaced in the generated JS as the module-level
// `pureCircuits` object. Off-chain code (this file's callers, the API layer, tests)
// MUST compute eventCommitment / orgCommitment / caseTag / orgNullifier /
// registrarCommitment by calling those `pureCircuits.*` functions — never a
// re-implemented JS hash — so the values match the in-circuit computation exactly.
// See recalllens.compact and the tests.

import {
  WitnessContext,
  type MerkleTreePath,
} from "@midnight-ntwrk/compact-runtime";
import {
  Ledger,
  SafetySignal,
  TraceEvent,
} from "./managed/recalllens/contract/index.js";

// The prover's local private state.
//
//   - orgSecret:       the 32-byte registered-organization credential secret.
//                      Whoever holds this secret controls the corresponding org
//                      commitment in the registry. Security boundary for "one org,
//                      one count per case". Consumed by getOrgSecret (proveRelevantEvent).
//   - traceEvent:      the raw trace event this prover holds. Never leaves the
//                      proof; only a commitment over it is ever committed on-chain.
//   - registrarSecret: the 32-byte registrar/coordinator credential secret. Only
//                      the deployer/registrar holds the real value; it gates the
//                      admission circuits (registerOrganization / openCase /
//                      closeCase / openSentinelCase / issuePrecautionaryHold /
//                      authorizeRecallPredicate) via getRegistrarSecret. Org-prover
//                      states that never administer may leave this as a zero
//                      placeholder, since proveRelevantEvent / submitSafetySignal
//                      do not call getRegistrarSecret.
//   - safetySignal:    (SENTINEL layer, optional) the raw safety signal this prover
//                      holds. Consumed by getSafetySignal (submitSafetySignal).
//                      Optional so existing callers that only use the outbreak layer
//                      keep working; when absent, a zero placeholder is returned and
//                      the circuit's path/leaf binding rejects it (it matches no
//                      committed leaf), exactly like an absent trace event.
//
// All fields are `readonly`; witnesses return a (possibly new) private-state
// object alongside their value, but RecallLens witnesses never mutate it.
export type RecallLensPrivateState = {
  readonly orgSecret: Uint8Array;
  readonly traceEvent: TraceEvent;
  readonly registrarSecret: Uint8Array;
  readonly safetySignal?: SafetySignal;
};

// A 32-byte zero placeholder for the registrar secret in non-admin (org-prover)
// private states. proveRelevantEvent never reads it, so it is inert there.
const ZERO_32 = new Uint8Array(32);

// A zero-valued SafetySignal placeholder for states that never call
// submitSafetySignal. Its (all-zero) derived commitment matches no committed leaf,
// so the circuit's path/leaf binding + checkRoot reject it in-circuit — the same
// safe-by-default behaviour as an absent trace event.
const ZERO_SIGNAL: SafetySignal = {
  lineageToken: ZERO_32,
  productHash: ZERO_32,
  signalTime: 0n,
  category: 0n,
  blinding: ZERO_32,
};

// Factory for a fresh private state. `orgSecret` must be exactly 32 bytes.
// `registrarSecret` defaults to a zero placeholder for org-prover states; supply
// the real registrar secret only for states used to call the admission circuits.
// `safetySignal` is optional (SENTINEL layer); omit it for pure outbreak-layer
// callers. Positional arity is unchanged for existing callers.
export const createRecallLensPrivateState = (
  orgSecret: Uint8Array,
  traceEvent: TraceEvent,
  registrarSecret: Uint8Array = ZERO_32,
  safetySignal?: SafetySignal,
): RecallLensPrivateState => ({
  orgSecret,
  traceEvent,
  registrarSecret,
  safetySignal,
});

// Merkle tree depth used by both ledger trees (see recalllens.compact).
const TREE_DEPTH = 10;

// Build a structurally-valid but non-membership Merkle path for a leaf that is
// NOT in the tree. Its leaf is the supplied commitment (so the circuit's
// `path.leaf == commitment` binding passes), but every sibling is the default
// (zero) digest, so the recomputed root cannot match any real tree root and the
// circuit's `checkRoot` assertion rejects the proof. This deliberately routes
// "leaf absent" rejection through the CONTRACT's in-circuit membership check
// rather than throwing witness-side (which would prove nothing about the
// contract). It also avoids the runtime error raised by `pathForLeaf` on an
// empty tree ("invalid index into sparse merkle tree").
function absentLeafPath(commitment: Uint8Array): MerkleTreePath<Uint8Array> {
  const path = Array.from({ length: TREE_DEPTH }, () => ({
    sibling: { field: 0n },
    goes_left: false,
  }));
  return { leaf: commitment, path };
}

export const witnesses = {
  // The registered-organization credential secret. Enforces the 32-byte width so
  // downstream hashing fails loudly rather than producing a silently-wrong value.
  getOrgSecret(
    context: WitnessContext<Ledger, RecallLensPrivateState>,
  ): [RecallLensPrivateState, Uint8Array] {
    const { orgSecret } = context.privateState;
    if (!orgSecret || orgSecret.length !== 32) {
      throw new Error("getOrgSecret: orgSecret is missing or not 32 bytes");
    }
    return [context.privateState, orgSecret];
  },

  // The raw trace event the prover claims to hold.
  getTraceEvent(
    context: WitnessContext<Ledger, RecallLensPrivateState>,
  ): [RecallLensPrivateState, TraceEvent] {
    return [context.privateState, context.privateState.traceEvent];
  },

  // The raw safety signal the prover claims to hold (SENTINEL layer). Returns the
  // zero placeholder when absent, so the circuit's path/leaf binding + checkRoot
  // reject it in-circuit (it matches no committed leaf) rather than the witness
  // throwing — the same enforced-by-the-contract rationale as getEventPath.
  getSafetySignal(
    context: WitnessContext<Ledger, RecallLensPrivateState>,
  ): [RecallLensPrivateState, SafetySignal] {
    return [
      context.privateState,
      context.privateState.safetySignal ?? ZERO_SIGNAL,
    ];
  },

  // The registrar credential secret, consumed by the admission circuits. The
  // contract recomputes its commitment in-circuit and compares to the pinned
  // registrarCommitment, so a wrong/placeholder value simply fails the "Not the
  // registrar" assertion in-circuit. Enforces the 32-byte width like getOrgSecret.
  getRegistrarSecret(
    context: WitnessContext<Ledger, RecallLensPrivateState>,
  ): [RecallLensPrivateState, Uint8Array] {
    const { registrarSecret } = context.privateState;
    if (!registrarSecret || registrarSecret.length !== 32) {
      throw new Error("getRegistrarSecret: registrarSecret is missing or not 32 bytes");
    }
    return [context.privateState, registrarSecret];
  },

  // Merkle authentication path for the given event commitment, built off-chain
  // from the CURRENT event tree. The circuit binds this path to the commitment it
  // re-derives from the witness fields, so returning a path for a different (but
  // real) leaf will fail the in-circuit `path.leaf == commitment` check.
  //
  // Returning a well-formed dummy path (rather than throwing) when the commitment
  // is absent lets the contract's own assertions reject the proof with a clear
  // in-circuit error, which is what the "not committed" test exercises. We use the
  // path shape at index 0 as a structurally-valid placeholder.
  getEventPath(
    context: WitnessContext<Ledger, RecallLensPrivateState>,
    commitment: Uint8Array,
  ): [RecallLensPrivateState, MerkleTreePath<Uint8Array>] {
    const path = context.ledger.eventTree.findPathForLeaf(commitment);
    if (!path) {
      return [context.privateState, absentLeafPath(commitment)];
    }
    return [context.privateState, path];
  },

  // Merkle authentication path for the given org commitment, built off-chain from
  // the CURRENT org registry. Same binding/placeholder rationale as getEventPath.
  getOrgPath(
    context: WitnessContext<Ledger, RecallLensPrivateState>,
    orgCommitment: Uint8Array,
  ): [RecallLensPrivateState, MerkleTreePath<Uint8Array>] {
    const path = context.ledger.orgRegistry.findPathForLeaf(orgCommitment);
    if (!path) {
      return [context.privateState, absentLeafPath(orgCommitment)];
    }
    return [context.privateState, path];
  },
};
