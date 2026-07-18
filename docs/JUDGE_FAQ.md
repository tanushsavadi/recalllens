# RecallLens — Judge FAQ

**Presenter disclosure (read this first):** "The government source data is
real. The physical scans, Compact proofs, Midnight transactions and encrypted
workflow are genuine. The participating companies and private supply records
are synthetic because real companies do not publish their supply graphs — that
is precisely the problem RecallLens solves."

**Can RecallLens detect bacteria through a camera?**
No. The camera only reads printed identifiers (GS1 barcode/QR, lot, date).
Detection of contamination is laboratory work; RecallLens coordinates the
response around identifiers and proofs.

**Does every UPC contain origin information?**
No. A normal UPC identifies a product, not its farm or route. RecallLens uses
identifiers only as LOOKUP KEYS: into official recall sources (public), or into
a partner's own private vault (never someone else's). The signed RecallLens
Product Passport adds a random high-entropy ID so hold membership can't be
brute-forced from a guessable lot.

**Which data is real?**
The CDC Cyclospora outbreak page, both FDA advisory pages (iceberg lettuce +
frozen blueberries, fetched live this build; timestamped snapshots checked in),
the openFDA enforcement API (labeled weekly-updated; the 2026 blueberries
enforcement record does not exist yet — stated, not faked), and USDA FoodData
Central (DEMO_KEY, throttled; cached sample labeled when offline).

**Which records are synthetic?**
All partner organizations (Sierra Verde Growers, Northstar, Meridian,
QuickServe), their EPCIS events, Sentinel signals, passports, receipts, and the
recall blast-radius. Everything synthetic is labeled in the UI.

**What does Midnight genuinely verify?**
On a local Midnight devnet, real ZK circuits verify: registrar-gated org
registration; precommitted event/signal commitments (Merkle-hidden);
`proveRelevantEvent` (a registered org's precommitted record satisfies the case
predicate and shares the hidden lineage — distinct-org nullifiers prevent
double counting); `submitSafetySignal` (same guarantees per signal + category
binding); threshold state; `issuePrecautionaryHold` and
`authorizeRecallPredicate` anchoring. Each is a settled transaction with a tx
id shown in the UI. What a proof does NOT establish: contamination, causation,
or physical-world truth — the UI says so wherever it matters.

**How does Sentinel differ from an official outbreak?**
Sentinel detects corroborated risk convergence: ≥3 private signal proofs from
distinct credentialed orgs, ≥2 categories, ≥1 high-confidence, same hidden
lineage. It opens a CONFIDENTIAL case and a precautionary hold — explicitly
"not yet a confirmed outbreak" and never presented as an FDA/CDC action.

**Why would companies participate?**
Today they must hand over supplier/customer lists to investigators — so they
stall, and recalls over-shoot. RecallLens lets them prove relevance without
disclosure, keep unrelated records private, disclose the minimum (field-by-
field, encrypted), and shrink recalls to affected lineage (~80% product spared
in the simulated comparison).

**How would consumers use this without synthetic data?**
The official-recall path already works on real data (the FDA blueberries card
is real public identifiers). In production, passports would be issued by real
processors and holds anchored by real investigations; the consumer flow is
unchanged.

**What prevents fake or duplicate signals?**
Registration is registrar-gated (credentialing authority); every signal must
open a precommitted, authenticated record inside the circuit; per-(case, org)
nullifiers reject duplicates (so three signals imply three distinct orgs);
category and window bindings are checked in-circuit. Residual trust: a
malicious registrar could admit colluding orgs — same trust as any
credentialing body (documented in THREAT_MODEL.md).

**What remains for production deployment?**
Real org attestation and registrar governance (M-of-N); privacy-aware hold
membership (the demo checks membership against the anchored commitment in the
service — documented limitation; production would use a membership proof or
private set intersection); encrypted disclosure key management (demo keys are
checked-in synthetic credentials); larger anonymity sets; FSIS adapter; USDA
key provisioning; and audited contracts on a public Midnight network.
