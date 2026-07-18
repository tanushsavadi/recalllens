import { test, expect } from "@playwright/test";

const CASE_ID =
  "cdc07260cc10ee5511223344556677889900aabbccddeeff0011223344556677";
const API = "http://127.0.0.1:8787/api";

test.beforeEach(async ({ request }) => {
  await request.post(`${API}/case/${CASE_ID}/reset`).catch(() => {});
});

/**
 * Scan-driven pipeline, globe, and demo labels. Runs against the API in
 * DETERMINISTIC FALLBACK mode (see playwright.config webServer) so it is
 * reproducible in CI without a live devnet. The genuine on-chain scan→proof
 * path is verified manually via the browser + `npm run e2e:onchain`.
 */

test.describe("physical scan → truthful consumer result", () => {
  test("affected label (manual entry) → synthetic positive + convergence", async ({
    page,
  }) => {
    await page.goto("/consumer");
    await page.getByRole("button", { name: /Scan a product/i }).click();
    await page.getByRole("button", { name: /Enter values manually/i }).click();

    await page.getByRole("textbox", { name: /GTIN/i }).fill("00810099110042");
    await page
      .getByRole("textbox", { name: /Lot \/ batch/i })
      .fill("NFP-SHRED-26164-07");
    await page.getByRole("textbox", { name: /Best-by/i }).fill("2026-06-28");
    await page.getByRole("button", { name: /Confirm & check privately/i }).click();

    // Sealed proof card keeps fields local.
    await expect(page.getByText(/Sealed proof card/i)).toBeVisible();
    await expect(page.getByText(/fields kept local/i)).toBeVisible();

    // Truthful affected result + genuine-proof / synthetic-records distinction.
    await expect(
      page.getByText(/Affected purchase detected/i),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/synthetic positive demonstration/i).first()).toBeVisible();
    await expect(
      page.getByText(/private partner records.*synthetic/i).first(),
    ).toBeVisible();
    await expect(
      page.getByText(/not proof that the product is safe/i),
    ).toBeVisible();
  });

  test("unknown retail lot → honest no-intersection + safety caveat", async ({
    page,
  }) => {
    await page.goto("/consumer");
    await page.getByRole("button", { name: /Scan a product/i }).click();
    await page.getByRole("button", { name: /Enter values manually/i }).click();
    await page.getByRole("textbox", { name: /GTIN/i }).fill("00012345678905");
    await page.getByRole("textbox", { name: /Lot \/ batch/i }).fill("RANDOM-RETAIL-999");
    await page.getByRole("button", { name: /Confirm & check privately/i }).click();

    await expect(
      page.getByText(/No verified intersection found/i),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText(/not proof that the product is safe/i),
    ).toBeVisible();
    // Never fabricate an affected result for an unknown product.
    await expect(page.getByText(/Affected purchase detected/i)).toHaveCount(0);
  });

  test("control label → no intersection", async ({ page }) => {
    await page.goto("/consumer");
    await page.getByRole("button", { name: /Scan a product/i }).click();
    await page.getByRole("button", { name: /Enter values manually/i }).click();
    await page.getByRole("textbox", { name: /GTIN/i }).fill("00810099110042");
    await page.getByRole("textbox", { name: /Lot \/ batch/i }).fill("SVG-ICE-26171-B");
    await page.getByRole("button", { name: /Confirm & check privately/i }).click();
    await expect(
      page.getByText(/No verified intersection found/i),
    ).toBeVisible({ timeout: 15_000 });
  });
});

test("Command Center cockpit: globe hero + honest granularity note + provenance", async ({
  page,
}) => {
  await page.goto("/");
  // Hero over the massive globe.
  await expect(page.getByRole("heading", { name: /Cyclospora Outbreak/i })).toBeVisible();
  await expect(page.getByText(/ACTIVE OUTBREAK/i)).toBeVisible();
  await expect(page.getByText(/Synthetic demonstration data/i).first()).toBeVisible();
  // Proof status pill (widget drawer, collapsed).
  await expect(page.getByText(/Proving \d\/\d|Common origin verified/i)).toBeVisible();
  // Expand the widget drawer → truthful provenance + private/public.
  await page.getByRole("button", { name: /Toggle proof widgets/i }).click();
  await expect(page.getByText(/Public Midnight state/i)).toBeVisible();
  await expect(page.getByText(/Official source/i).first()).toBeVisible();
  await expect(page.getByText(/never.*written to the public\s*ledger/i)).toBeVisible();
});

test("Demo Labels page shows both GS1 labels with QR + human-readable values", async ({
  page,
}) => {
  await page.goto("/labels");
  await expect(
    page.getByText(/RECALLLENS SYNTHETIC DEMONSTRATION LABEL/i).first(),
  ).toBeVisible();
  await expect(page.getByText("NFP-SHRED-26164-07", { exact: true })).toBeVisible();
  await expect(page.getByText("SVG-ICE-26171-B", { exact: true })).toBeVisible();
  await expect(
    page.getByText(/id\.recalllens\.demo\/01\/00810099110042/).first(),
  ).toBeVisible();
});

test("mobile consumer scan layout is usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/consumer");
  await expect(page.getByRole("button", { name: /Scan a product/i })).toBeVisible();
  await expect(
    page.getByText(/raw image never leaves your device/i),
  ).toBeVisible();
});
