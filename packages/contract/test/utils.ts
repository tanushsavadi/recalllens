// Test fixtures + helpers.
//
// All commitments/tags/nullifiers are computed via the contract's `pureCircuits`
// exports — the SAME derivations the circuit runs — so tests assert real hash
// parity between off-chain and in-circuit computation rather than re-implementing
// hashes in JS.

import {
  pureCircuits,
  type SafetySignal,
  type TraceEvent,
} from "../src/managed/recalllens/contract/index.js";
import {
  createRecallLensPrivateState,
  type RecallLensPrivateState,
} from "../src/witnesses.js";

/** Deterministic 32-byte value from a label (fills the buffer, not just a prefix). */
export function bytes32(label: string): Uint8Array {
  const out = new Uint8Array(32);
  const enc = new TextEncoder().encode(label);
  for (let i = 0; i < 32; i++) {
    // Mix label bytes with the index so distinct labels give distinct buffers
    // and every byte is populated (avoids trivially-colliding sparse buffers).
    out[i] = (enc[i % enc.length] ?? 0) ^ ((i * 31 + 7) & 0xff);
  }
  return out;
}

/** Build a TraceEvent from parts. */
export function makeEvent(
  lineageToken: Uint8Array,
  productHash: Uint8Array,
  eventTime: bigint,
  blinding: Uint8Array,
): TraceEvent {
  return { lineageToken, productHash, eventTime, blinding };
}

/** Client-side event commitment — identical to the in-circuit derivation. */
export function eventCommitment(ev: TraceEvent): Uint8Array {
  return pureCircuits.deriveEventCommitment(
    ev.lineageToken,
    ev.productHash,
    ev.eventTime,
    ev.blinding,
  );
}

/** Client-side org commitment — identical to the in-circuit derivation. */
export function orgCommitment(orgSecret: Uint8Array): Uint8Array {
  return pureCircuits.deriveOrgCommitment(orgSecret);
}

/** Client-side case tag — identical to the in-circuit derivation. */
export function caseTag(caseId: Uint8Array, lineageToken: Uint8Array): Uint8Array {
  return pureCircuits.deriveCaseTag(caseId, lineageToken);
}

/** Client-side org nullifier — identical to the in-circuit derivation. */
export function orgNullifier(caseId: Uint8Array, orgSecret: Uint8Array): Uint8Array {
  return pureCircuits.deriveOrgNullifier(caseId, orgSecret);
}

/** Client-side registrar commitment — identical to the in-circuit derivation. */
export function registrarCommitment(registrarSecret: Uint8Array): Uint8Array {
  return pureCircuits.deriveRegistrarCommitment(registrarSecret);
}

/** Assemble a prover private state (org secret + held event). The registrar
 * secret defaults to a zero placeholder — proveRelevantEvent never reads it. */
export function proverState(
  orgSecret: Uint8Array,
  ev: TraceEvent,
): RecallLensPrivateState {
  return createRecallLensPrivateState(orgSecret, ev);
}

// --- SENTINEL layer helpers -------------------------------------------------

/** Build a SafetySignal from parts. */
export function makeSignal(
  lineageToken: Uint8Array,
  productHash: Uint8Array,
  signalTime: bigint,
  category: bigint,
  blinding: Uint8Array,
): SafetySignal {
  return { lineageToken, productHash, signalTime, category, blinding };
}

/** Client-side signal commitment — identical to the in-circuit derivation. */
export function signalCommitment(sig: SafetySignal): Uint8Array {
  return pureCircuits.deriveSignalCommitment(
    sig.lineageToken,
    sig.productHash,
    sig.signalTime,
    sig.category,
    sig.blinding,
  );
}

/** Client-side sentinel tag — identical to the in-circuit derivation. */
export function sentinelTag(caseId: Uint8Array, lineageToken: Uint8Array): Uint8Array {
  return pureCircuits.deriveSentinelTag(caseId, lineageToken);
}

/** Client-side signal nullifier — identical to the in-circuit derivation. */
export function signalNullifier(caseId: Uint8Array, orgSecret: Uint8Array): Uint8Array {
  return pureCircuits.deriveSignalNullifier(caseId, orgSecret);
}

/** Assemble a signal-prover private state (org secret + held signal). The trace
 * event is a zero placeholder (submitSafetySignal never reads it) and the registrar
 * secret defaults to a zero placeholder (submitSafetySignal never reads it). */
export function signalProverState(
  orgSecret: Uint8Array,
  sig: SafetySignal,
): RecallLensPrivateState {
  const zeroEvent: TraceEvent = {
    lineageToken: new Uint8Array(32),
    productHash: new Uint8Array(32),
    eventTime: 0n,
    blinding: new Uint8Array(32),
  };
  return createRecallLensPrivateState(orgSecret, zeroEvent, undefined, sig);
}

/** Hex compare helper for Uint8Array equality assertions. */
export function toHex(b: Uint8Array): string {
  return Array.from(b)
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
