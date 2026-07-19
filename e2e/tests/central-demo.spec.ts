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

test("lifecycle prerequisites + idempotency (API-enforced)", async ({ request }) => {
  // recall authorization is impossible before a hold exists
  const early = await request.post(`${API}/sentinel/authorize-recall`, {
    data: { caseId: CASE_ID },
  });
  expect(early.status()).toBe(400);
  expect((await early.json()).error).toMatch(/no hold/i);

  // drive sentinel → hold
  await request.post(`${API}/sentinel/approve-signal`, {
    data: { caseId: CASE_ID, signalId: "sig-exposure-1", actingOrgId: "org-quickserve" },
  });
  const hold = await request.post(`${API}/sentinel/issue-hold`, {
    data: { caseId: CASE_ID, passportCommitments: ["ab".repeat(32)] },
  });
  expect(hold.ok()).toBeTruthy();
  // hold is NOT reissuable
  const hold2 = await request.post(`${API}/sentinel/issue-hold`, {
    data: { caseId: CASE_ID, passportCommitments: ["ab".repeat(32)] },
  });
  expect(hold2.status()).toBe(400);
  expect((await hold2.json()).error).toMatch(/already issued/i);

  // recall still blocked: trace has not converged
  const beforeConverged = await request.post(`${API}/sentinel/authorize-recall`, {
    data: { caseId: CASE_ID },
  });
  expect(beforeConverged.status()).toBe(400);
  expect((await beforeConverged.json()).error).toMatch(/convergence/i);

  // converge the trace via the role-correct partner flow
  await request.post(`${API}/investigator/request-match`, {
    data: { caseId: CASE_ID, orgId: "org-meridian" },
  });
  await request.post(`${API}/partner/scan`, {
    data: { caseId: CASE_ID, actingOrgId: "org-meridian", gtin: "00810099110042", lot: "NFP-SHRED-26164-07" },
  });
  const proof = await request.post(`${API}/partner/approve`, {
    data: { caseId: CASE_ID, actingOrgId: "org-meridian" },
  });
  expect(proof.ok()).toBeTruthy();

  // recall STILL blocked without a disclosure package
  const noDisc = await request.post(`${API}/sentinel/authorize-recall`, {
    data: { caseId: CASE_ID },
  });
  expect(noDisc.status()).toBe(400);
  expect((await noDisc.json()).error).toMatch(/disclosure/i);

  // disclosure send is idempotent per case+org
  const pkg = {
    caseId: CASE_ID,
    orgId: "org-meridian",
    approvedFields: ["sourceGln", "lotCode", "eventDate"],
    rejectedFields: ["destinationGln"],
    ciphertext: "AAAA",
    iv: "BBBB",
    ephemeralPublicKey: "{}",
    authorizationHash: "cd".repeat(32),
    ciphertextDigest: "ef".repeat(32),
    createdAt: new Date().toISOString(),
  };
  const d1 = await request.post(`${API}/disclosure/package`, { data: pkg });
  expect((await d1.json()).stored).toBe(true);
  const d2 = await request.post(`${API}/disclosure/package`, { data: pkg });
  const d2j = await d2.json();
  expect(d2j.stored).toBe(false);
  expect(d2j.alreadyExisted).toBe(true);

  // now recall authorization succeeds — exactly once
  const recall = await request.post(`${API}/sentinel/authorize-recall`, {
    data: { caseId: CASE_ID },
  });
  expect(recall.ok()).toBeTruthy();
  const recall2 = await request.post(`${API}/sentinel/authorize-recall`, {
    data: { caseId: CASE_ID },
  });
  expect(recall2.status()).toBe(400);
  expect((await recall2.json()).error).toMatch(/already authorized/i);

  // removal is partner-reported, idempotent, and states its evidence basis
  const rm1 = await request.post(`${API}/partner/confirm-removal`, {
    data: { orgId: "org-meridian" },
  });
  const rm1j = await rm1.json();
  expect(rm1j.removal.confirmedBy).toContain("org-meridian");
  expect(rm1j.removal.evidenceBasis).toMatch(/off-chain/i);
  expect(rm1j.removal.evidenceBasis).toMatch(/not a Midnight transaction/i);
  const rm2 = await request.post(`${API}/partner/confirm-removal`, {
    data: { orgId: "org-meridian" },
  });
  expect((await rm2.json()).removal.confirmedBy.filter((x: string) => x === "org-meridian")).toHaveLength(1);

  // authoritative lifecycle snapshot reflects everything
  const stage = await (await request.get(`${API}/workflow/${CASE_ID}/stage`)).json();
  expect(stage.stage).toBe("recall-authorized");
  expect(stage.hold.active).toBe(true);
  expect(stage.trace.converged).toBe(true);
  expect(stage.disclosure.sent).toBe(true);
  expect(stage.recall.authorized).toBe(true);
});
