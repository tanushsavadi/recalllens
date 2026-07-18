import { test, expect } from "@playwright/test";

const CASE_ID =
  "cdc07260cc10ee5511223344556677889900aabbccddeeff0011223344556677";
const API = "http://127.0.0.1:8787/api";

// Reset the deterministic-fallback demo state so each stateful test starts
// from the same pre-submitted (2/3) baseline. No-op against a live backend.
test.beforeEach(async ({ request }) => {
  await request.post(`${API}/case/${CASE_ID}/reset`).catch(() => {});
});

/**
 * Central P0 demo journey:
 *   1. Dashboard loads official outbreak info (live or cached).
 *   2. Source provenance visible.
 *   3. Investigator opens the case (Investigation).
 *   4. Three synthetic orgs submit matching private records.
 *   5. Public state updates (match count climbs).
 *   6. Reaches verified common-lineage convergence.
 *   7. No unrelated private record appears in displayed public state.
 *   8. User can inspect what is private vs disclosed.
 */
test("central demo: dashboard → 3 proofs → verified convergence", async ({
  page,
}) => {
  // 1 + 2: cockpit hero + provenance (hero is always visible on both viewports)
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Cyclospora Outbreak/i }),
  ).toBeVisible();
  await expect(
    page.getByText(/LIVE official source|CACHED official snapshot/i),
  ).toBeVisible();
  // provenance link to the official CDC page (hero)
  await expect(
    page.getByRole("link", { name: /Official CDC page/i }),
  ).toBeVisible();

  // Proof status widget (top-right) reflects on-chain state
  await expect(
    page.getByText(/Proving \d\/\d|Common origin verified/i),
  ).toBeVisible();

  // 3: open the investigation (nav pill — first match; hero also links there)
  await page.getByRole("link", { name: /^Investigate$/i }).first().click();
  await expect(
    page.getByRole("heading", { name: /Investigation Workspace/i }),
  ).toBeVisible();

  // 4 + 5: run private matches until convergence. Click the "Run private match"
  // button while it is present + enabled; each click advances the next org.
  // Stop as soon as the converged panel appears.
  const converged = page.getByText("Common lineage verified");
  for (let i = 0; i < 4; i++) {
    if (await converged.isVisible().catch(() => false)) break;
    const runButton = page.getByRole("button", { name: /Run private match —/i });
    if (!(await runButton.isVisible().catch(() => false))) break;
    await expect(runButton).toBeEnabled({ timeout: 15_000 });
    await runButton.click();
    // Let the mutation + cache update settle, then loop (re-resolves next org).
    await page.waitForTimeout(2000);
  }

  // 6: verified convergence
  await expect(converged).toBeVisible({ timeout: 25_000 });
  await expect(
    page.getByText(/3 independent credentialed organizations/i),
  ).toBeVisible();
  await expect(
    page.getByText(/0 raw partner records written to the public ledger/i),
  ).toBeVisible();

  // 7 + 8: public ledger panel shows only opaque hashes/counts (no raw records)
  await expect(page.getByText(/Public ledger — what was recorded/i)).toBeVisible();
  await expect(page.getByText(/Distinct-org nullifiers/i)).toBeVisible();
  // No supplier name / lot code leaks into the public panel
  await expect(page.getByText(/SVG-ICE-/)).toHaveCount(0);
});

test("consumer receipt check returns deterministic affected result", async ({ page }) => {
  await page.goto("/consumer");
  await page.getByRole("button", { name: /Use a receipt/i }).click();
  await page.getByRole("button", { name: /Check against affected lineage/i }).click();
  await expect(page.getByText(/Affected purchase detected/i)).toBeVisible();
  await expect(
    page.getByRole("link", { name: /safety guidance/i }),
  ).toBeVisible();
});
