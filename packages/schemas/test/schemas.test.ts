import { describe, it, expect } from "vitest";
import {
  Hex32,
  TraceEvent,
  OutbreakSnapshot,
  CaseChainState,
  SubmitProofRequest,
} from "../src/index";

describe("schemas", () => {
  it("Hex32 accepts 64 lowercase hex chars and rejects others", () => {
    expect(Hex32.safeParse("a".repeat(64)).success).toBe(true);
    expect(Hex32.safeParse("A".repeat(64)).success).toBe(false); // uppercase
    expect(Hex32.safeParse("a".repeat(63)).success).toBe(false); // wrong length
  });

  it("TraceEvent requires a valid GTIN and hex lineage token", () => {
    const good = {
      eventId: "e1",
      eventType: "ObjectEvent",
      eventTime: "2026-06-11T14:30:00Z",
      bizStep: "harvesting",
      productGtin: "00810099110042",
      productDescription: "lettuce",
      sourceGln: "0810099000017",
      destinationGln: "0810099000024",
      lotCode: "L1",
      quantity: 10,
      lineageToken: "a".repeat(64),
      blinding: "b".repeat(64),
    };
    expect(TraceEvent.safeParse(good).success).toBe(true);
    expect(
      TraceEvent.safeParse({ ...good, productGtin: "abc" }).success,
    ).toBe(false);
    expect(
      TraceEvent.safeParse({ ...good, lineageToken: "xyz" }).success,
    ).toBe(false);
  });

  it("OutbreakSnapshot enforces a content hash and source enum", () => {
    const snap = {
      source: "cached-snapshot",
      sourceUrl: "https://www.cdc.gov/x",
      retrievedAt: "2026-07-18T03:34:30.000Z",
      contentSha256: "a".repeat(64),
      parserVersion: "v1",
      outbreak: {
        title: "t",
        pathogen: "Cyclospora",
        cases: 1644,
        hospitalizations: 94,
        deaths: 0,
        states: ["Ohio"],
        investigationStatus: "Open",
        officialLastUpdated: "July 17, 2026",
        implicatedFood: "lettuce",
      },
    };
    expect(OutbreakSnapshot.safeParse(snap).success).toBe(true);
    expect(
      OutbreakSnapshot.safeParse({ ...snap, source: "bogus" }).success,
    ).toBe(false);
  });

  it("CaseChainState + SubmitProofRequest validate API shapes", () => {
    expect(
      SubmitProofRequest.safeParse({ caseId: "a".repeat(64), orgId: "o1" })
        .success,
    ).toBe(true);
    expect(
      CaseChainState.safeParse({
        contractAddress: "x",
        network: "undeployed",
        caseId: "a".repeat(64),
        caseOpen: true,
        caseTag: null,
        matchCount: 0,
        convergenceThreshold: 3,
        converged: false,
        nullifiers: [],
        eventCommitmentCount: 0,
        registeredOrgCount: 0,
      }).success,
    ).toBe(true);
  });
});
