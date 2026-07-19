import { test, expect } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const CASE_ID =
  "cdc07260cc10ee5511223344556677889900aabbccddeeff0011223344556677";
const API = "http://127.0.0.1:8787/api";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Printed passport card images (QR payloads are deterministic passports).
 * These live in the locally regenerated demo-evidence set (gitignored); the
 * upload-isolation tests skip with a clear message when it is absent. */
const IMG_A = path.resolve(__dirname, "../../demo-evidence/workflow/04-passport-a-card.png");
const IMG_B = path.resolve(__dirname, "../../demo-evidence/workflow/05-passport-b-card.png");
const labelImagesPresent = fs.existsSync(IMG_A) && fs.existsSync(IMG_B);

test.beforeEach(async ({ request }) => {
  await request.post(`${API}/case/${CASE_ID}/reset`).catch(() => {});
});

test.describe("consumer recall intelligence", () => {
  test("FDA blueberries test card → EXACT OFFICIAL RECALL MATCH with provenance (no GTIN — never fabricated)", async ({
    page,
  }) => {
    await page.goto("/consumer");
    await page.getByRole("button", { name: /Enter values manually/i }).click();
    // The FDA advisory publishes NO GTIN — the form accepts lot-only entry.
    await page.getByRole("textbox", { name: /Lot \/ batch/i }).fill("60401");
    await page.getByRole("textbox", { name: /Best-by/i }).fill("2028-02-09");
    await page
      .getByRole("textbox", { name: /Product name/i })
      .fill("GreenWise Organic IQF Frozen Blueberries");
    await page.getByRole("button", { name: /Confirm & verify/i }).click();

    await expect(page.getByText("EXACT OFFICIAL RECALL MATCH")).toBeVisible({
      timeout: 20_000,
    });
    // evidence receipt with provenance
    await expect(page.getByText(/Evidence receipt/i)).toBeVisible();
    await expect(page.getByText(/FDA outbreak advisory/i).first()).toBeVisible();
    await expect(page.getByText(/live fetch|cached snapshot/i).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Official source/i })).toBeVisible();
    // no false Midnight claim for an official-source result
    await expect(page.getByText(/Midnight involved/i)).toBeVisible();
    // GTIN absence is honestly stated, never zero-padded into existence
    await expect(page.getByText(/not provided by the FDA advisory/i).first()).toBeVisible();
    await expect(page.getByText("00000000060401")).toHaveCount(0);
  });

  test("cross-scan isolation: FDA card → restart → lettuce passport never inherits blueberry data", async ({
    page,
  }) => {
    await page.goto("/consumer");
    // First scan: FDA blueberries manual entry
    await page.getByRole("button", { name: /Enter values manually/i }).click();
    await page.getByRole("textbox", { name: /Lot \/ batch/i }).fill("60401");
    await page
      .getByRole("textbox", { name: /Product name/i })
      .fill("GreenWise Organic IQF Frozen Blueberries");
    // Restart clears EVERYTHING (fields + product name)
    await page.getByRole("button", { name: /Restart/i }).click();
    await page.getByRole("button", { name: /Enter values manually/i }).click();
    await expect(page.getByRole("textbox", { name: /Lot \/ batch/i })).toHaveValue("");
    await expect(page.getByRole("textbox", { name: /Product name/i })).toHaveValue("");
    // Second scan: lettuce lot → result must contain no blueberry string
    await page.getByRole("textbox", { name: /GTIN/i }).fill("00810099110042");
    await page.getByRole("textbox", { name: /Lot \/ batch/i }).fill("NFP-SHRED-26164-07");
    await page.getByRole("button", { name: /Confirm & verify/i }).click();
    await expect(page.getByText(/Evidence receipt/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/[Bb]lueberr/)).toHaveCount(0);
  });

  test("no-match result uses neutral (non-green) styling + accurate synthetic provenance", async ({
    page,
  }) => {
    await page.goto("/consumer");
    await page.getByRole("button", { name: /Enter values manually/i }).click();
    await page.getByRole("textbox", { name: /GTIN/i }).fill("00012345678905");
    await page.getByRole("textbox", { name: /Lot \/ batch/i }).fill("RANDOM-1");
    await page.getByRole("button", { name: /Confirm & verify/i }).click();
    await expect(page.getByText("NO VERIFIED MATCH FOUND")).toBeVisible({ timeout: 15_000 });
    // per-source coverage is listed in plain language
    await expect(page.getByText(/Sources checked/i).first()).toBeVisible();
    await expect(page.getByText(/RecallLens Midnight-anchored hold/i).first()).toBeVisible();
    await expect(page.getByText(/RecallLens authorized action/i).first()).toBeVisible();
    // manual entry without a passport is honestly non-synthetic input
    await expect(page.getByText(/no RecallLens passport/i)).toBeVisible();
  });

  test("unknown product → NO VERIFIED MATCH + safety caveat", async ({ page }) => {
    await page.goto("/consumer");
    await page.getByRole("button", { name: /Enter values manually/i }).click();
    await page.getByRole("textbox", { name: /GTIN/i }).fill("00012345678905");
    await page.getByRole("textbox", { name: /Lot \/ batch/i }).fill("RANDOM-999");
    await page.getByRole("textbox", { name: /Product name/i }).fill("Random Cereal");
    await page.getByRole("button", { name: /Confirm & verify/i }).click();
    await expect(page.getByText("NO VERIFIED MATCH FOUND")).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText(/not a guarantee that the product is safe/i).first(),
    ).toBeVisible();
  });

  test("brand match without lot → POSSIBLE MATCH—VERIFY LOT", async ({ page }) => {
    await page.goto("/consumer");
    await page.getByRole("button", { name: /Enter values manually/i }).click();
    await page.getByRole("textbox", { name: /Lot \/ batch/i }).fill("99999");
    await page
      .getByRole("textbox", { name: /Product name/i })
      .fill("GreenWise frozen blueberries");
    await page.getByRole("button", { name: /Confirm & verify/i }).click();
    await expect(page.getByText(/POSSIBLE MATCH—VERIFY LOT/i)).toBeVisible({
      timeout: 15_000,
    });
  });

  test("consumer manual entry never triggers a partner proof", async ({ page, request }) => {
    await page.goto("/consumer");
    await page.getByRole("button", { name: /Enter values manually/i }).click();
    await page.getByRole("textbox", { name: /GTIN/i }).fill("00810099110042");
    await page.getByRole("textbox", { name: /Lot \/ batch/i }).fill("NFP-SHRED-26164-07");
    await page.getByRole("button", { name: /Confirm & verify/i }).click();
    // Without a signed passport this is a plain no-match; either way the trace
    // chain must be untouched (matchCount stays at the seeded 2).
    await expect(page.getByText(/Evidence receipt/i)).toBeVisible({ timeout: 15_000 });
    const status = await (await request.get(`${API}/case/${CASE_ID}`)).json();
    expect(status.chain.matchCount).toBeLessThanOrEqual(2);
  });
});

test.describe("cross-scan state isolation (uploaded label images)", () => {
  test("upload A → result → new upload B without Restart: fields fully replaced", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "upload picker flow covered on desktop");
    test.skip(!labelImagesPresent, "demo-evidence/workflow label images not generated locally");
    await page.goto("/consumer");
    await page.locator('input[type="file"]').first().setInputFiles(IMG_A);
    await expect(page.getByRole("textbox", { name: /Lot \/ batch/i })).toHaveValue(
      "NFP-SHRED-26164-07",
      { timeout: 15_000 },
    );
    // add a product name — it must NOT survive into the next scan
    await page.getByRole("textbox", { name: /Product name/i }).fill("Shredded Iceberg Lettuce");
    await page.getByRole("button", { name: /Confirm & verify/i }).click();
    await expect(page.getByText(/Evidence receipt/i)).toBeVisible({ timeout: 15_000 });

    // start a NEW scan (result screen → Scan another product → upload B)
    await page.getByRole("button", { name: /Scan another product/i }).click();
    await page.locator('input[type="file"]').first().setInputFiles(IMG_B);
    await expect(page.getByRole("textbox", { name: /Lot \/ batch/i })).toHaveValue(
      "SVG-ICE-26171-B",
      { timeout: 15_000 },
    );
    // previous scan's product name and passport must be gone
    await expect(page.getByRole("textbox", { name: /Product name/i })).toHaveValue("");
    await page.getByRole("button", { name: /Confirm & verify/i }).click();
    await expect(page.getByText("NO VERIFIED MATCH FOUND")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Lettuce/)).toHaveCount(0);
    // new receipt reflects B's identifiers only
    await expect(page.getByText(/SVG-ICE-26171-B/).first()).toBeVisible();
    await expect(page.getByText(/NFP-SHRED-26164-07/)).toHaveCount(0);
  });

  test("successful scan → invalid upload: error state carries nothing over", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "upload picker flow covered on desktop");
    test.skip(!labelImagesPresent, "demo-evidence/workflow label images not generated locally");
    await page.goto("/consumer");
    await page.locator('input[type="file"]').first().setInputFiles(IMG_A);
    await expect(page.getByRole("textbox", { name: /Lot \/ batch/i })).toHaveValue(
      "NFP-SHRED-26164-07",
      { timeout: 15_000 },
    );
    // restart, then upload a non-label image (the playwright favicon-sized png)
    await page.getByRole("button", { name: /Restart/i }).click();
    await page.locator('input[type="file"]').first().setInputFiles({
      name: "not-a-label.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAF0lEQVR4nGP8//8/AzGAiShVowoJAgCCTgMBrKqRIQAAAABJRU5ErkJggg==",
        "base64",
      ),
    });
    // OCR fallback runs → confirm screen with EMPTY fields (nothing inherited)
    await expect(page.getByText(/Confirm extracted fields/i)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("textbox", { name: /GTIN/i })).toHaveValue("");
    await expect(page.getByRole("textbox", { name: /Lot \/ batch/i })).toHaveValue("");
  });
});

test("Sentinel page shows replay badge, timeline, and policy", async ({ page }) => {
  await page.goto("/sentinel");
  await expect(page.getByText(/Early Signal Radar/i).first()).toBeVisible();
  await expect(page.getByText(/Synthetic pre-outbreak replay/i).first()).toBeVisible();
  await expect(page.getByText(/PROCESSOR QA SIGNAL/i)).toBeVisible();
  await expect(page.getByText(/valid signal proofs/i)).toBeVisible();
  await expect(page.getByText(/How Midnight verified this/i)).toBeVisible();
});

test("Demo kit page: outcome-neutral passports + FDA test card without fabricated GTIN", async ({ page }) => {
  await page.goto("/labels");
  await expect(
    page.getByText(/RecallLens Synthetic Product Passport A/i).first(),
  ).toBeVisible();
  await expect(page.getByText(/RecallLens Synthetic Product Passport B/i)).toBeVisible();
  await expect(page.getByText("NFP-SHRED-26164-07", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("SVG-ICE-26171-B", { exact: true })).toBeVisible();
  // Printed faces never reveal the expected outcome
  await expect(page.getByText(/Affected demonstration passport/i)).toHaveCount(0);
  await expect(page.getByText(/Control \(unaffected\)/i)).toHaveCount(0);
  await expect(page.getByText(/Returns no verified match/i)).toHaveCount(0);
  await expect(
    page.getByText(/FDA OFFICIAL RECALL TEST CARD/i),
  ).toBeVisible();
  await expect(page.getByText(/GreenWise Organic IQF Frozen Blueberries/i)).toBeVisible();
  // The fabricated zero-padded GTIN must not exist anywhere
  await expect(page.getByText("00000000060401")).toHaveCount(0);
  await expect(page.getByText(/not published by the FDA advisory/i)).toBeVisible();
});

test("mobile consumer layout is usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/consumer");
  await expect(page.getByRole("button", { name: /Scan with camera/i })).toBeVisible();
  await expect(page.getByText(/raw image never leaves your device/i)).toBeVisible();
});
