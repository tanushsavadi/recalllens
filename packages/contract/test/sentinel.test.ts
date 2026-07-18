// RecallLens SENTINEL-layer simulator tests.
//
// Exercises the early-warning "corroborated risk convergence" flow against the
// compiled contract via the compact-runtime simulator: registered orgs submit
// private safety signals (QA / cold-chain / exposure) that bind to a shared hidden
// lineage token; when the fixed demo threshold policy is met the registrar anchors
// a precautionary hold and then authorizes a recall predicate.
//
// The existing outbreak-traceback tests (recalllens.test.ts) are untouched.

import { describe, it, expect } from "vitest";
import { RecallLensSimulator } from "./simulator.js";
import {
  bytes32,
  orgCommitment,
  registrarCommitment,
  makeSignal,
  signalCommitment,
  sentinelTag,
  signalNullifier,
  signalProverState,
  toHex,
} from "./utils.js";

const THRESHOLD = 3n; // outbreak-layer convergence threshold (unused here).

// Category constants (mirror the in-circuit encoding).
const QA = 1n;
const COLD_CHAIN = 2n;
const EXPOSURE = 3n;

const REGISTRAR_SECRET = bytes32("registrar:recalllens:coordinator");
const REGISTRAR_COMMITMENT = registrarCommitment(REGISTRAR_SECRET);
const WRONG_REGISTRAR_SECRET = bytes32("attacker:not-the-registrar");

// Shared Sentinel case parameters.
const CASE_ID = bytes32("sentinel:romaine-2026");
const PRODUCT = bytes32("product:romaine-lettuce");
const WINDOW_START = 1_700_000_000n;
const WINDOW_END = 1_700_600_000n;
const SIGNAL_TIME = 1_700_300_000n; // inside the window

// A shared lineage token — the hidden value corroboration detects.
const LINEAGE = bytes32("lineage:farm-A-lot-42");

// Three independent registered organizations.
const ORG1 = bytes32("org:qa-lab:secret");
const ORG2 = bytes32("org:cold-chain-carrier:secret");
const ORG3 = bytes32("org:clinic-network:secret");

const TAG = sentinelTag(CASE_ID, LINEAGE);

function newSim(): RecallLensSimulator {
  return new RecallLensSimulator(THRESHOLD, REGISTRAR_COMMITMENT);
}

// Stand up a simulator with three registered orgs and one open Sentinel case.
function setupWorld(): RecallLensSimulator {
  const sim = newSim();
  sim.registerOrganization(orgCommitment(ORG1), REGISTRAR_SECRET);
  sim.registerOrganization(orgCommitment(ORG2), REGISTRAR_SECRET);
  sim.registerOrganization(orgCommitment(ORG3), REGISTRAR_SECRET);
  sim.openSentinelCase(CASE_ID, PRODUCT, WINDOW_START, WINDOW_END, REGISTRAR_SECRET);
  return sim;
}

// Commit a signal's opaque commitment into the shared event tree, then submit it.
function commitAndSubmit(
  sim: RecallLensSimulator,
  orgSecret: Uint8Array,
  category: bigint,
  blindingLabel: string,
): void {
  const sig = makeSignal(LINEAGE, PRODUCT, SIGNAL_TIME, category, bytes32(blindingLabel));
  sim.commitTraceEvent(signalCommitment(sig));
  sim.submitSafetySignal(CASE_ID, category, signalProverState(orgSecret, sig));
}

// Drive a full threshold (QA + cold-chain + exposure, 3 distinct orgs).
function reachThreshold(sim: RecallLensSimulator): void {
  commitAndSubmit(sim, ORG1, QA, "blind:qa");
  commitAndSubmit(sim, ORG2, COLD_CHAIN, "blind:cold");
  commitAndSubmit(sim, ORG3, EXPOSURE, "blind:exposure");
}

describe("Sentinel pure circuits (client/circuit hash parity)", () => {
  it("sentinel derivations are deterministic and domain-separated", () => {
    const sig = makeSignal(LINEAGE, PRODUCT, SIGNAL_TIME, QA, bytes32("blind:x"));

    // Determinism.
    expect(toHex(signalCommitment(sig))).toEqual(toHex(signalCommitment(sig)));
    expect(toHex(sentinelTag(CASE_ID, LINEAGE))).toEqual(
      toHex(sentinelTag(CASE_ID, LINEAGE)),
    );
    expect(toHex(signalNullifier(CASE_ID, ORG1))).toEqual(
      toHex(signalNullifier(CASE_ID, ORG1)),
    );

    // 32-byte outputs.
    expect(signalCommitment(sig).length).toBe(32);
    expect(sentinelTag(CASE_ID, LINEAGE).length).toBe(32);
    expect(signalNullifier(CASE_ID, ORG1).length).toBe(32);

    // Domain separation from the outbreak layer: a sentinel tag over
    // (caseId, lineage) differs from a sentinel nullifier over the same bytes.
    expect(toHex(sentinelTag(CASE_ID, LINEAGE))).not.toEqual(
      toHex(signalNullifier(CASE_ID, LINEAGE)),
    );
    // Different lineage => different tag.
    expect(toHex(sentinelTag(CASE_ID, LINEAGE))).not.toEqual(
      toHex(sentinelTag(CASE_ID, bytes32("other-lineage"))),
    );
    // Category is bound into the signal commitment: same fields, different
    // category => different commitment.
    const sigCold = makeSignal(LINEAGE, PRODUCT, SIGNAL_TIME, COLD_CHAIN, bytes32("blind:x"));
    expect(toHex(signalCommitment(sig))).not.toEqual(toHex(signalCommitment(sigCold)));
  });
});

describe("openSentinelCase (registrar-gated)", () => {
  it("opens with the correct registrar secret", () => {
    const sim = newSim();
    sim.openSentinelCase(CASE_ID, PRODUCT, WINDOW_START, WINDOW_END, REGISTRAR_SECRET);
    expect(sim.getLedger().sentinelCases.member(CASE_ID)).toBe(true);
  });

  it("fails with a WRONG registrar secret", () => {
    const sim = newSim();
    expect(() => {
      sim.openSentinelCase(CASE_ID, PRODUCT, WINDOW_START, WINDOW_END, WRONG_REGISTRAR_SECRET);
    }).toThrow(/Not the registrar/);
  });

  it("rejects an invalid window (start after end)", () => {
    const sim = newSim();
    expect(() => {
      sim.openSentinelCase(CASE_ID, PRODUCT, WINDOW_END, WINDOW_START, REGISTRAR_SECRET);
    }).toThrow(/Invalid window/);
  });
});

describe("submitSafetySignal — accumulation", () => {
  it("valid QA signal (category 1) => count 1, tag recorded, nullifier present", () => {
    const sim = setupWorld();
    commitAndSubmit(sim, ORG1, QA, "blind:qa");

    const l = sim.getLedger();
    expect(l.signalCount.member(TAG)).toBe(true);
    expect(l.signalCount.lookup(TAG).read()).toBe(1n);
    expect(l.sentinelQaSeen.member(TAG)).toBe(true);
    expect(l.sentinelNullifiers.member(signalNullifier(CASE_ID, ORG1))).toBe(true);
    // Threshold not reached with a single signal.
    expect(l.sentinelThresholdReached.member(TAG)).toBe(false);
  });

  it("second org cold-chain signal (category 2) => count 2", () => {
    const sim = setupWorld();
    commitAndSubmit(sim, ORG1, QA, "blind:qa");
    commitAndSubmit(sim, ORG2, COLD_CHAIN, "blind:cold");

    const l = sim.getLedger();
    expect(l.signalCount.lookup(TAG).read()).toBe(2n);
    expect(l.sentinelColdSeen.member(TAG)).toBe(true);
    // Two signals / two categories — still short of the 3-signal clause.
    expect(l.sentinelThresholdReached.member(TAG)).toBe(false);
  });

  it("third org exposure signal (category 3) => count 3 AND threshold reached", () => {
    const sim = setupWorld();
    reachThreshold(sim);

    const l = sim.getLedger();
    expect(l.signalCount.lookup(TAG).read()).toBe(3n);
    expect(l.sentinelQaSeen.member(TAG)).toBe(true);
    expect(l.sentinelColdSeen.member(TAG)).toBe(true);
    expect(l.sentinelExposureSeen.member(TAG)).toBe(true);
    expect(l.sentinelThresholdReached.member(TAG)).toBe(true);
    expect(l.sentinelThresholdReached.lookup(TAG)).toBe(true);
    // Three distinct nullifiers recorded.
    expect(l.sentinelNullifiers.member(signalNullifier(CASE_ID, ORG1))).toBe(true);
    expect(l.sentinelNullifiers.member(signalNullifier(CASE_ID, ORG2))).toBe(true);
    expect(l.sentinelNullifiers.member(signalNullifier(CASE_ID, ORG3))).toBe(true);
  });
});

describe("submitSafetySignal — threshold policy edge cases", () => {
  it("3 signals from 3 orgs but NO QA category (2,2,3) => threshold NOT reached", () => {
    const sim = setupWorld();
    commitAndSubmit(sim, ORG1, COLD_CHAIN, "blind:c1");
    commitAndSubmit(sim, ORG2, COLD_CHAIN, "blind:c2");
    commitAndSubmit(sim, ORG3, EXPOSURE, "blind:e3");

    const l = sim.getLedger();
    // 3 signals, diversity 2 (cold + exposure), but no QA => policy fails.
    expect(l.signalCount.lookup(TAG).read()).toBe(3n);
    expect(l.sentinelQaSeen.member(TAG)).toBe(false);
    expect(l.sentinelThresholdReached.member(TAG)).toBe(false);
  });

  it("3 signals from 3 orgs all same category (1,1,1) => diversity<2, NOT reached", () => {
    const sim = setupWorld();
    commitAndSubmit(sim, ORG1, QA, "blind:q1");
    commitAndSubmit(sim, ORG2, QA, "blind:q2");
    commitAndSubmit(sim, ORG3, QA, "blind:q3");

    const l = sim.getLedger();
    // 3 signals, QA present, but only one category => diversity 1 < 2.
    expect(l.signalCount.lookup(TAG).read()).toBe(3n);
    expect(l.sentinelQaSeen.member(TAG)).toBe(true);
    expect(l.sentinelColdSeen.member(TAG)).toBe(false);
    expect(l.sentinelExposureSeen.member(TAG)).toBe(false);
    expect(l.sentinelThresholdReached.member(TAG)).toBe(false);
  });
});

describe("submitSafetySignal — rejections", () => {
  it("tampered signal fields (blinding differs) => in-circuit reject", () => {
    const sim = setupWorld();
    // Commit the honest signal, then submit with a DIFFERENT blinding.
    const honest = makeSignal(LINEAGE, PRODUCT, SIGNAL_TIME, QA, bytes32("blind:honest"));
    sim.commitTraceEvent(signalCommitment(honest));
    const tampered = makeSignal(LINEAGE, PRODUCT, SIGNAL_TIME, QA, bytes32("blind:TAMPERED"));

    expect(() => {
      sim.submitSafetySignal(CASE_ID, QA, signalProverState(ORG1, tampered));
    }).toThrow(/Signal path does not match|not committed in the event tree/);
  });

  it("signal commitment never committed => reject", () => {
    const sim = setupWorld();
    // No commitTraceEvent for this signal — the event tree lacks its leaf.
    const sig = makeSignal(LINEAGE, PRODUCT, SIGNAL_TIME, QA, bytes32("blind:uncommitted"));

    expect(() => {
      sim.submitSafetySignal(CASE_ID, QA, signalProverState(ORG1, sig));
    }).toThrow(/Signal path does not match|not committed in the event tree/);
  });

  it("category public-arg mismatch vs committed category => reject", () => {
    const sim = setupWorld();
    // Committed + witnessed signal is QA (category 1); caller claims category 2.
    const sig = makeSignal(LINEAGE, PRODUCT, SIGNAL_TIME, QA, bytes32("blind:mismatch"));
    sim.commitTraceEvent(signalCommitment(sig));

    expect(() => {
      sim.submitSafetySignal(CASE_ID, COLD_CHAIN, signalProverState(ORG1, sig));
    }).toThrow(/Signal category mismatch/);
  });

  it("category out of range (0 and 4) => reject", () => {
    const sim = setupWorld();
    const sig0 = makeSignal(LINEAGE, PRODUCT, SIGNAL_TIME, 0n, bytes32("blind:cat0"));
    sim.commitTraceEvent(signalCommitment(sig0));
    expect(() => {
      sim.submitSafetySignal(CASE_ID, 0n, signalProverState(ORG1, sig0));
    }).toThrow(/Category out of range/);

    const sig4 = makeSignal(LINEAGE, PRODUCT, SIGNAL_TIME, 4n, bytes32("blind:cat4"));
    sim.commitTraceEvent(signalCommitment(sig4));
    expect(() => {
      sim.submitSafetySignal(CASE_ID, 4n, signalProverState(ORG2, sig4));
    }).toThrow(/Category out of range/);
  });

  it("signal time before the window => reject", () => {
    const sim = setupWorld();
    const early = makeSignal(LINEAGE, PRODUCT, WINDOW_START - 1n, QA, bytes32("blind:early"));
    sim.commitTraceEvent(signalCommitment(early));
    expect(() => {
      sim.submitSafetySignal(CASE_ID, QA, signalProverState(ORG1, early));
    }).toThrow(/before case window/);
  });

  it("signal time after the window => reject", () => {
    const sim = setupWorld();
    const late = makeSignal(LINEAGE, PRODUCT, WINDOW_END + 1n, QA, bytes32("blind:late"));
    sim.commitTraceEvent(signalCommitment(late));
    expect(() => {
      sim.submitSafetySignal(CASE_ID, QA, signalProverState(ORG1, late));
    }).toThrow(/after case window/);
  });

  it("product predicate mismatch => reject", () => {
    const sim = setupWorld();
    const wrongProduct = makeSignal(
      LINEAGE,
      bytes32("product:spinach"),
      SIGNAL_TIME,
      QA,
      bytes32("blind:wp"),
    );
    sim.commitTraceEvent(signalCommitment(wrongProduct));
    expect(() => {
      sim.submitSafetySignal(CASE_ID, QA, signalProverState(ORG1, wrongProduct));
    }).toThrow(/Product predicate mismatch/);
  });

  it("duplicate org (same org, second signal, any category) => nullifier reject", () => {
    const sim = setupWorld();
    commitAndSubmit(sim, ORG1, QA, "blind:first");

    // Same org submits a SECOND signal (different category) for the same case.
    const second = makeSignal(LINEAGE, PRODUCT, SIGNAL_TIME, COLD_CHAIN, bytes32("blind:second"));
    sim.commitTraceEvent(signalCommitment(second));
    expect(() => {
      sim.submitSafetySignal(CASE_ID, COLD_CHAIN, signalProverState(ORG1, second));
    }).toThrow(/already submitted a signal for this case/);

    // Count stayed at 1.
    expect(sim.getLedger().signalCount.lookup(TAG).read()).toBe(1n);
  });

  it("unregistered org => reject", () => {
    const sim = setupWorld();
    const unregistered = bytes32("org:UNREGISTERED:secret");
    const sig = makeSignal(LINEAGE, PRODUCT, SIGNAL_TIME, QA, bytes32("blind:unreg"));
    sim.commitTraceEvent(signalCommitment(sig));
    expect(() => {
      sim.submitSafetySignal(CASE_ID, QA, signalProverState(unregistered, sig));
    }).toThrow(/Org path does not match|not registered/);
  });

  it("unknown sentinel case => reject", () => {
    const sim = newSim();
    sim.registerOrganization(orgCommitment(ORG1), REGISTRAR_SECRET);
    // No openSentinelCase call.
    const sig = makeSignal(LINEAGE, PRODUCT, SIGNAL_TIME, QA, bytes32("blind:nocase"));
    sim.commitTraceEvent(signalCommitment(sig));
    expect(() => {
      sim.submitSafetySignal(CASE_ID, QA, signalProverState(ORG1, sig));
    }).toThrow(/Unknown sentinel case/);
  });
});

describe("submitSafetySignal — unrelated lineage", () => {
  it("a signal with a different lineage yields a DIFFERENT tag and does not advance the first", () => {
    const sim = setupWorld();
    commitAndSubmit(sim, ORG1, QA, "blind:qa"); // advances TAG (LINEAGE)

    // A second org submits on a DIFFERENT lineage.
    const otherLineage = bytes32("lineage:unrelated");
    const otherTag = sentinelTag(CASE_ID, otherLineage);
    const sig2 = makeSignal(otherLineage, PRODUCT, SIGNAL_TIME, COLD_CHAIN, bytes32("blind:other"));
    sim.commitTraceEvent(signalCommitment(sig2));
    sim.submitSafetySignal(CASE_ID, COLD_CHAIN, signalProverState(ORG2, sig2));

    const l = sim.getLedger();
    expect(toHex(TAG)).not.toEqual(toHex(otherTag));
    // Each tag counts exactly 1; the second proof did NOT advance the first tag.
    expect(l.signalCount.lookup(TAG).read()).toBe(1n);
    expect(l.signalCount.lookup(otherTag).read()).toBe(1n);
    expect(l.sentinelThresholdReached.member(TAG)).toBe(false);
    expect(l.sentinelThresholdReached.member(otherTag)).toBe(false);
  });
});

describe("issuePrecautionaryHold (registrar-gated)", () => {
  const HOLD_COMMITMENT = bytes32("hold:passport-set-merkle-root");

  it("fails before the threshold is reached", () => {
    const sim = setupWorld();
    commitAndSubmit(sim, ORG1, QA, "blind:qa"); // one signal only

    expect(() => {
      sim.issuePrecautionaryHold(CASE_ID, TAG, HOLD_COMMITMENT, REGISTRAR_SECRET);
    }).toThrow(/threshold not reached/);
    expect(sim.getLedger().holds.member(CASE_ID)).toBe(false);
  });

  it("fails with a WRONG registrar secret even after threshold", () => {
    const sim = setupWorld();
    reachThreshold(sim);

    expect(() => {
      sim.issuePrecautionaryHold(CASE_ID, TAG, HOLD_COMMITMENT, WRONG_REGISTRAR_SECRET);
    }).toThrow(/Not the registrar/);
    expect(sim.getLedger().holds.member(CASE_ID)).toBe(false);
  });

  it("records the hold once the threshold is reached", () => {
    const sim = setupWorld();
    reachThreshold(sim);

    sim.issuePrecautionaryHold(CASE_ID, TAG, HOLD_COMMITMENT, REGISTRAR_SECRET);

    const l = sim.getLedger();
    expect(l.holds.member(CASE_ID)).toBe(true);
    expect(toHex(l.holds.lookup(CASE_ID))).toEqual(toHex(HOLD_COMMITMENT));
  });

  it("rejects a second hold for the same case", () => {
    const sim = setupWorld();
    reachThreshold(sim);
    sim.issuePrecautionaryHold(CASE_ID, TAG, HOLD_COMMITMENT, REGISTRAR_SECRET);

    expect(() => {
      sim.issuePrecautionaryHold(CASE_ID, TAG, bytes32("hold:again"), REGISTRAR_SECRET);
    }).toThrow(/Hold already issued/);
  });
});

describe("authorizeRecallPredicate (registrar-gated)", () => {
  const HOLD_COMMITMENT = bytes32("hold:passport-set-merkle-root");
  const PREDICATE = bytes32("recall:predicate:romaine-lot-42");

  it("fails when no precautionary hold exists", () => {
    const sim = setupWorld();
    reachThreshold(sim);
    // Threshold reached but NO hold issued yet.
    expect(() => {
      sim.authorizeRecallPredicate(CASE_ID, PREDICATE, REGISTRAR_SECRET);
    }).toThrow(/No precautionary hold exists/);
  });

  it("fails with a WRONG registrar secret", () => {
    const sim = setupWorld();
    reachThreshold(sim);
    sim.issuePrecautionaryHold(CASE_ID, TAG, HOLD_COMMITMENT, REGISTRAR_SECRET);
    expect(() => {
      sim.authorizeRecallPredicate(CASE_ID, PREDICATE, WRONG_REGISTRAR_SECRET);
    }).toThrow(/Not the registrar/);
  });

  it("records the predicate once a hold exists", () => {
    const sim = setupWorld();
    reachThreshold(sim);
    sim.issuePrecautionaryHold(CASE_ID, TAG, HOLD_COMMITMENT, REGISTRAR_SECRET);

    sim.authorizeRecallPredicate(CASE_ID, PREDICATE, REGISTRAR_SECRET);

    const l = sim.getLedger();
    expect(l.recallAuthorizations.member(CASE_ID)).toBe(true);
    expect(toHex(l.recallAuthorizations.lookup(CASE_ID))).toEqual(toHex(PREDICATE));
  });
});
