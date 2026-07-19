# RecallLens — Final Video-Readiness Audit (2026-07-19)

Independent verification pass for the judge-readiness integrity and UX task.
Every item below was verified against the RENDERED application (Playwright
MCP probes returning DOM-derived values) or direct test/command output — not
against the implementation summary. Evidence screenshots for this audit are
in `.playwright-mcp/audit-*.png` / `verify-*.png` (local capture artifacts).

**Deployment during behavioral validation:** contract `942452cd5f38…` (the
lifecycle actions were consumed by validation).
**Restored judge-ready deployment:** contract
`6e34f7f1df688ba7b825553d495948763aa19548f2cf443c1567c2bd3d2076d1`
(deployed 2026-07-19T02:48:08Z).

## Verification matrix

| # | Requirement | File/component | How tested | Evidence | Verdict |
|---|---|---|---|---|---|
| 1 | Hold headline = "SIGNED PASSPORT MATCHES A MIDNIGHT-ANCHORED HOLD" | packages/source-adapters/src/recall-intelligence.ts | Passport A upload-scan during active hold; DOM text probe | headline visible; old headline count = 0 | PASS |
| 2 | Hold supporting copy: anchored commitment / under investigation / not a government recall / no contamination proof | recall-intelligence.ts explanation | DOM probes on rendered result | notGovRecall=true, noContamination=true | PASS |
| 3 | Hold action instruction: "Set the product aside and do not consume it while the investigation is pending." | recall-intelligence.ts guidance | DOM text probe | guidance=true | PASS |
| 4 | Source summary rows renamed (FDA advisory / RecallLens Midnight-anchored hold / RecallLens authorized action / Passport signature) | recall-intelligence.ts sourcesChecked | DOM probes on rendered result card | holdSource=true, actionSource=true | PASS |
| 5 | Receipt states service-side membership resolution plainly (not buried) | recall-intelligence.ts whyThisLevel + midnight.note | DOM probe on visible receipt row "Why this result" | serviceSideVisible=true; also asserted in unit test "service-side membership disclosure" | PASS |
| 6 | Technical details collapsed by default | ConsumerCheck.tsx `<details>` | `details.open` DOM probe after result render | techCollapsed=true | PASS |
| 7 | Consumer role badge removed | ConsumerCheck.tsx (RoleBanner removed); RoleBanner.tsx type narrowed to investigator\|partner | getByText('Consumer role').count() on rendered page (desktop + 390×844) | count=0 both viewports | PASS |
| 8 | Role-simulation sentence removed from Consumer Check | ConsumerCheck.tsx | getByText(/Demo role simulation/).count() on /consumer | count=0 (still present on investigator/partner surfaces by design) | PASS |
| 9 | New consumer subtitle | ConsumerCheck.tsx | DOM text probe | "Scan a product to check official recalls and privacy-preserving RecallLens safety actions." visible | PASS |
| 10 | Synthetic badge kept; camera/upload/manual kept; local-privacy message kept | ConsumerCheck.tsx / ScanProduct.tsx | DOM probes | all true | PASS |
| 11 | Result visual priority: result → action → sources → collapsed details; receipt does not dominate first viewport | ConsumerCheck.tsx ordering | audit-hold-result.png (result card + sources fill first viewport; receipt below) | screenshot | PASS |
| 12 | Consumer works at 1440×900 and 390×844, no nav overlap | — | resize probes; nav/pill bounding-rect intersection check | overlap=false; verify-mobile-390.png | PASS |
| 13 | Disclosure labels humanized (Origin facility / Shipment lot / Shipment date / Destination facility) with `· fieldName` secondary text | PartnerVault.tsx DISCLOSURE_FIELD_LABELS | rendered checkbox labels probed via accessibility snapshot | "Origin facility · sourceGln 0810099000031" etc. | PASS |
| 14 | Withheld field reads "Destination facility — withheld by partner" | PartnerVault.tsx | accessibility snapshot | exact text present | PASS |
| 15 | Underlying payload keys/schema/crypto unchanged | packages/gs1 (untouched), schemas DisclosureField (untouched) | GET /api/disclosure/package after send | approvedFields=['sourceGln','lotCode','eventDate'], rejected=['destinationGln'], ciphertext present; gs1 tests 22/22 | PASS |
| 16 | Investigator decrypt shows "RELEVANT SHIPMENT IDENTIFIED" + human labels; rejected field absent | InvestigationWorkspace.tsx FIELD_LABELS | DOM probe of decrypted panel rows | rows = [Origin facility·sourceGln, Shipment lot·lotCode, Shipment date·eventDate]; no destination row/key in panel | PASS |
| 17 | No-causation clarification retained | InvestigationWorkspace.tsx | DOM probe | "does not prove causation or contamination" visible | PASS |
| 18 | Partner Vault dead space removed; ledger card sizes to content; record visible; glass/globe kept; no nav overlap | PartnerVault.tsx grid `items-start` | ledger card height probe before (804px) vs after (188px); audit-vault-layout.png | 188px, record row visible | PASS |
| 19 | CDC attribution: "Current official public-health case · CDC" | CommandCenter.tsx | DOM probes | new text visible; old "· CDC/FDA" count=0 | PASS |
| 20 | CDC vs Midnight rails separate; globe legend explicit (state centroids / schematic arcs / not routes) | CommandCenter.tsx (pre-existing, re-verified) | DOM probes | officialRail, privateRail, legendSchematic, legendNotRoutes all true | PASS |
| 21 | Pill: "Targeted action authorized" (was "RecallLens scope authorized") | WidgetDrawer.tsx pillLabel + drawer row | pill textContent probe after authorization | "Targeted action authorized" | PASS |
| 22 | Consumer result: "MATCHES TARGETED RECALL SCOPE" with not-an-FDA-recall body | recall-intelligence.ts | Passport A re-scan after authorization | headline visible; old headline count=0; notFda=true; noContaminationProof=true; audit-targeted-scope.png | PASS |
| 23 | Passport B neutral result unweakened | (unchanged) | Passport B upload-scan | "NO VERIFIED MATCH FOUND" + "not a guarantee that the product is safe"; headline color rgb(124,192,255) = neutral accent blue, not green | PASS |
| 24 | Video readability: primary headline ≥14px; explanatory text ≥14px | ConsumerCheck.tsx ResultCard h2 + sources list text-sm | computed fontSize probe | headline 18px; explanation/guidance/sources 14px (text-sm); metadata smaller by design | PASS |
| 25 | Dark theme canonical; light theme not regressed (toggle untouched this pass) | — | no theme files modified this pass | git diff scope | PASS |
| 26 | Evidence README #09 corrected (tx ids not visibly displayed) | demo-evidence/workflow/README.md | screenshot 09 inspected: no tx ids visible in frame | description now says ids are in the transaction table / collapsed section | PASS |
| 27 | Evidence README #11 corrected (shows completed 3/3, not progress) | README.md | screenshot 11 inspected: threshold 3/3 + hold-ready visible, no progress bar | description rewritten accurately | PASS |
| 28 | Evidence README #21 corrected ("in progress"; stage indicator below fold) | README.md | screenshot 21 inspected: "proving" badge visible, no staged indicator in frame | description rewritten | PASS |
| 29 | Evidence README #33 corrected (evidence basis partially below fold) | README.md | screenshot 33 inspected: basis text clipped at bottom | description rewritten | PASS |
| 30 | Evidence README distinguishes walkthrough contract vs current seeded contract; historical tx ids unchanged | README.md | read back | walkthrough `327994f5…` vs current judge-ready contract; a HISTORICAL WORDING note explains pre-rename captures; no tx ids altered | PASS |
| 31 | Investigator can request, cannot generate partner proof | (unchanged, re-verified) | DOM probes on /investigation | noProofButton=0, cannotGenerateNote=true, request→"requested" | PASS |
| 32 | Partner locates record, approves genuine proof | (unchanged, re-verified) | full flow on live devnet | proof settled: tx `00884f…17ad23` → 3/3 | PASS |
| 33 | Genuine authorizeRecallPredicate still works | (unchanged, re-verified) | predicate review → confirm → settled | AUTHORIZED RECALLLENS DEMONSTRATION RECALL rendered with genuine tx | PASS |
| 34 | FDA test-card behavior unchanged; GTIN honestly absent; Midnight uninvolved | (unchanged, re-verified) | FDA card upload → EXACT OFFICIAL RECALL MATCH | decoded GTIN field empty; "not provided by the FDA advisory" visible | PASS |
| 35 | Cross-scan isolation still works | (unchanged, re-verified) | A→B upload sequence live + e2e suite | B's lot replaced A's; product name empty; e2e isolation tests pass | PASS |
| 36 | No duplicate proof/disclosure/authorization/removal actions | (unchanged, re-verified) | DOM button counts after each action | authorize=0, encrypt=0, removal=0 remaining | PASS |
| 37 | Console: zero errors | — | browser_console_messages at end of validation | 0 errors / 0 warnings (transient 500s occurred only during the intentional mid-validation API restart and cleared) | PASS |
| 38 | No image bytes leave the device | — | POST /api/consumer/verify request-body inspection | body = normalized identifiers + scanOrigin only | PASS |
| 39 | Automated tests green (run AFTER final code edit) | — | fresh run post-edits | source-adapters 27/27, gs1 22/22, schemas 4/4, fixtures 8/8, midnight-client 8/8, contract 43/43, Playwright 28 passed + 2 intentional desktop-only skips | PASS |
| 40 | TypeScript + production build pass | — | tsc all touched workspaces; vite build | all clean; build exit 0 | PASS |
| 41 | Compact contract + compiled artifacts unchanged | packages/contract | git status on packages/contract | no modifications | PASS |
| 42 | Deterministic 2/3 judge-ready state restored | — | demo:reset + demo:seed + live API probe | stage=sentinel-signals, Sentinel 2/3, trace 2/3, no hold/recall/disclosure/removal, mode live-devnet, CDC live | PASS |

## Obsolete-phrase sweep (repo-wide, post-edit)

`grep` across `apps/`, `packages/`, `e2e/` (*.ts/*.tsx): zero occurrences of
"PROOF-VERIFIED PRECAUTIONARY HOLD", "Consumer role", the role-simulation
sentence on Consumer Check, "Current official case · CDC/FDA", "RecallLens
scope authorized", "MATCHES AUTHORIZED RECALL SCOPE", or raw disclosure
labels without human-readable equivalents.

Intentionally retained in historical documentation (with reasons):
- `docs/QA_EVIDENCE.md`, `docs/BUILD_STATE.md`: session records of what was
  verified at the time; those sections are explicitly labeled historical.
- `demo-evidence/workflow/README.md`: describes unmodified screenshots from
  the pre-rename walkthrough; a prominent "HISTORICAL WORDING" note maps old
  phrases to the current UI copy. Screenshots and tx ids were not altered.
- The internal enum `PROOF_VERIFIED_PRECAUTIONARY_HOLD` remains as a
  machine-readable level id (schema stability; it appears only inside the
  collapsed Technical details section, labeled as an enum).

## Copy changes (exact)

| Where | Before | After |
|---|---|---|
| Consumer hold headline | PROOF-VERIFIED PRECAUTIONARY HOLD | SIGNED PASSPORT MATCHES A MIDNIGHT-ANCHORED HOLD |
| Hold explanation | "This lot is connected to a private supply lineage…" | "This signed RecallLens passport matches a precautionary hold whose commitment is anchored on Midnight. The product is still under investigation. This is not an official government recall and does not prove that the product is contaminated." |
| Hold guidance | "Set the product aside. Check back…" | "Set the product aside and do not consume it while the investigation is pending." |
| Hold whyThisLevel | (commitment-membership sentence) | adds "…RecallLens resolved this passport's membership against that anchored commitment (membership resolution is service-side in this MVP)." |
| Source row | RecallLens precautionary hold | RecallLens Midnight-anchored hold |
| Source row | RecallLens authorized recall scope | RecallLens authorized action |
| Authorized headline | MATCHES AUTHORIZED RECALL SCOPE | MATCHES TARGETED RECALL SCOPE |
| Consumer subtitle | "Check a product against official recalls and proof-verified RecallLens holds." | "Scan a product to check official recalls and privacy-preserving RecallLens safety actions." |
| Consumer role banner | badge + simulation sentence | removed entirely |
| Command Center eyebrow | Current official case · CDC/FDA | Current official public-health case · CDC |
| Lifecycle pill | RecallLens scope authorized | Targeted action authorized |
| Drawer row | Recall action / authorized (RecallLens) | Targeted action / authorized (RecallLens, not FDA) |
| Disclosure labels | sourceGln / lotCode / eventDate / destinationGln (raw) | Origin facility / Shipment lot / Shipment date / Destination facility (+ `· fieldName` secondary) |
| Withheld field | …withheld by default | — withheld by partner |
| Decrypt panel rejected row | "Rejected fields" | "Withheld by partner" |
| Sentinel hold note | "…see a proof-verified precautionary hold" | "…see that it matches this Midnight-anchored hold" |

## Files changed this pass

apps/web/src/pages/ConsumerCheck.tsx · apps/web/src/pages/PartnerVault.tsx ·
apps/web/src/pages/InvestigationWorkspace.tsx · apps/web/src/pages/Sentinel.tsx ·
apps/web/src/pages/CommandCenter.tsx · apps/web/src/components/WidgetDrawer.tsx ·
apps/web/src/components/RoleBanner.tsx · apps/web/src/labels/DemoLabels.tsx ·
packages/source-adapters/src/recall-intelligence.ts ·
packages/source-adapters/test/fda-and-intelligence.test.ts ·
e2e/tests/scan-and-globe.spec.ts (source-row assertions + label-image paths
now point at the regenerated demo-evidence/workflow set with a skip guard) ·
docs/DEMO_SCRIPT.md · docs/JUDGE_FAQ.md · docs/CONSUMER_RECALL_INTELLIGENCE.md ·
demo-evidence/workflow/README.md · docs/FINAL_VIDEO_READINESS_AUDIT.md (this file)

No changes to: Compact contract/circuits, compiled artifacts, schemas'
DisclosureField payload keys, encryption code, privacy architecture.

## Remaining implementation limitations (unchanged, disclosed in-product)

- Hold/recall set membership is resolved service-side against the
  Midnight-anchored commitment (now stated in the consumer headline context,
  receipt, and FAQ).
- Removal is a partner-reported off-chain attestation.
- Demo issuer/investigator keys are checked-in synthetic credentials.
- Blast-radius comparison is simulated (labeled).
- Registrar admission is a single-credential trust anchor.

## Judge-ready state (restored, verified via live API)

- Contract `6e34f7f1df688ba7b825553d495948763aa19548f2cf443c1567c2bd3d2076d1`
  (deployed 2026-07-19T02:48:08Z, recorded in .recalllens-deployment.json)
- stage `sentinel-signals` · Sentinel 2/3 · trace 2/3 · no hold · no
  targeted action · no disclosure · no removal · mode live-devnet · CDC live
- Pre-submitted rows carry genuine seed tx ids (signals `0007fb00c8…` /
  `0011733fe0…`; proofs `000eb90faf…` block 11374 / `0026486cb6…` block 11378)

## VERDICT

**VIDEO READINESS: PASS** — all 42 matrix items verified in the rendered
application or by direct test output; automated checks green after the final
edit; deterministic judge-ready state restored.
