import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { ConvergenceGraph } from "../components/ConvergenceGraph";
import { RecallImpact } from "../components/RecallImpact";
import { DisclosureRoom } from "../components/DisclosureRoom";
import type { OrgProof } from "@recalllens/schemas";

export function InvestigationWorkspace() {
  const qc = useQueryClient();
  const status = useQuery({
    queryKey: ["case", DEMO_CASE_ID],
    queryFn: () => api.caseStatus(DEMO_CASE_ID),
    refetchInterval: 3000,
  });

  const prove = useMutation({
    mutationFn: (orgId: string) => api.submitProof(DEMO_CASE_ID, orgId),
    onSuccess: (res) => {
      // Write the authoritative post-proof state into the cache immediately so
      // the "next org" advances before the next poll (prevents re-submitting
      // the same org on rapid clicks).
      qc.setQueryData(["case", DEMO_CASE_ID], (prev: typeof status.data) =>
        prev
          ? { ...prev, chain: res.chain, proofs: res.proof
              ? prev.proofs.map((p) => (p.orgId === res.proof.orgId ? res.proof : p))
              : prev.proofs }
          : prev,
      );
      qc.invalidateQueries({ queryKey: ["case", DEMO_CASE_ID] });
    },
  });

  const proofs = status.data?.proofs ?? [];
  const chain = status.data?.chain;
  const converged = chain?.converged ?? false;

  const nextOrg = useMemo(
    () => proofs.find((p) => p.stage !== "confirmed"),
    [proofs],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">
            Investigation Workspace
          </h1>
          <p className="text-sm text-slate-500">
            Three independent organizations privately prove their records
            intersect the same outbreak lineage.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SyntheticBadge />
          <Badge tone={status.data?.mode === "live-devnet" ? "verified" : "amber"}>
            {status.data?.mode === "live-devnet"
              ? "Live Midnight devnet"
              : "Deterministic fallback"}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card className="p-5">
          <SectionTitle hint="proof segments appear as proofs confirm">
            Private supply-chain convergence
          </SectionTitle>
          <div className="h-[460px] w-full overflow-hidden rounded-lg border border-slate-200 bg-midnight-950">
            <ConvergenceGraph proofs={proofs} converged={converged} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500">
            <LegendDot className="bg-slate-500" label="Pending organization" />
            <LegendDot className="bg-amber-safety" label="Proving…" />
            <LegendDot className="bg-verified" label="Verified proof segment" />
            <span>Organizations are shown anonymized — no real identities.</span>
          </div>
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
                value={converged ? "CONVERGED" : "Building"}
                tone={converged ? "verified" : "default"}
              />
            </div>

            {converged ? (
              <div className="mt-4 rounded-lg border border-verified/30 bg-verified-bg p-4">
                <div className="text-sm font-extrabold uppercase tracking-wide text-verified-fg">
                  Common lineage verified
                </div>
                <ul className="mt-1 space-y-0.5 text-sm text-verified-fg">
                  <li>3 independent credentialed organizations</li>
                  <li>0 raw partner records written to the public ledger</li>
                </ul>
                <p className="mt-2 text-xs text-verified-fg/80">
                  RecallLens proved that three authenticated private supply
                  records converge on the same lineage. Epidemiological and
                  laboratory evidence determines whether that lineage caused the
                  outbreak.
                </p>
              </div>
            ) : (
              <button
                className="btn-primary mt-4 w-full"
                disabled={!nextOrg || prove.isPending}
                onClick={() => nextOrg && prove.mutate(nextOrg.orgId)}
              >
                {prove.isPending
                  ? "Generating proof…"
                  : nextOrg
                    ? `Run private match — ${nextOrg.orgName}`
                    : "All proofs submitted"}
              </button>
            )}
            {prove.isError && (
              <p className="mt-2 text-xs text-outbreak">
                {(prove.error as Error).message}
              </p>
            )}
          </Card>

          <Card className="p-5">
            <SectionTitle>Organization proofs</SectionTitle>
            <ol className="flex flex-col gap-2">
              {proofs.map((p) => (
                <ProofRow key={p.orgId} proof={p} />
              ))}
            </ol>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-5">
          <SectionTitle>Public ledger — what was recorded</SectionTitle>
          <dl className="flex flex-col gap-1.5 text-sm">
            <Row label="Contract">
              <Mono>{truncateHex(chain?.contractAddress, 10, 8)}</Mono>
            </Row>
            <Row label="Case tag (anonymous lineage)">
              <Mono>{truncateHex(chain?.caseTag)}</Mono>
            </Row>
            <Row label="Distinct-org nullifiers">
              <span>{chain?.nullifiers.length ?? 0}</span>
            </Row>
            <Row label="Anchored event commitments">
              <span>{chain?.eventCommitmentCount ?? 0}</span>
            </Row>
            <Row label="Registered org credentials">
              <span>{chain?.registeredOrgCount ?? 0}</span>
            </Row>
          </dl>
          <p className="mt-3 text-xs text-slate-500">
            Every value above is an opaque hash or a count. No supplier names,
            lot codes, quantities, routes, or invoices appear.
          </p>
        </Card>

        <Card className="p-5">
          <SectionTitle>Nullifiers prevent inflation</SectionTitle>
          <p className="text-sm text-slate-600">
            Each proof derives a nullifier from the organization's{" "}
            <strong>registered credential secret</strong>, not from a
            caller-chosen value. One organization cannot count more than once for
            a case, and three matches cannot come from a single credential.
          </p>
          <div className="mt-3 space-y-1.5">
            {(chain?.nullifiers ?? []).map((n, i) => (
              <div
                key={n}
                className="flex items-center gap-2 rounded bg-surface-muted px-2 py-1.5 text-xs"
              >
                <Badge tone="verified">#{i + 1}</Badge>
                <Mono>{truncateHex(n, 12, 10)}</Mono>
              </div>
            ))}
            {(chain?.nullifiers.length ?? 0) === 0 && (
              <p className="text-xs text-slate-400">No nullifiers yet.</p>
            )}
          </div>
        </Card>
      </div>

      <RecallImpact />

      <DisclosureRoom proofs={proofs} />
    </div>
  );
}

function ProofRow({ proof }: { proof: OrgProof }) {
  const tone =
    proof.stage === "confirmed"
      ? "verified"
      : proof.stage === "failed"
        ? "outbreak"
        : proof.stage === "queued"
          ? "neutral"
          : "amber";
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
      <div>
        <div className="text-sm font-semibold text-hi">
          {proof.orgName}
        </div>
        <div className="text-xs capitalize text-slate-500">{proof.role}</div>
      </div>
      <div className="text-right">
        <Badge tone={tone}>{proof.stage}</Badge>
        {proof.txId && (
          <div className="mt-1 text-[10px] text-slate-400">
            tx <Mono>{truncateHex(proof.txId, 6, 6)}</Mono>
            {proof.preSubmitted && " · pre-submitted"}
          </div>
        )}
      </div>
    </li>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-1.5 last:border-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-800">{children}</dd>
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${className}`} />
      {label}
    </span>
  );
}
