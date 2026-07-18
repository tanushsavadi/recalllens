import { describe, it, expect } from "vitest";
import { FallbackBackend } from "../src/fallback-backend";
import { DEMO_CASE_ID, organizations, affectedEvents } from "@recalllens/demo-fixtures";

describe("FallbackBackend distinct-org convergence", () => {
  it("starts at the seeded 2/3 state and converges when the third org proves", async () => {
    const b = new FallbackBackend(() => new Date("2026-07-18T09:00:00Z"));
    const orgs = organizations
      .filter((o) => affectedEvents[o.orgId])
      .slice(0, 3);

    // Mirrors the live seeded demo: two proofs pre-submitted.
    let chain = await b.getCaseState(DEMO_CASE_ID);
    expect(chain.matchCount).toBe(2);
    expect(chain.converged).toBe(false);
    expect(chain.nullifiers.length).toBe(2);

    const res = await b.submitProof(DEMO_CASE_ID, orgs[2].orgId);
    expect(res.chain.matchCount).toBe(3);
    expect(res.proof.stage).toBe("confirmed");

    chain = await b.getCaseState(DEMO_CASE_ID);
    expect(chain.converged).toBe(true);
    expect(new Set(chain.nullifiers).size).toBe(3);

    // Duplicate submission from an already-counted org must be rejected.
    await expect(b.submitProof(DEMO_CASE_ID, orgs[0].orgId)).rejects.toThrow(
      /already counted/i,
    );
  });

  it("reports deterministic-fallback mode and no txId for live submissions", async () => {
    const b = new FallbackBackend(() => new Date("2026-07-18T09:00:00Z"));
    expect(b.mode).toBe("deterministic-fallback");
    const third = organizations.filter((o) => affectedEvents[o.orgId])[2];
    const { proof } = await b.submitProof(DEMO_CASE_ID, third.orgId);
    expect(proof.txId).toBeNull();
  });

  it("reset restores the deterministic 2/3 state", async () => {
    const b = new FallbackBackend(() => new Date("2026-07-18T09:00:00Z"));
    const third = organizations.filter((o) => affectedEvents[o.orgId])[2];
    await b.submitProof(DEMO_CASE_ID, third.orgId);
    expect((await b.getCaseState(DEMO_CASE_ID)).converged).toBe(true);
    await b.reset(DEMO_CASE_ID);
    const chain = await b.getCaseState(DEMO_CASE_ID);
    expect(chain.matchCount).toBe(2);
    expect(chain.converged).toBe(false);
  });
});
