import { describe, it, expect } from "vitest";
import { FallbackBackend } from "../src/fallback-backend";
import { DEMO_CASE_ID, organizations, affectedEvents } from "@recalllens/demo-fixtures";

describe("FallbackBackend distinct-org convergence", () => {
  it("reaches convergence with 3 distinct orgs and rejects duplicates", async () => {
    const b = new FallbackBackend(() => new Date("2026-07-18T09:00:00Z"));
    const orgs = organizations
      .filter((o) => affectedEvents[o.orgId])
      .slice(0, 3);

    let chain = await b.getCaseState(DEMO_CASE_ID);
    expect(chain.matchCount).toBe(0);
    expect(chain.converged).toBe(false);

    for (let i = 0; i < orgs.length; i++) {
      const res = await b.submitProof(DEMO_CASE_ID, orgs[i].orgId);
      expect(res.chain.matchCount).toBe(i + 1);
      expect(res.proof.stage).toBe("confirmed");
    }

    chain = await b.getCaseState(DEMO_CASE_ID);
    expect(chain.matchCount).toBe(3);
    expect(chain.converged).toBe(true);
    expect(chain.nullifiers.length).toBe(3);
    expect(new Set(chain.nullifiers).size).toBe(3);

    // Duplicate submission from an already-counted org must be rejected.
    await expect(b.submitProof(DEMO_CASE_ID, orgs[0].orgId)).rejects.toThrow(
      /already counted/i,
    );
  });

  it("reports deterministic-fallback mode and no txId", async () => {
    const b = new FallbackBackend(() => new Date("2026-07-18T09:00:00Z"));
    expect(b.mode).toBe("deterministic-fallback");
    const org = organizations.filter((o) => affectedEvents[o.orgId])[0];
    const { proof } = await b.submitProof(DEMO_CASE_ID, org.orgId);
    expect(proof.txId).toBeNull();
  });
});
