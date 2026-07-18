import { describe, it, expect } from "vitest";
import {
  Organization,
  TraceEvent,
  ConsumerReceipt,
} from "@recalllens/schemas";
import {
  organizations,
  allEvents,
  affectedEvents,
  cleanEvents,
  receipts,
  computeRecallImpact,
  AFFECTED_LINEAGE_TOKEN,
  CLEAN_LINEAGE_TOKEN,
} from "../src/index";

describe("synthetic fixtures validate against schemas", () => {
  it("every org validates and is marked synthetic", () => {
    for (const o of organizations) {
      expect(() => Organization.parse(o)).not.toThrow();
      expect(o.synthetic).toBe(true);
    }
  });

  it("every trace event validates", () => {
    for (const e of allEvents) {
      expect(() => TraceEvent.parse(e)).not.toThrow();
    }
  });

  it("every receipt validates and is marked synthetic", () => {
    for (const r of receipts) {
      expect(() => ConsumerReceipt.parse(r)).not.toThrow();
      expect(r.synthetic).toBe(true);
    }
  });

  it("affected events all carry the shared affected lineage token", () => {
    for (const e of Object.values(affectedEvents)) {
      expect(e.lineageToken).toBe(AFFECTED_LINEAGE_TOKEN);
    }
  });

  it("clean events carry the unrelated lineage token", () => {
    for (const e of Object.values(cleanEvents)) {
      expect(e.lineageToken).toBe(CLEAN_LINEAGE_TOKEN);
    }
  });
});

describe("recall-impact is derived from fixtures, not hardcoded", () => {
  const impact = computeRecallImpact(AFFECTED_LINEAGE_TOKEN);

  it("targeted scope is a strict subset of broad scope", () => {
    expect(impact.targeted.cases).toBeLessThan(impact.broad.cases);
    expect(impact.targeted.stores).toBeLessThan(impact.broad.stores);
  });

  it("targeted states are exactly the 5 outbreak states", () => {
    expect(impact.targeted.states.sort()).toEqual(
      ["IN", "KY", "MI", "OH", "WV"].sort(),
    );
  });

  it("reduction percentage is positive and under 100", () => {
    expect(impact.reductionPct).toBeGreaterThan(0);
    expect(impact.reductionPct).toBeLessThan(100);
  });
});
