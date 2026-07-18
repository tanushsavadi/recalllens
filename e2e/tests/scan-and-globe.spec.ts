import { test, expect } from "@playwright/test";

const CASE_ID =
  "cdc07260cc10ee5511223344556677889900aabbccddeeff0011223344556677";
const API = "http://127.0.0.1:8787/api";

test.beforeEach(async ({ request }) => {
  await request.post(`${API}/case/${CASE_ID}/reset`).catch(() => {});
});

test.describe("consumer recall intelligence", () => {
  test("FDA blueberries test card → EXACT OFFICIAL RECALL MATCH with provenance", async ({
    page,
  }) => {
    await page.goto("/consumer");
    await page.getByRole("button", { name: /Enter values manually/i }).click();
    await page.getByRole("textbox", { name: /GTIN/i }).fill("00000000060401");
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
    await page.getByRole("textbox", { name: /GTIN/i }).fill("00000000060401");
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

test("Sentinel page shows replay badge, timeline, and policy", async ({ page }) => {
  await page.goto("/sentinel");
  await expect(page.getByText(/Early Signal Radar/i).first()).toBeVisible();
  await expect(page.getByText(/Synthetic pre-outbreak replay/i).first()).toBeVisible();
  await expect(page.getByText(/PROCESSOR QA SIGNAL/i)).toBeVisible();
  await expect(page.getByText(/valid signal proofs/i)).toBeVisible();
  await expect(page.getByText(/How Midnight verified this/i)).toBeVisible();
});

test("Demo kit page shows passports + FDA test card", async ({ page }) => {
  await page.goto("/labels");
  await expect(
    page.getByText(/RecallLens Synthetic Demonstration Passport/i).first(),
  ).toBeVisible();
  await expect(page.getByText("NFP-SHRED-26164-07", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("SVG-ICE-26171-B", { exact: true })).toBeVisible();
  await expect(
    page.getByText(/FDA OFFICIAL RECALL TEST CARD/i),
  ).toBeVisible();
  await expect(page.getByText(/GreenWise Organic IQF Frozen Blueberries/i)).toBeVisible();
});

test("mobile consumer layout is usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/consumer");
  await expect(page.getByRole("button", { name: /Scan with camera/i })).toBeVisible();
  await expect(page.getByText(/raw image never leaves your device/i)).toBeVisible();
});
