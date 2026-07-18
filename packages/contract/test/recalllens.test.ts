// RecallLens simulator tests.
//
// Exercises the full RecallLens flow against the compiled contract via the
// compact-runtime simulator. Each test builds a fresh simulator so state never
// leaks between tests.
//
// The 8 required scenarios from the brief are covered, plus the registrar
// admission gate (correct + wrong registrar secret) and a hash-parity /
// determinism check for the exported pure circuits (client/circuit parity).

import { describe, it, expect, beforeEach } from "vitest";
import { RecallLensSimulator } from "./simulator.js";
import {
  bytes32,
  makeEvent,
  eventCommitment,
  orgCommitment,
  caseTag,
  orgNullifier,
  registrarCommitment,
  proverState,
  toHex,
} from "./utils.js";

const THRESHOLD = 3n;

// The registrar credential — held only by the deployer. Its commitment is pinned
// at deploy; the secret gates registerOrganization / openCase / closeCase.
const REGISTRAR_SECRET = bytes32("registrar:recalllens:coordinator");
const REGISTRAR_COMMITMENT = registrarCommitment(REGISTRAR_SECRET);
const WRONG_REGISTRAR_SECRET = bytes32("attacker:not-the-registrar");

// Shared case parameters.
const CASE_ID = bytes32("case:romaine-2026");
const SOURCE_HASH = bytes32("cdc:snapshot:v1");
const PRODUCT = bytes32("product:romaine-lettuce");
const WINDOW_START = 1_700_000_000n;
const WINDOW_END = 1_700_600_000n;
const EVENT_TIME = 1_700_300_000n; // inside the window

// A shared lineage token — the hidden value convergence detects.
const LINEAGE = bytes32("lineage:farm-A-lot-42");

/** Stand up a simulator deployed with the registrar commitment. */
function newSim(): RecallLensSimulator {
  return new RecallLensSimulator(THRESHOLD, REGISTRAR_COMMITMENT);
}

// Helper: stand up a simulator with one registered org, one committed event, and
// an open case. Returns the pieces a test needs.
function freshWorld() {
  const sim = newSim();

  const orgSecret = bytes32("org:acme-distributors:secret");
  sim.registerOrganization(orgCommitment(orgSecret), REGISTRAR_SECRET);

  const ev = makeEvent(LINEAGE, PRODUCT, EVENT_TIME, bytes32("blind:1"));
  sim.commitTraceEvent(eventCommitment(ev));

  sim.openCase(CASE_ID, SOURCE_HASH, PRODUCT, WINDOW_START, WINDOW_END, REGISTRAR_SECRET);

  return { sim, orgSecret, ev };
}

describe("RecallLens pure circuits (client/circuit hash parity)", () => {
  it("derivations are deterministic and domain-separated", () => {
    const ev = makeEvent(LINEAGE, PRODUCT, EVENT_TIME, bytes32("blind:x"));

    // Determinism: same inputs => same output.
    expect(toHex(eventCommitment(ev))).toEqual(toHex(eventCommitment(ev)));
    expect(toHex(orgCommitment(bytes32("s")))).toEqual(
      toHex(orgCommitment(bytes32("s"))),
    );
    expect(toHex(caseTag(CASE_ID, LINEAGE))).toEqual(
      toHex(caseTag(CASE_ID, LINEAGE)),
    );
    expect(toHex(orgNullifier(CASE_ID, bytes32("s")))).toEqual(
      toHex(orgNullifier(CASE_ID, bytes32("s"))),
    );
    expect(toHex(registrarCommitment(REGISTRAR_SECRET))).toEqual(
      toHex(registrarCommitment(REGISTRAR_SECRET)),
    );

    // Outputs are 32 bytes.
    expect(eventCommitment(ev).length).toBe(32);
    expect(orgNullifier(CASE_ID, bytes32("s")).length).toBe(32);
    expect(registrarCommitment(REGISTRAR_SECRET).length).toBe(32);

    // Domain separation: a caseTag over (caseId, lineage) must differ from a
    // nullifier over (caseId, lineage-as-secret) even with identical byte inputs.
    expect(toHex(caseTag(CASE_ID, LINEAGE))).not.toEqual(
      toHex(orgNullifier(CASE_ID, LINEAGE)),
    );

    // Different lineage => different tag.
    expect(toHex(caseTag(CASE_ID, LINEAGE))).not.toEqual(
      toHex(caseTag(CASE_ID, bytes32("other-lineage"))),
    );

    // Registrar commitment is domain-separated from an org commitment over the
    // same secret bytes.
    expect(toHex(registrarCommitment(REGISTRAR_SECRET))).not.toEqual(
      toHex(orgCommitment(REGISTRAR_SECRET)),
    );
  });
});

describe("Registrar admission gate", () => {
  it("registerOrganization with the correct registrar secret succeeds", () => {
    const sim = newSim();
    const orgSecret = bytes32("org:acme:secret");
    sim.registerOrganization(orgCommitment(orgSecret), REGISTRAR_SECRET);
    // Confirm the call did not throw; the deploy-time threshold is intact.
    expect(sim.getLedger().threshold).toBe(THRESHOLD);
  });

  it("registerOrganization with a WRONG registrar secret fails", () => {
    const sim = newSim();
    const orgSecret = bytes32("org:acme:secret");
    expect(() => {
      sim.registerOrganization(orgCommitment(orgSecret), WRONG_REGISTRAR_SECRET);
    }).toThrow(/Not the registrar/);
  });

  it("openCase with a WRONG registrar secret fails", () => {
    const sim = newSim();
    expect(() => {
      sim.openCase(
        CASE_ID,
        SOURCE_HASH,
        PRODUCT,
        WINDOW_START,
        WINDOW_END,
        WRONG_REGISTRAR_SECRET,
      );
    }).toThrow(/Not the registrar/);
  });

  it("closeCase with a WRONG registrar secret fails", () => {
    const { sim } = freshWorld();
    expect(() => {
      sim.closeCase(CASE_ID, WRONG_REGISTRAR_SECRET);
    }).toThrow(/Not the registrar/);
  });
});

describe("1. Happy path", () => {
  it("register + commit + open + prove => matchCount 1 and nullifier present", () => {
    const { sim, orgSecret, ev } = freshWorld();

    sim.proveRelevantEvent(CASE_ID, proverState(orgSecret, ev));

    const l = sim.getLedger();
    const tag = caseTag(CASE_ID, LINEAGE);
    expect(l.matchCount.member(tag)).toBe(true);
    expect(l.matchCount.lookup(tag).read()).toBe(1n);

    // Nullifier recorded.
    expect(l.orgNullifiers.member(orgNullifier(CASE_ID, orgSecret))).toBe(true);

    // Not yet converged (threshold is 3).
    expect(l.converged.member(tag)).toBe(false);
  });
});

describe("2. Tampered event fields", () => {
  it("witness returns event fields that do not match the committed commitment => fails", () => {
    const { sim, orgSecret } = freshWorld();

    // The committed event used LINEAGE/PRODUCT/EVENT_TIME/blind:1. The prover now
    // supplies a DIFFERENT blinding, so the re-derived commitment differs from any
    // committed leaf; the path/leaf binding + checkRoot must reject it.
    const tampered = makeEvent(LINEAGE, PRODUCT, EVENT_TIME, bytes32("blind:TAMPERED"));

    expect(() => {
      sim.proveRelevantEvent(CASE_ID, proverState(orgSecret, tampered));
    }).toThrow(/Event path does not match|not committed in the event tree/);
  });
});

describe("3. Event never committed", () => {
  it("a valid-looking event that was never committed => fails", () => {
    const sim = newSim();
    const orgSecret = bytes32("org:acme:secret");
    sim.registerOrganization(orgCommitment(orgSecret), REGISTRAR_SECRET);
    sim.openCase(CASE_ID, SOURCE_HASH, PRODUCT, WINDOW_START, WINDOW_END, REGISTRAR_SECRET);

    // NOTE: no commitTraceEvent call. The tree is empty.
    const ev = makeEvent(LINEAGE, PRODUCT, EVENT_TIME, bytes32("blind:1"));

    expect(() => {
      sim.proveRelevantEvent(CASE_ID, proverState(orgSecret, ev));
    }).toThrow(/Event path does not match|not committed in the event tree/);
  });
});

describe("4. Wrong predicate", () => {
  it("eventTime before the window => fails", () => {
    const sim = newSim();
    const orgSecret = bytes32("org:acme:secret");
    sim.registerOrganization(orgCommitment(orgSecret), REGISTRAR_SECRET);
    // Commit an event whose time is BEFORE the window.
    const early = makeEvent(LINEAGE, PRODUCT, WINDOW_START - 1n, bytes32("blind:early"));
    sim.commitTraceEvent(eventCommitment(early));
    sim.openCase(CASE_ID, SOURCE_HASH, PRODUCT, WINDOW_START, WINDOW_END, REGISTRAR_SECRET);

    expect(() => {
      sim.proveRelevantEvent(CASE_ID, proverState(orgSecret, early));
    }).toThrow(/before case window/);
  });

  it("eventTime after the window => fails", () => {
    const sim = newSim();
    const orgSecret = bytes32("org:acme:secret");
    sim.registerOrganization(orgCommitment(orgSecret), REGISTRAR_SECRET);
    const late = makeEvent(LINEAGE, PRODUCT, WINDOW_END + 1n, bytes32("blind:late"));
    sim.commitTraceEvent(eventCommitment(late));
    sim.openCase(CASE_ID, SOURCE_HASH, PRODUCT, WINDOW_START, WINDOW_END, REGISTRAR_SECRET);

    expect(() => {
      sim.proveRelevantEvent(CASE_ID, proverState(orgSecret, late));
    }).toThrow(/after case window/);
  });

  it("productHash mismatch => fails", () => {
    const sim = newSim();
    const orgSecret = bytes32("org:acme:secret");
    sim.registerOrganization(orgCommitment(orgSecret), REGISTRAR_SECRET);
    // Event about a DIFFERENT product than the case predicate.
    const wrongProduct = makeEvent(
      LINEAGE,
      bytes32("product:spinach"),
      EVENT_TIME,
      bytes32("blind:wp"),
    );
    sim.commitTraceEvent(eventCommitment(wrongProduct));
    sim.openCase(CASE_ID, SOURCE_HASH, PRODUCT, WINDOW_START, WINDOW_END, REGISTRAR_SECRET);

    expect(() => {
      sim.proveRelevantEvent(CASE_ID, proverState(orgSecret, wrongProduct));
    }).toThrow(/Product predicate mismatch/);
  });
});

describe("5. Duplicate org nullifier", () => {
  it("same org proving twice for the same case => second attempt fails", () => {
    const { sim, orgSecret, ev } = freshWorld();

    // First proof succeeds.
    sim.proveRelevantEvent(CASE_ID, proverState(orgSecret, ev));

    // Second proof by the SAME org (same secret) for the SAME case must fail on
    // the nullifier check.
    expect(() => {
      sim.proveRelevantEvent(CASE_ID, proverState(orgSecret, ev));
    }).toThrow(/already counted for this case/);

    // Count stayed at 1.
    const l = sim.getLedger();
    expect(l.matchCount.lookup(caseTag(CASE_ID, LINEAGE)).read()).toBe(1n);
  });
});

describe("6. Unregistered org", () => {
  it("an org secret with no registered commitment => fails", () => {
    const sim = newSim();
    // Register a DIFFERENT org than the one that will prove.
    sim.registerOrganization(orgCommitment(bytes32("org:registered:secret")), REGISTRAR_SECRET);
    const ev = makeEvent(LINEAGE, PRODUCT, EVENT_TIME, bytes32("blind:1"));
    sim.commitTraceEvent(eventCommitment(ev));
    sim.openCase(CASE_ID, SOURCE_HASH, PRODUCT, WINDOW_START, WINDOW_END, REGISTRAR_SECRET);

    const unregistered = bytes32("org:UNREGISTERED:secret");
    expect(() => {
      sim.proveRelevantEvent(CASE_ID, proverState(unregistered, ev));
    }).toThrow(/Org path does not match|not registered/);
  });
});

describe("7. Unrelated lineage", () => {
  it("a valid proof with a different lineage token yields a DIFFERENT caseTag and does not advance the first tag", () => {
    const sim = newSim();

    // Two orgs, two committed events with DIFFERENT lineage tokens.
    const orgA = bytes32("org:A:secret");
    const orgB = bytes32("org:B:secret");
    sim.registerOrganization(orgCommitment(orgA), REGISTRAR_SECRET);
    sim.registerOrganization(orgCommitment(orgB), REGISTRAR_SECRET);

    const lineage1 = bytes32("lineage:1");
    const lineage2 = bytes32("lineage:2");
    const evA = makeEvent(lineage1, PRODUCT, EVENT_TIME, bytes32("blind:A"));
    const evB = makeEvent(lineage2, PRODUCT, EVENT_TIME, bytes32("blind:B"));
    sim.commitTraceEvent(eventCommitment(evA));
    sim.commitTraceEvent(eventCommitment(evB));

    sim.openCase(CASE_ID, SOURCE_HASH, PRODUCT, WINDOW_START, WINDOW_END, REGISTRAR_SECRET);

    sim.proveRelevantEvent(CASE_ID, proverState(orgA, evA));
    sim.proveRelevantEvent(CASE_ID, proverState(orgB, evB));

    const l = sim.getLedger();
    const tag1 = caseTag(CASE_ID, lineage1);
    const tag2 = caseTag(CASE_ID, lineage2);

    // Distinct tags.
    expect(toHex(tag1)).not.toEqual(toHex(tag2));
    // Each tag counts exactly 1 — the second proof did NOT advance the first tag.
    expect(l.matchCount.lookup(tag1).read()).toBe(1n);
    expect(l.matchCount.lookup(tag2).read()).toBe(1n);
    // Neither converged.
    expect(l.converged.member(tag1)).toBe(false);
    expect(l.converged.member(tag2)).toBe(false);
  });
});

describe("8. Convergence at threshold 3", () => {
  let sim: RecallLensSimulator;
  const org1 = bytes32("org:one:secret");
  const org2 = bytes32("org:two:secret");
  const org3 = bytes32("org:three:secret");
  // Three distinct events (distinct blinding) that SHARE the same lineage token.
  const ev1 = makeEvent(LINEAGE, PRODUCT, EVENT_TIME, bytes32("blind:one"));
  const ev2 = makeEvent(LINEAGE, PRODUCT, EVENT_TIME, bytes32("blind:two"));
  const ev3 = makeEvent(LINEAGE, PRODUCT, EVENT_TIME, bytes32("blind:three"));

  beforeEach(() => {
    sim = newSim();
    sim.registerOrganization(orgCommitment(org1), REGISTRAR_SECRET);
    sim.registerOrganization(orgCommitment(org2), REGISTRAR_SECRET);
    sim.registerOrganization(orgCommitment(org3), REGISTRAR_SECRET);
    sim.commitTraceEvent(eventCommitment(ev1));
    sim.commitTraceEvent(eventCommitment(ev2));
    sim.commitTraceEvent(eventCommitment(ev3));
    sim.openCase(CASE_ID, SOURCE_HASH, PRODUCT, WINDOW_START, WINDOW_END, REGISTRAR_SECRET);
  });

  it("two orgs are NOT enough to converge", () => {
    sim.proveRelevantEvent(CASE_ID, proverState(org1, ev1));
    sim.proveRelevantEvent(CASE_ID, proverState(org2, ev2));

    const l = sim.getLedger();
    const tag = caseTag(CASE_ID, LINEAGE);
    expect(l.matchCount.lookup(tag).read()).toBe(2n);
    expect(l.converged.member(tag)).toBe(false);
  });

  it("three distinct orgs sharing a lineage token => matchCount 3 and converged", () => {
    sim.proveRelevantEvent(CASE_ID, proverState(org1, ev1));
    sim.proveRelevantEvent(CASE_ID, proverState(org2, ev2));
    sim.proveRelevantEvent(CASE_ID, proverState(org3, ev3));

    const l = sim.getLedger();
    const tag = caseTag(CASE_ID, LINEAGE);
    expect(l.matchCount.lookup(tag).read()).toBe(3n);
    expect(l.converged.member(tag)).toBe(true);
    expect(l.converged.lookup(tag)).toBe(true);

    // Three distinct nullifiers recorded.
    expect(l.orgNullifiers.member(orgNullifier(CASE_ID, org1))).toBe(true);
    expect(l.orgNullifiers.member(orgNullifier(CASE_ID, org2))).toBe(true);
    expect(l.orgNullifiers.member(orgNullifier(CASE_ID, org3))).toBe(true);
  });
});
