/**
 * Role-separated workflow engine.
 *
 * Sits on top of the ChainBackend and enforces the product's role rules:
 *   - the INVESTIGATOR can only REQUEST a private match; it cannot run a
 *     partner's proof
 *   - a PARTNER must scan its own label (GTIN+lot must resolve to ITS vault
 *     record) and explicitly approve before its genuine proof runs
 *   - Sentinel signals are approved by their owning role, then anchored via a
 *     genuine chain transition where the live backend is available
 *   - a hold/authorized-recall registry maps passport commitments so consumer
 *     scans can check membership WITHOUT learning the set contents
 *
 * All state here is DEMO ORCHESTRATION state (in-memory, deterministic reset);
 * the cryptographic facts (proofs, counts, convergence, hold anchoring) come
 * from the chain backend and are never fabricated: when the live chain is
 * used, stage transitions marked `genuine` only occur after a settled tx.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  MatchRequest,
  SentinelSignal,
  SentinelStatus,
  DisclosurePackage,
  WorkflowStage,
  CaseChainState,
} from "@recalllens/schemas";
import {
  organizations,
  affectedEvents,
  lookupVaultLot,
  DEMO_CASE,
} from "@recalllens/demo-fixtures";
import type { ChainBackend } from "@recalllens/midnight-client";

/** Orchestration state persists to the repo root so API restarts don't lose
 * the (chain-anchored) hold/signal bookkeeping. Reset via demo:reset. */
const STATE_FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..", "..", "..",
  ".recalllens-workflow.json",
);

/* ── deterministic Sentinel replay fixtures (synthetic, labeled) ────────── */

const REPLAY_BADGE =
  "Synthetic pre-outbreak replay: what could have happened if RecallLens Sentinel had been deployed before the public advisory.";

function initialSignals(): SentinelSignal[] {
  return [
    {
      signalId: "sig-qa-1",
      category: "PROCESSOR_QA_SIGNAL",
      ownerOrgId: "org-northstar",
      ownerName: "Northstar Fresh Processing",
      highConfidence: true,
      status: "proven",
      dayOffset: -9,
      summary:
        "Signed environmental test result associated with a private committed lineage (raw result stays private).",
      txId: "(pre-submitted)",
      nullifier: null,
      preSubmitted: true,
    },
    {
      signalId: "sig-cold-1",
      category: "COLD_CHAIN_SIGNAL",
      ownerOrgId: "org-meridian",
      ownerName: "Meridian Cold Chain",
      highConfidence: false,
      status: "proven",
      dayOffset: -7,
      summary:
        "Temperature-excursion record signed by a credentialed distributor, bound to the same private lineage.",
      txId: "(pre-submitted)",
      nullifier: null,
      preSubmitted: true,
    },
    {
      signalId: "sig-exposure-1",
      category: "EXPOSURE_CLUSTER_SIGNAL",
      ownerOrgId: "org-quickserve",
      ownerName: "QuickServe Restaurant Group (consumer-aggregate)",
      highConfidence: false,
      status: "pending-approval",
      dayOffset: -6,
      summary:
        "Aggregated privacy-preserving exposure reports (no diagnosis; duplicates nullified), same product lineage.",
      txId: null,
      nullifier: null,
      preSubmitted: false,
    },
  ];
}

const POLICY = {
  minSignals: 3,
  minOrgs: 2,
  minCategories: 2,
  requiresHighConfidence: true,
};

/* ── engine ─────────────────────────────────────────────────────────────── */

export class WorkflowEngine {
  private signals: SentinelSignal[] = initialSignals();
  private hold: { holdCommitment: string; txId: string | null; issuedAt: string; members: Set<string> } | null =
    null;
  private recallAuth: { predicateHash: string; txId: string | null; authorizedAt: string } | null = null;
  private disclosure: DisclosurePackage | null = null;
  private removal: { confirmedBy: string[]; completedAt: string | null } | null = null;
  private requests = new Map<string, MatchRequest>();

  constructor(private backend: ChainBackend) {
    this.load();
  }

  private save() {
    try {
      fs.writeFileSync(
        STATE_FILE,
        JSON.stringify({
          signals: this.signals,
          hold: this.hold ? { ...this.hold, members: [...this.hold.members] } : null,
          recallAuth: this.recallAuth,
          disclosure: this.disclosure,
          removal: this.removal,
        }),
      );
    } catch {
      /* persistence is best-effort */
    }
  }

  private load() {
    try {
      if (!fs.existsSync(STATE_FILE)) return;
      const raw = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8")) as {
        signals?: SentinelSignal[];
        hold?: { holdCommitment: string; txId: string | null; issuedAt: string; members: string[] } | null;
        recallAuth?: { predicateHash: string; txId: string | null; authorizedAt: string } | null;
        disclosure?: DisclosurePackage | null;
        removal?: { confirmedBy: string[]; completedAt: string | null } | null;
      };
      if (raw.signals) this.signals = raw.signals;
      if (raw.hold) this.hold = { ...raw.hold, members: new Set(raw.hold.members) };
      if (raw.recallAuth) this.recallAuth = raw.recallAuth;
      if (raw.disclosure) this.disclosure = raw.disclosure;
      if (raw.removal) this.removal = raw.removal;
    } catch {
      /* corrupted state — start fresh */
    }
  }

  /* ---- Sentinel ---- */

  async sentinelStatus(caseId: string): Promise<SentinelStatus> {
    const proven = this.signals.filter((s) => s.status === "proven");
    const orgs = new Set(proven.map((s) => s.ownerOrgId)).size;
    const cats = new Set(proven.map((s) => s.category)).size;
    const hi = proven.filter((s) => s.highConfidence).length;
    const thresholdReached =
      proven.length >= POLICY.minSignals &&
      orgs >= POLICY.minOrgs &&
      cats >= POLICY.minCategories &&
      (!POLICY.requiresHighConfidence || hi >= 1);
    return {
      caseId,
      replayBadge: REPLAY_BADGE,
      signals: this.signals,
      policy: POLICY,
      counts: { signals: proven.length, orgs, categories: cats, highConfidence: hi },
      thresholdReached,
      hold: this.hold
        ? {
            holdCommitment: this.hold.holdCommitment,
            txId: this.hold.txId,
            issuedAt: this.hold.issuedAt,
            memberCount: this.hold.members.size,
          }
        : null,
      recallAuthorized: this.recallAuth
        ? {
            predicateHash: this.recallAuth.predicateHash,
            txId: this.recallAuth.txId,
            authorizedAt: this.recallAuth.authorizedAt,
          }
        : null,
      mode: this.backend.mode,
    };
  }

  /**
   * The OWNING role approves the pending signal. If the backend exposes the
   * Sentinel circuit, run the genuine transition; otherwise run the fallback
   * (labeled by mode). Only the pending signal's owner may approve.
   */
  async approveSignal(
    caseId: string,
    signalId: string,
    actingOrgId: string,
  ): Promise<SentinelSignal> {
    const sig = this.signals.find((s) => s.signalId === signalId);
    if (!sig) throw new Error("unknown signal");
    if (sig.status !== "pending-approval") throw new Error("signal is not awaiting approval");
    if (sig.ownerOrgId !== actingOrgId) {
      throw new Error(
        `role violation: signal ${signalId} belongs to ${sig.ownerOrgId}; ${actingOrgId} cannot approve it`,
      );
    }
    const res = await this.backend.submitSentinelSignal?.(caseId, sig.ownerOrgId, sig.category);
    sig.status = "proven";
    sig.txId = res?.txId ?? null;
    sig.nullifier = res?.nullifier ?? null;
    this.save();
    return sig;
  }

  /** Investigator issues the hold (only after threshold). */
  async issueHold(
    caseId: string,
    passportCommitments: string[],
  ): Promise<NonNullable<SentinelStatus["hold"]>> {
    const st = await this.sentinelStatus(caseId);
    if (!st.thresholdReached) throw new Error("Sentinel threshold not reached");
    if (this.hold) throw new Error("hold already issued");
    // hold commitment = sha over sorted member commitments (set commitment)
    const canonical = [...passportCommitments].sort().join("|");
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`rl-hold:v1|${canonical}`) as unknown as ArrayBuffer,
    );
    const holdCommitment = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const res = await this.backend.issueHold?.(caseId, holdCommitment);
    this.hold = {
      holdCommitment,
      txId: res?.txId ?? null,
      issuedAt: new Date().toISOString(),
      members: new Set(passportCommitments),
    };
    this.save();
    return {
      holdCommitment,
      txId: this.hold.txId,
      issuedAt: this.hold.issuedAt,
      memberCount: this.hold.members.size,
    };
  }

  /** Consumer-side: is this passport commitment in the active hold set? */
  holdMembership(commitment: string): { member: boolean; txId: string | null } {
    if (!this.hold) return { member: false, txId: null };
    return { member: this.hold.members.has(commitment), txId: this.hold.txId };
  }

  async authorizeRecall(caseId: string): Promise<NonNullable<SentinelStatus["recallAuthorized"]>> {
    if (!this.hold) throw new Error("no hold to convert");
    if (this.recallAuth) throw new Error("recall already authorized");
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`rl-recall-predicate:v1|${this.hold.holdCommitment}`) as unknown as ArrayBuffer,
    );
    const predicateHash = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const res = await this.backend.authorizeRecall?.(caseId, predicateHash);
    this.recallAuth = {
      predicateHash,
      txId: res?.txId ?? null,
      authorizedAt: new Date().toISOString(),
    };
    this.save();
    return this.recallAuth;
  }

  recallMembership(commitment: string): { authorized: boolean; txId: string | null } {
    if (!this.recallAuth || !this.hold) return { authorized: false, txId: null };
    return { authorized: this.hold.members.has(commitment), txId: this.recallAuth.txId };
  }

  /* ---- role-separated trace ---- */

  async matchRequests(caseId: string): Promise<MatchRequest[]> {
    // Reconcile with on-chain proof status.
    const proofs = await this.backend.getProofs(caseId);
    const out: MatchRequest[] = [];
    for (const p of proofs) {
      const key = `${caseId}:${p.orgId}`;
      let req = this.requests.get(key);
      if (!req) {
        req = {
          caseId,
          orgId: p.orgId,
          orgName: p.orgName,
          role: p.role,
          status: p.stage === "confirmed" ? "proven" : "none",
          predicate: {
            productGtin: DEMO_CASE.productGtin,
            windowStart: DEMO_CASE.windowStart,
            windowEnd: DEMO_CASE.windowEnd,
            description:
              "Prove that a precommitted, authenticated trace event for this product falls inside the case window and shares the case lineage — without revealing the record.",
          },
          txId: p.txId,
          preSubmitted: p.preSubmitted,
          updatedAt: new Date().toISOString(),
        };
        this.requests.set(key, req);
      }
      if (p.stage === "confirmed" && req.status !== "proven") {
        req.status = "proven";
        req.txId = p.txId;
      }
      out.push(req);
    }
    return out;
  }

  /** INVESTIGATOR action: request only. Never runs the proof. */
  async requestMatch(caseId: string, orgId: string): Promise<MatchRequest> {
    const reqs = await this.matchRequests(caseId);
    const req = reqs.find((r) => r.orgId === orgId);
    if (!req) throw new Error("unknown org");
    if (req.status === "proven") throw new Error("already proven");
    req.status = "requested";
    req.updatedAt = new Date().toISOString();
    return req;
  }

  /**
   * PARTNER action step 1: scan its own label. The GTIN+lot must resolve to a
   * vault record whose owning org matches the acting org.
   */
  async partnerScan(
    caseId: string,
    actingOrgId: string,
    gtin: string,
    lot: string,
  ): Promise<{ request: MatchRequest; record: { lotCode: string; eventTime: string; bizStep: string } }> {
    const reqs = await this.matchRequests(caseId);
    const req = reqs.find((r) => r.orgId === actingOrgId);
    if (!req) throw new Error("unknown org");
    if (req.status === "proven") throw new Error("already proven");

    const vault = lookupVaultLot(gtin, lot);
    if (!vault) throw new Error("no committed record for this GTIN+lot in your vault");
    // The scanned lot must belong to THIS org's own event.
    const ev = affectedEvents[actingOrgId];
    const orgOwnsLot =
      !!ev &&
      (ev.lotCode.toUpperCase() === lot.toUpperCase() ||
        // Meridian ships Northstar's processed retail lot; its committed event
        // shares the affected lineage, so the retail lot resolves its record.
        vault.lineageToken === ev.lineageToken);
    if (!orgOwnsLot) {
      throw new Error(
        `role violation: the scanned lot does not resolve to a committed record owned by ${actingOrgId}`,
      );
    }
    req.status = "scanned";
    req.updatedAt = new Date().toISOString();
    return {
      request: req,
      record: { lotCode: ev.lotCode, eventTime: ev.eventTime, bizStep: ev.bizStep },
    };
  }

  /**
   * PARTNER action step 2: approve → the org's own GENUINE proof runs. Guarded:
   * only after a scan, and only for the acting org itself.
   */
  async partnerApprove(
    caseId: string,
    actingOrgId: string,
  ): Promise<{ request: MatchRequest; chain: CaseChainState }> {
    const reqs = await this.matchRequests(caseId);
    const req = reqs.find((r) => r.orgId === actingOrgId);
    if (!req) throw new Error("unknown org");
    if (req.status !== "scanned") {
      throw new Error("scan your shipment label first — approval requires a located record");
    }
    req.status = "proving";
    req.updatedAt = new Date().toISOString();
    try {
      const res = await this.backend.submitProof(caseId, actingOrgId);
      req.status = "proven";
      req.txId = res.proof.txId;
      req.updatedAt = new Date().toISOString();
      return { request: req, chain: res.chain };
    } catch (e) {
      req.status = "scanned"; // allow retry
      throw e;
    }
  }

  async partnerReject(caseId: string, actingOrgId: string): Promise<MatchRequest> {
    const reqs = await this.matchRequests(caseId);
    const req = reqs.find((r) => r.orgId === actingOrgId);
    if (!req) throw new Error("unknown org");
    req.status = "rejected";
    req.updatedAt = new Date().toISOString();
    return req;
  }

  /* ---- disclosure + removal ---- */

  setDisclosure(pkg: DisclosurePackage) {
    this.disclosure = pkg;
    this.save();
  }
  getDisclosure(): DisclosurePackage | null {
    return this.disclosure;
  }

  confirmRemoval(orgId: string): { confirmedBy: string[]; completedAt: string | null } {
    if (!this.removal) this.removal = { confirmedBy: [], completedAt: null };
    if (!this.removal.confirmedBy.includes(orgId)) this.removal.confirmedBy.push(orgId);
    const partners = organizations.filter((o) => affectedEvents[o.orgId]).map((o) => o.orgId);
    if (partners.every((p) => this.removal!.confirmedBy.includes(p))) {
      this.removal.completedAt = new Date().toISOString();
    }
    this.save();
    return this.removal;
  }
  getRemoval() {
    return this.removal;
  }

  /* ---- whole-product stage ---- */

  async stage(caseId: string): Promise<WorkflowStage> {
    const st = await this.sentinelStatus(caseId);
    const chain = await this.backend.getCaseState(caseId);
    if (this.removal?.completedAt) return "removal-confirmed";
    if (this.recallAuth) return "recall-authorized";
    if (this.disclosure) return "disclosure-complete";
    if (chain.converged) return "trace-verified";
    const reqs = await this.matchRequests(caseId);
    if (reqs.some((r) => r.status !== "none" && r.status !== "proven") || chain.matchCount > 0)
      if (this.hold) return "trace-requested";
    if (this.hold) return "hold-issued";
    if (st.thresholdReached) return "sentinel-threshold";
    return "sentinel-signals";
  }

  /** Deterministic reset for repeatable demos. */
  reset() {
    this.signals = initialSignals();
    this.hold = null;
    this.recallAuth = null;
    this.disclosure = null;
    this.removal = null;
    this.requests.clear();
    try { fs.unlinkSync(STATE_FILE); } catch { /* absent is fine */ }
  }
}
