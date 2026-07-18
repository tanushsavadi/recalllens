import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { searchFoodRecalls } from "../src/openfda-adapter";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sample = fs.readFileSync(
  path.resolve(__dirname, "..", "fixtures", "openfda-lettuce-sample.json"),
  "utf-8",
);

describe("openFDA adapter (stored official response fixture)", () => {
  it("parses a stored openFDA enforcement response", async () => {
    const res = await searchFoodRecalls("product_description:lettuce", 3, {
      fetchImpl: (async () =>
        new Response(sample, { status: 200 })) as unknown as typeof fetch,
    });
    expect(res.results.length).toBeGreaterThan(0);
    expect(res.results[0]).toHaveProperty("recall_number");
    expect(res.results[0]).toHaveProperty("reason_for_recall");
  });

  it("throws on a non-200 response (caller treats as no data)", async () => {
    await expect(
      searchFoodRecalls("x", 1, {
        fetchImpl: (async () =>
          new Response("", { status: 500 })) as unknown as typeof fetch,
      }),
    ).rejects.toThrow();
  });
});
