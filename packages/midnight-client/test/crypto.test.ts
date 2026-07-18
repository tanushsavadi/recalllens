import { describe, it, expect } from "vitest";
import { pureCircuits } from "@recalllens/contract";
import {
  organizations,
  affectedEvents,
  DEMO_CASE,
  AFFECTED_LINEAGE_TOKEN,
} from "@recalllens/demo-fixtures";
import {
  eventCommitment,
  orgCommitment,
  caseTag,
  orgNullifier,
  hexToBytes,
  bytesToHex,
  productHash,
  eventTimeUnix,
} from "../src/crypto";

describe("client crypto ↔ contract pure-circuit parity", () => {
  const org = organizations[0];
  const ev = affectedEvents[org.orgId];

  it("eventCommitment matches deriveEventCommitment", () => {
    const client = eventCommitment(ev);
    const circuit = pureCircuits.deriveEventCommitment(
      hexToBytes(ev.lineageToken),
      productHash(ev.productGtin),
      eventTimeUnix(ev.eventTime),
      hexToBytes(ev.blinding),
    );
    expect(bytesToHex(client)).toBe(bytesToHex(circuit));
    expect(client.length).toBe(32);
  });

  it("orgCommitment matches deriveOrgCommitment", () => {
    expect(bytesToHex(orgCommitment(org))).toBe(
      bytesToHex(pureCircuits.deriveOrgCommitment(hexToBytes(org.orgSecret))),
    );
  });

  it("caseTag matches deriveCaseTag", () => {
    expect(bytesToHex(caseTag(DEMO_CASE.caseId, AFFECTED_LINEAGE_TOKEN))).toBe(
      bytesToHex(
        pureCircuits.deriveCaseTag(
          hexToBytes(DEMO_CASE.caseId),
          hexToBytes(AFFECTED_LINEAGE_TOKEN),
        ),
      ),
    );
  });

  it("orgNullifier matches deriveOrgNullifier and is distinct per org", () => {
    const n0 = bytesToHex(orgNullifier(DEMO_CASE.caseId, organizations[0].orgSecret));
    const n1 = bytesToHex(orgNullifier(DEMO_CASE.caseId, organizations[1].orgSecret));
    expect(n0).not.toBe(n1);
    expect(n0).toBe(
      bytesToHex(
        pureCircuits.deriveOrgNullifier(
          hexToBytes(DEMO_CASE.caseId),
          hexToBytes(organizations[0].orgSecret),
        ),
      ),
    );
  });

  it("all affected orgs share the same caseTag (same lineage)", () => {
    const tags = Object.values(affectedEvents).map((e) =>
      bytesToHex(caseTag(DEMO_CASE.caseId, e.lineageToken)),
    );
    expect(new Set(tags).size).toBe(1);
  });
});
