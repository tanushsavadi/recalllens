import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCdcOutbreakHtml } from "../src/cdc-parser";
import { getCachedSnapshot, getOutbreak } from "../src/cdc-adapter";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rawHtml = fs.readFileSync(
  path.resolve(__dirname, "..", "fixtures", "cdc-cyclospora-07-26.raw.html"),
  "utf-8",
);

describe("CDC parser (real archived 2026-07-17 page)", () => {
  const parsed = parseCdcOutbreakHtml(rawHtml);

  it("extracts the case count (more than 1,644)", () => {
    expect(parsed.cases).toBe(1644);
  });
  it("extracts 94 hospitalizations", () => {
    expect(parsed.hospitalizations).toBe(94);
  });
  it("extracts 0 deaths", () => {
    expect(parsed.deaths).toBe(0);
  });
  it("extracts the five affected states", () => {
    expect(parsed.states.sort()).toEqual(
      ["Indiana", "Kentucky", "Michigan", "Ohio", "West Virginia"].sort(),
    );
  });
  it("does not spuriously include Virginia", () => {
    expect(parsed.states).not.toContain("Virginia");
  });
  it("extracts investigation status Open", () => {
    expect(parsed.investigationStatus).toBe("Open");
  });
  it("extracts official last-updated date", () => {
    expect(parsed.officialLastUpdated).toBe("July 17, 2026");
  });
  it("captures the title mentioning shredded iceberg lettuce and Taco Bell", () => {
    expect(parsed.title.toLowerCase()).toContain("shredded iceberg lettuce");
    expect(parsed.title.toLowerCase()).toContain("taco bell");
  });
  it("throws loudly if a required fact is missing", () => {
    expect(() => parseCdcOutbreakHtml("<html><body>nope</body></html>")).toThrow();
  });
});

describe("cached snapshot", () => {
  it("validates against the schema and matches parsed facts", () => {
    const snap = getCachedSnapshot();
    expect(snap.source).toBe("cached-snapshot");
    expect(snap.outbreak.cases).toBe(1644);
    expect(snap.outbreak.hospitalizations).toBe(94);
    expect(snap.contentSha256).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("getOutbreak live-or-cached", () => {
  it("falls back to cached snapshot when the live fetch fails (403)", async () => {
    const res = await getOutbreak({
      fetchImpl: (async () =>
        new Response("Access Denied", { status: 403 })) as unknown as typeof fetch,
    });
    expect(res.live).toBe(false);
    expect(res.liveError).toContain("403");
    expect(res.snapshot.outbreak.cases).toBe(1644);
    expect(res.snapshot.source).toBe("cached-snapshot");
  });

  it("uses live data when the fetch succeeds", async () => {
    const res = await getOutbreak({
      fetchImpl: (async () =>
        new Response(rawHtml, { status: 200 })) as unknown as typeof fetch,
      now: () => new Date("2026-07-18T08:00:00Z"),
    });
    expect(res.live).toBe(true);
    expect(res.snapshot.source).toBe("cdc-page");
    expect(res.snapshot.outbreak.cases).toBe(1644);
    expect(res.snapshot.retrievedAt).toBe("2026-07-18T08:00:00.000Z");
  });
});
