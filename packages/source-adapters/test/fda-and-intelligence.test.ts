import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { parseFdaAdvisoryHtml } from "../src/fda-parser";
import { getFdaAdvisory } from "../src/fda-adapter";
import { classifyScan, type NetworkEvidence } from "../src/recall-intelligence";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.resolve(__dirname, "..", "fixtures");
const blueberriesHtml = fs.readFileSync(
  path.join(fixtures, "fda-blueberries-07-26.raw.html"),
  "utf-8",
);
const lettuceHtml = fs.readFileSync(
  path.join(fixtures, "fda-lettuce-07-26.raw.html"),
  "utf-8",
);

const NO_NETWORK: NetworkEvidence = {
  holdMember: false,
  holdTxId: null,
  recallAuthorized: false,
  recallTxId: null,
  network: null,
  live: false,
};

const cachedAdvisory = () =>
  getFdaAdvisory("blueberries", {
    fetchImpl: (async () => new Response("", { status: 403 })) as unknown as typeof fetch,
  });

describe("FDA advisory parser (real archived 2026-07 markup)", () => {
  it("extracts blueberries recall identifiers", () => {
    const a = parseFdaAdvisoryHtml(blueberriesHtml);
    expect(a.recall.brand).toBe("GreenWise");
    expect(a.recall.lotCode).toBe("60401");
    expect(a.recall.bestByDate).toMatch(/February 9,? 2028/);
    expect(a.recall.packageSize).toMatch(/10.?oz/i);
    expect(a.recall.recallingFirm).toMatch(/Frutas y Hortalizas/);
    expect(a.recall.distributionStates.sort()).toEqual(
      ["AL", "FL", "GA", "KY", "NC", "SC", "TN", "VA"].sort(),
    );
    expect(a.status).toBe("Ongoing");
    expect(a.totalIllnesses).toBe(12);
    expect(a.hospitalizations).toBe(4);
    expect(a.deaths).toBe(0);
    expect(a.lastUpdated).toContain("2026-07-06");
  });

  it("extracts lettuce advisory facts", () => {
    const a = parseFdaAdvisoryHtml(lettuceHtml);
    expect(a.productDescription.toLowerCase()).toContain("iceberg lettuce");
    expect(a.recall.recallingFirm).toBe("Taylor Farms de Mexico");
    expect(a.status).toBe("Ongoing");
    expect(a.totalIllnesses).toBe(1644);
    expect(a.lastUpdated).toContain("2026-07-17");
  });

  it("falls back to the cached snapshot when live fetch fails", async () => {
    const res = await cachedAdvisory();
    expect(res.live).toBe(false);
    expect(res.liveError).toBeTruthy();
    expect(res.advisory.recall.lotCode).toBe("60401");
  });
});

describe("Recall Intelligence classifier", () => {
  it("EXACT_OFFICIAL_RECALL_MATCH: blueberries card (name+lot+date)", async () => {
    const r = await classifyScan(
      {
        productName: "GreenWise Organic IQF Frozen Blueberries",
        lot: "60401",
        expiry: "2028-02-09",
        gtin: "00000000000000",
      },
      NO_NETWORK,
      { fetchAdvisory: cachedAdvisory },
    );
    expect(r.level).toBe("EXACT_OFFICIAL_RECALL_MATCH");
    expect(r.headline).toBe("EXACT OFFICIAL RECALL MATCH");
    expect(r.source?.kind).toBe("official");
    expect(r.fieldsMatched.map((f) => f.field)).toContain("lot");
    expect(r.midnightInvolved).toBe(false);
  });

  it("POSSIBLE_ADVISORY_MATCH: brand matches but lot differs", async () => {
    const r = await classifyScan(
      { productName: "GreenWise frozen blueberries", lot: "99999" },
      NO_NETWORK,
      { fetchAdvisory: cachedAdvisory },
    );
    expect(r.level).toBe("POSSIBLE_ADVISORY_MATCH");
    expect(r.headline).toBe("POSSIBLE MATCH—VERIFY LOT");
  });

  it("NO_VERIFIED_MATCH: unrelated product, includes safety caveat", async () => {
    const r = await classifyScan(
      { gtin: "00012345678905", lot: "ABC123", productName: "Random Cereal" },
      NO_NETWORK,
      { fetchAdvisory: cachedAdvisory },
    );
    expect(r.level).toBe("NO_VERIFIED_MATCH");
    expect(r.explanation).toContain("not a guarantee that the product is safe");
  });

  it("INSUFFICIENT_DATA: no identifiers", async () => {
    const r = await classifyScan({}, NO_NETWORK, { fetchAdvisory: cachedAdvisory });
    expect(r.level).toBe("INSUFFICIENT_DATA");
  });

  it("PROOF_VERIFIED_PRECAUTIONARY_HOLD: valid passport in an active hold", async () => {
    const r = await classifyScan(
      {
        gtin: "00810099110042",
        lot: "NFP-SHRED-26164-07",
        passport: { valid: true, issuer: "rl-demo", passportId: "a".repeat(64), tampered: false },
      },
      { ...NO_NETWORK, holdMember: true, holdTxId: "00abc", network: "undeployed", live: true },
      { fetchAdvisory: cachedAdvisory },
    );
    expect(r.level).toBe("PROOF_VERIFIED_PRECAUTIONARY_HOLD");
    expect(r.explanation).toContain("not yet an official government recall");
    expect(r.midnightInvolved).toBe(true);
    expect(r.syntheticData).toBe(true);
  });

  it("AUTHORIZED_RECALL_MATCH outranks hold, never claims FDA", async () => {
    const r = await classifyScan(
      {
        gtin: "00810099110042",
        lot: "NFP-SHRED-26164-07",
        passport: { valid: true, issuer: "rl-demo", passportId: "b".repeat(64), tampered: false },
      },
      {
        holdMember: true,
        holdTxId: "00abc",
        recallAuthorized: true,
        recallTxId: "00def",
        network: "undeployed",
        live: true,
      },
      { fetchAdvisory: cachedAdvisory },
    );
    expect(r.level).toBe("AUTHORIZED_RECALL_MATCH");
    expect(r.headline).toBe("AFFECTED PRODUCT CONFIRMED");
    expect(r.explanation).toContain("not an FDA recall");
  });

  it("exact OFFICIAL match outranks network evidence", async () => {
    const r = await classifyScan(
      {
        productName: "GreenWise Organic Frozen Blueberries",
        lot: "60401",
        passport: { valid: true, issuer: "rl-demo", passportId: "c".repeat(64), tampered: false },
      },
      { ...NO_NETWORK, holdMember: true, recallAuthorized: true, live: true, network: "undeployed" },
      { fetchAdvisory: cachedAdvisory },
    );
    expect(r.level).toBe("EXACT_OFFICIAL_RECALL_MATCH");
  });

  it("tampered passport surfaces signature failure", async () => {
    const r = await classifyScan(
      {
        gtin: "00810099110042",
        lot: "X",
        passport: { valid: false, issuer: "rl-demo", passportId: "d".repeat(64), tampered: true },
      },
      NO_NETWORK,
      { fetchAdvisory: cachedAdvisory },
    );
    expect(r.headline).toBe("PASSPORT SIGNATURE INVALID");
  });
});
