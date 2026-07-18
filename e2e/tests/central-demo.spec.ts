import { test, expect } from "@playwright/test";

const CASE_ID =
  "cdc07260cc10ee5511223344556677889900aabbccddeeff0011223344556677";
const API = "http://127.0.0.1:8787/api";

// Deterministic reset before each stateful test (fallback backend).
test.beforeEach(async ({ request }) => {
  await request.post(`${API}/case/${CASE_ID}/reset`).catch(() => {});
});

test("Command Center: lifecycle story + official case + provenance", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Detect risk early\. Trace it without exposing/i }),
  ).toBeVisible();
  // lifecycle strip
  for (const s of ["Detect", "Verify", "Hold", "Trace", "Recall", "Protect"]) {
    await expect(page.getByText(s, { exact: true }).first()).toBeVisible();
  }
  // two guided demos
  await expect(page.getByRole("link", { name: /Run Sentinel replay/i })).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Scan an official recall test card/i }),
  ).toBeVisible();
  // real current case + provenance
  await expect(page.getByText(/LIVE official source|CACHED official snapshot/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /Official CDC page/i })).toBeVisible();
  await expect(page.getByText(/Synthetic demonstration data/i).first()).toBeVisible();
});

test("role-correct end-to-end: sentinel → hold → request → partner scan+approve → shared lineage", async ({
  page,
}) => {
  /* SENTINEL: starts at 2 signals; owner approves the third */
  await page.goto("/sentinel");
  await expect(page.getByText(/Synthetic pre-outbreak replay/i).first()).toBeVisible();
  await expect(page.getByText(/EXPOSURE CLUSTER SIGNAL/i)).toBeVisible();
  await page.getByRole("button", { name: /Review as owner/i }).click();
  await expect(page.getByText(/Acting as QuickServe/i)).toBeVisible();
  await page.getByRole("button", { name: /Approve final signal proof/i }).click();
  await expect(page.getByText(/Early risk convergence detected/i)).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText(/not yet a confirmed outbreak/i)).toBeVisible();

  /* HOLD */
  await page.getByRole("button", { name: /Issue confidential precautionary hold/i }).click();
  await expect(page.getByText(/Precautionary hold active/i)).toBeVisible({ timeout: 20_000 });

  /* INVESTIGATOR: request only — no proof button exists */
  await page.goto("/investigation");
  await expect(page.getByText(/You cannot generate a partner's proof/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Run private match/i })).toHaveCount(0);
  await page.getByRole("button", { name: /Send private-match request/i }).click();
  await expect(page.getByText(/Awaiting partner|scanned|requested/i).first()).toBeVisible();

  /* PARTNER: Meridian scans its own label then approves */
  await page.goto("/vault");
  await page.getByRole("button", { name: /Meridian Cold Chain/i }).click();
  await expect(page.getByText(/Requested predicate/i)).toBeVisible();
  await page.getByRole("button", { name: /Enter values manually/i }).click();
  await page.getByRole("textbox", { name: /GTIN/i }).fill("00810099110042");
  await page.getByRole("textbox", { name: /Lot \/ batch/i }).fill("NFP-SHRED-26164-07");
  await page.getByRole("button", { name: /Confirm & verify/i }).click();
  await expect(page.getByText(/Committed record located/i)).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: /Approve and generate private proof/i }).click();
  await expect(page.getByText(/Your proof settled on Midnight/i)).toBeVisible({
    timeout: 30_000,
  });

  /* INVESTIGATOR: shared lineage verified (never "origin") */
  await page.goto("/investigation");
  await expect(page.getByText(/Shared supply lineage verified/i)).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    page.getByText(/does not independently establish contamination or causation/i),
  ).toBeVisible();
  await expect(page.getByText(/Common origin verified/i)).toHaveCount(0);
  // public panel stays opaque
  await expect(page.getByText(/Public ledger — what was recorded/i)).toBeVisible();
  await expect(page.getByText(/SVG-ICE-/)).toHaveCount(0);
});

test("investigator/consumer cannot run a partner proof (API role guards)", async ({
  request,
}) => {
  // legacy endpoint removed
  const legacy = await request.post(`${API}/case/prove`, {
    data: { caseId: CASE_ID, orgId: "org-meridian" },
  });
  expect(legacy.status()).toBe(404);
  // approval without the partner's own scan is rejected
  const approve = await request.post(`${API}/partner/approve`, {
    data: { caseId: CASE_ID, actingOrgId: "org-meridian" },
  });
  expect(approve.status()).toBe(403);
  // wrong org cannot approve another org's sentinel signal
  const sig = await request.post(`${API}/sentinel/approve-signal`, {
    data: { caseId: CASE_ID, signalId: "sig-exposure-1", actingOrgId: "org-sierra-verde" },
  });
  expect(sig.status()).toBe(403);
});
