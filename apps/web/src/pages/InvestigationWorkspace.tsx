import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api, DEMO_CASE_ID } from "../lib/api";
import {
  Card,
  Badge,
  SectionTitle,
  Stat,
  Mono,
  truncateHex,
  SyntheticBadge,
} from "../components/ui";
import { RoleBanner } from "../components/RoleBanner";
import { ConvergenceGraph } from "../components/ConvergenceGraph";
import { RecallImpact } from "../components/RecallImpact";
import { decryptDisclosure } from "@recalllens/gs1";
import type { MatchRequest } from "@recalllens/schemas";

/** Human-readable labels for disclosure payload keys (display-only). */
const FIELD_LABELS: Record<string, string> = {
  sourceGln: "Origin facility",
  lotCode: "Shipment lot",
  eventDate: "Shipment date",
  destinationGln: "Destination facility",
};
const fieldLabel = (k: string) => FIELD_LABELS[k] ?? k;

export function InvestigationWorkspace() {
  const qc = useQueryClient();
  const status = useQuery({
    queryKey: ["case", DEMO_CASE_ID],
    queryFn: () => api.caseStatus(DEMO_CASE_ID),
    refetchInterval: 3000,
  });
  const requests = useQuery({
    queryKey: ["requests", DEMO_CASE_ID],
    queryFn: () => api.investigator.matchRequests(DEMO_CASE_ID),
    refetchInterval: 3000,
  });
  const sentinel = useQuery({
    queryKey: ["sentinel", DEMO_CASE_ID],
    queryFn: () => api.sentinel.status(DEMO_CASE_ID),
    refetchInterval: 4000,
  });
  const disclosurePkg = useQuery({
    queryKey: ["disclosure-package"],
    queryFn: () => api.investigator.getDisclosurePackage(),
    refetchInterval: 4000,
  });

  const requestMatch = useMutation({
    mutationFn: (orgId: string) => api.investigator.requestMatch(DEMO_CASE_ID, orgId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["requests", DEMO_CASE_ID] }),
  });

  const chain = status.data?.chain;
  const converged = chain?.converged ?? false;
  const reqs = requests.data?.requests ?? [];
  const pendingReq = useMemo(
    () => reqs.find((r) => r.status !== "proven" && r.status !== "rejected"),
    [reqs],
  );
  const nextUnrequested = useMemo(
    () => reqs.find((r) => r.status === "none"),
    [reqs],
  );
  const holdIssued = !!sentinel.data?.hold;
  const disclosureReceived = !!disclosurePkg.data?.package;
  const recallAuthorized = !!sentinel.data?.recallAuthorized;

  // The investigator's graph shows proofs ANONYMOUSLY (role only, no names).
  const anonProofs = reqs.map((r) => ({
    orgId: r.orgId,
    orgName: `Credentialed ${r.role} (anonymous)`,
    role: r.role,
    stage: (r.status === "proven" ? "confirmed" : r.status === "proving" ? "proving" : "queued") as
      | "confirmed"
      | "proving"
      | "queued",
    orgNullifier: null,
    txId: r.txId,
    blockHeight: null,
    preSubmitted: r.preSubmitted,
    error: null,
    updatedAt: r.updatedAt,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Investigation Workspace</h1>
          <p className="text-sm text-slate-500">
            Request private matches; partners decide whether to prove. You see
            anonymous proof results — never partner vaults.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SyntheticBadge />
          <Badge tone={status.data?.mode === "live-devnet" ? "verified" : "amber"}>
            {status.data?.mode === "live-devnet" ? "Live Midnight devnet" : "Deterministic fallback"}
          </Badge>
        </div>
      </div>
      <RoleBanner role="investigator" />

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card className="p-5">
          <SectionTitle hint="proof segments appear as partners approve">
            Private supply-chain convergence
          </SectionTitle>
          <div className="h-[420px] w-full overflow-hidden rounded-lg border border-slate-200 bg-midnight-950">
            <ConvergenceGraph proofs={anonProofs} converged={converged} />
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Organizations appear to the investigator only as anonymous
            credentialed roles. Identities live in each partner's own vault.
          </p>
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="p-5">
            <SectionTitle>Convergence</SectionTitle>
            <div className="grid grid-cols-2 gap-4">
              <Stat
                label="Distinct verified orgs"
                value={`${chain?.matchCount ?? 0}/${chain?.convergenceThreshold ?? 3}`}
                tone={converged ? "verified" : "default"}
              />
              <Stat
                label="State"
                value={converged ? "VERIFIED" : "Building"}
                tone={converged ? "verified" : "default"}
              />
            </div>

            {converged ? (
              <div className="mt-4 rounded-lg border border-verified/30 bg-verified-bg p-4">
                <div className="text-sm font-extrabold uppercase tracking-wide text-verified-fg">
                  Shared supply lineage verified
                </div>
                <p className="mt-2 text-xs text-verified-fg/90">
                  Three distinct credentialed organizations independently proved
                  that authenticated, precommitted records satisfy this case and
                  connect to the same hidden lineage. This narrows the
                  investigation but does not independently establish
                  contamination or causation.
                </p>
              </div>
            ) : (
              <div className="mt-4 flex flex-col gap-2">
                <button
                  className="btn btn-primary w-full"
                  disabled={!nextUnrequested || requestMatch.isPending}
                  onClick={() => nextUnrequested && requestMatch.mutate(nextUnrequested.orgId)}
                >
                  {nextUnrequested
                    ? `Send private-match request (${nextUnrequested.role})`
                    : pendingReq
                      ? `Awaiting partner: ${pendingReq.status}`
                      : "All requests sent"}
                </button>
                {pendingReq && pendingReq.status !== "none" && (
                  <Link to="/vault" className="btn btn-glass w-full text-xs">
                    → Switch to the partner role to scan &amp; approve
                  </Link>
                )}
                <p className="text-[11px] text-slate-500">
                  You cannot generate a partner's proof. The owning organization
                  scans its own shipment label and approves in its vault.
                </p>
              </div>
            )}
            {requestMatch.isError && (
              <p className="mt-2 text-xs text-outbreak">{(requestMatch.error as Error).message}</p>
            )}
          </Card>

          <Card className="p-5">
            <SectionTitle>Match requests</SectionTitle>
            <ol className="flex flex-col gap-2">
              {reqs.map((r) => (
                <RequestRow key={r.orgId} req={r} />
              ))}
            </ol>
          </Card>
        </div>
      </div>

      {/* Post-convergence: encrypted minimum disclosure + targeted action */}
      {converged && (
        <div className="grid gap-6 md:grid-cols-2">
          <DisclosureDecryptPanel />
          <RecallActionPanel
            holdIssued={holdIssued}
            disclosureReceived={disclosureReceived}
            recallAuthorized={recallAuthorized}
            recallTxId={sentinel.data?.recallAuthorized?.txId ?? null}
            predicateHash={sentinel.data?.recallAuthorized?.predicateHash ?? null}
            holdCommitment={sentinel.data?.hold?.holdCommitment ?? null}
          />
        </div>
      )}

      {/* Public ledger panel */}
      <Card className="p-5">
        <SectionTitle>Public ledger — what was recorded</SectionTitle>
        <dl className="grid gap-1.5 text-sm sm:grid-cols-2">
          <Row label="Contract"><Mono>{truncateHex(chain?.contractAddress, 10, 8)}</Mono></Row>
          <Row label="Case tag (anonymous lineage)"><Mono>{truncateHex(chain?.caseTag)}</Mono></Row>
          <Row label="Distinct-org nullifiers"><span>{chain?.nullifiers.length ?? 0}</span></Row>
          <Row label="Anchored event commitments"><span>{chain?.eventCommitmentCount ?? 0}</span></Row>
          <Row label="Hold commitment">
            <Mono>{truncateHex(sentinel.data?.hold?.holdCommitment ?? null)}</Mono>
          </Row>
          <Row label="Recall predicate hash">
            <Mono>{truncateHex(sentinel.data?.recallAuthorized?.predicateHash ?? null)}</Mono>
          </Row>
        </dl>
        <p className="mt-3 text-xs text-slate-500">
          Every value above is an opaque hash or a count. No supplier names, lot
          codes, quantities, routes, or invoices appear.
        </p>
      </Card>
    </div>
  );
}

/**
 * Recall authorization — a SEPARATE, explicit action (never combined with
 * hold issuance, which happens on the Sentinel page). Gated on: trace
 * convergence + issued hold + received disclosure. Shows the exact predicate
 * before a confirmation step; the resulting genuine Midnight transaction is
 * displayed once settled.
 */
function RecallActionPanel({
  holdIssued,
  disclosureReceived,
  recallAuthorized,
  recallTxId,
  predicateHash,
  holdCommitment,
}: {
  holdIssued: boolean;
  disclosureReceived: boolean;
  recallAuthorized: boolean;
  recallTxId: string | null;
  predicateHash: string | null;
  holdCommitment: string | null;
}) {
  const qc = useQueryClient();
  const [reviewing, setReviewing] = useState(false);
  const authorizeRecall = useMutation({
    mutationFn: () => api.investigator.authorizeRecall(DEMO_CASE_ID),
    onSuccess: () => {
      setReviewing(false);
      qc.invalidateQueries({ queryKey: ["sentinel", DEMO_CASE_ID] });
      qc.invalidateQueries({ queryKey: ["workflow-stage", DEMO_CASE_ID] });
    },
  });

  const prereqsMet = holdIssued && disclosureReceived;

  return (
    <Card className="p-5">
      <SectionTitle hint="Simulated impact using demonstration supply records">
        Targeted action
      </SectionTitle>
      <RecallImpact />
      <div className="mt-4">
        {recallAuthorized ? (
          <div className="rounded-lg border border-amber-safety/40 bg-amber-bg p-3">
            <Badge tone="amber">AUTHORIZED RECALLLENS DEMONSTRATION RECALL</Badge>
            <p className="mt-1 text-xs text-slate-600">
              The recall scope was explicitly authorized
              {recallTxId ? (
                <> (genuine Midnight tx <Mono>{truncateHex(recallTxId, 8, 6)}</Mono>)</>
              ) : (
                " (fallback mode — no transaction)"
              )}
              . This is not an FDA recall.
            </p>
            {predicateHash && (
              <p className="mt-1 text-[11px] text-slate-500">
                Predicate hash <Mono>{truncateHex(predicateHash, 10, 8)}</Mono>
              </p>
            )}
          </div>
        ) : reviewing ? (
          <div className="rounded-lg border border-outbreak/40 bg-outbreak-bg p-3">
            <div className="text-xs font-bold uppercase tracking-wide text-outbreak">
              Review the exact recall predicate
            </div>
            <dl className="mt-2 space-y-1 text-xs text-slate-700">
              <div className="flex justify-between gap-3">
                <dt>Scope</dt>
                <dd>the passport-commitment set of the active precautionary hold</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Hold commitment</dt>
                <dd><Mono>{truncateHex(holdCommitment, 10, 8)}</Mono></dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Effect</dt>
                <dd>consumers scanning a matching signed passport see “Matches targeted recall scope”</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Authority</dt>
                <dd>RecallLens network action — NOT an FDA recall</dd>
              </div>
            </dl>
            <div className="mt-3 flex gap-2">
              <button
                className="btn btn-primary flex-1"
                disabled={authorizeRecall.isPending}
                onClick={() => authorizeRecall.mutate()}
              >
                {authorizeRecall.isPending
                  ? "Authorizing on Midnight…"
                  : "Confirm — authorize this recall scope"}
              </button>
              <button
                className="btn btn-glass"
                disabled={authorizeRecall.isPending}
                onClick={() => setReviewing(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <button
              className="btn btn-primary w-full"
              disabled={!prereqsMet}
              onClick={() => setReviewing(true)}
            >
              Review recall predicate…
            </button>
            <ul className="text-[11px] text-slate-500">
              <li>{holdIssued ? "✓" : "·"} precautionary hold issued (Sentinel)</li>
              <li>{disclosureReceived ? "✓" : "·"} encrypted disclosure received from the partner</li>
            </ul>
          </div>
        )}
        {authorizeRecall.isError && (
          <p className="mt-2 text-xs text-outbreak">{(authorizeRecall.error as Error).message}</p>
        )}
      </div>
    </Card>
  );
}

function RequestRow({ req }: { req: MatchRequest }) {
  const tone =
    req.status === "proven"
      ? "verified"
      : req.status === "rejected"
        ? "outbreak"
        : req.status === "none"
          ? "neutral"
          : "amber";
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
      <div>
        <div className="text-sm font-semibold text-hi">
          Credentialed {req.role} <span className="text-xs text-slate-500">(anonymous)</span>
        </div>
        <div className="text-xs text-slate-500">
          {req.preSubmitted ? "verified during demo setup" : "live"}
        </div>
      </div>
      <div className="text-right">
        <Badge tone={tone}>{req.status}</Badge>
        {req.status === "proven" && (
          <div className="mt-1 text-[10px] text-slate-400">
            {req.txId ? (
              <>tx <Mono>{truncateHex(req.txId, 6, 6)}</Mono></>
            ) : req.preSubmitted ? (
              "previously verified during demo setup"
            ) : (
              "no tx (fallback mode)"
            )}
          </div>
        )}
      </div>
    </li>
  );
}

/** Investigator-side decryption of the partner's encrypted disclosure. */
function DisclosureDecryptPanel() {
  const pkg = useQuery({
    queryKey: ["disclosure-package"],
    queryFn: () => api.investigator.getDisclosurePackage(),
    refetchInterval: 4000,
  });
  const [decrypted, setDecrypted] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const p = pkg.data?.package;

  return (
    <Card className="p-5">
      <SectionTitle hint="ciphertext only — plaintext never transits">
        Encrypted minimum disclosure
      </SectionTitle>
      {!p ? (
        <p className="text-sm text-slate-500">
          No disclosure package yet. Request fields from the partner vault; the
          partner approves each field individually and encrypts them for you.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <dl className="text-xs text-slate-500">
            <div className="flex justify-between"><dt>Approved fields</dt><dd className="text-mid">{p.approvedFields.map(fieldLabel).join(", ")}</dd></div>
            <div className="flex justify-between"><dt>Withheld by partner</dt><dd className="text-mid">{p.rejectedFields.map(fieldLabel).join(", ") || "—"}</dd></div>
            <div className="flex justify-between"><dt>Authorization hash</dt><dd><Mono>{truncateHex(p.authorizationHash, 10, 8)}</Mono></dd></div>
            <div className="flex justify-between"><dt>Ciphertext digest</dt><dd><Mono>{truncateHex(p.ciphertextDigest, 10, 8)}</Mono></dd></div>
          </dl>
          {!decrypted ? (
            <button
              className="btn btn-primary"
              onClick={async () => {
                try {
                  setDecrypted(await decryptDisclosure(p));
                  setError(null);
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                }
              }}
            >
              Decrypt approved fields (in-browser)
            </button>
          ) : (
            <div className="rounded-lg border border-verified/30 bg-verified-bg p-3">
              <Badge tone="verified">RELEVANT SHIPMENT IDENTIFIED</Badge>
              <dl className="mt-2 space-y-1 text-sm">
                {Object.entries(decrypted).map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-3">
                    <dt className="text-slate-600">
                      {fieldLabel(k)}
                      <Mono className="ml-1.5 text-slate-400">· {k}</Mono>
                    </dt>
                    <dd><Mono>{v}</Mono></dd>
                  </div>
                ))}
              </dl>
              <p className="mt-2 text-[11px] text-slate-500">
                Only the fields the partner individually approved. This narrows
                the trace scope; it does not prove causation or contamination.
              </p>
            </div>
          )}
          {error && <p className="text-xs text-outbreak">{error}</p>}
        </div>
      )}
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-1.5">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-800">{children}</dd>
    </div>
  );
}
