import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { issuePassport, passportCommitment } from "@recalllens/gs1";
import { LABEL_AFFECTED } from "../labels/label-data";
import { api, DEMO_CASE_ID } from "../lib/api";
import { Card, Badge, SectionTitle, Mono, truncateHex } from "../components/ui";
import { RoleBanner } from "../components/RoleBanner";
import { ProofProgress } from "../components/ProofProgress";
import type { SentinelSignal } from "@recalllens/schemas";

/**
 * RecallLens Sentinel — the Early Signal Radar.
 *
 * Detects corroborated, privacy-preserving risk convergence. It does NOT claim
 * to predict or diagnose an outbreak. The demo runs a clearly labeled
 * synthetic pre-outbreak replay; signals belong to their owning roles.
 */
export function Sentinel() {
  const qc = useQueryClient();
  const status = useQuery({
    queryKey: ["sentinel", DEMO_CASE_ID],
    queryFn: () => api.sentinel.status(DEMO_CASE_ID),
    refetchInterval: 3000,
  });

  const [actingRole, setActingRole] = useState<string | null>(null);

  const approve = useMutation({
    mutationFn: (p: { signalId: string; actingOrgId: string }) =>
      api.sentinel.approveSignal(DEMO_CASE_ID, p.signalId, p.actingOrgId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sentinel", DEMO_CASE_ID] }),
  });

  const issueHold = useMutation({
    mutationFn: async () => {
      // Build the hold set from the affected demo passport (deterministic
      // passportId so the printed label matches) — the commitment set is what
      // gets anchored; raw identifiers stay private.
      const passport = await issuePassport({
        ...LABEL_AFFECTED.data,
        passportId: "a11ec7ed0000000000000000000c0de5",
      });
      const commitment = await passportCommitment(passport);
      return api.investigator.issueHold(DEMO_CASE_ID, [commitment]);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sentinel", DEMO_CASE_ID] }),
  });

  const st = status.data;
  const pending = st?.signals.find((s) => s.status === "pending-approval");
  const reached = st?.thresholdReached ?? false;
  const hold = st?.hold ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">
            RecallLens Sentinel — Early Signal Radar
          </h1>
          <p className="text-sm text-slate-500">
            Corroborated, privacy-preserving risk convergence. Not an outbreak
            prediction, and not a diagnosis.
          </p>
        </div>
        <Badge tone={st?.mode === "live-devnet" ? "verified" : "amber"}>
          {st?.mode === "live-devnet" ? "Live Midnight devnet" : "Deterministic fallback"}
        </Badge>
      </div>

      <div className="rounded-lg border border-amber-safety/40 bg-amber-bg px-4 py-2.5 text-xs text-slate-700">
        <Badge tone="amber">Synthetic pre-outbreak replay</Badge>
        <span className="ml-2">{st?.replayBadge}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* Timeline */}
        <Card className="p-5">
          <SectionTitle hint="raw signal evidence stays private">
            Signal timeline
          </SectionTitle>
          <ol className="flex flex-col gap-3">
            {st?.signals.map((s) => (
              <SignalRow
                key={s.signalId}
                signal={s}
                onReview={() => setActingRole(s.ownerOrgId)}
              />
            ))}
          </ol>

          {/* Role-correct approval flow for the pending signal */}
          {pending && actingRole === pending.ownerOrgId && (
            <div className="mt-4 rounded-lg border border-slate-200 p-4">
              <RoleBanner role="partner" />
              <p className="mt-2 text-sm font-semibold text-hi">
                Acting as {pending.ownerName}
              </p>
              <div className="mt-2 rounded-lg bg-surface-muted p-3 text-xs text-slate-600">
                <div className="mb-1 font-semibold uppercase tracking-wide text-slate-500">
                  Signal predicate under review
                </div>
                <p>{pending.summary}</p>
                <p className="mt-2">
                  <strong>Becomes public:</strong> an anonymous sentinel tag, a
                  one-time nullifier, and category counts.{" "}
                  <strong>Stays private:</strong> the raw report contents,
                  reporter identities, exact values and locations.
                </p>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  className="btn btn-primary flex-1"
                  disabled={approve.isPending}
                  onClick={() =>
                    approve.mutate({ signalId: pending.signalId, actingOrgId: pending.ownerOrgId })
                  }
                >
                  {approve.isPending ? "Generating signal proof…" : "Approve final signal proof"}
                </button>
                <button className="btn btn-glass" onClick={() => setActingRole(null)}>
                  Cancel
                </button>
              </div>
              {approve.isPending && (
                <div className="mt-2">
                  <ProofProgress kind="signal" />
                </div>
              )}
              {approve.isError && (
                <p className="mt-2 text-xs text-outbreak">{(approve.error as Error).message}</p>
              )}
            </div>
          )}
        </Card>

        {/* Threshold policy + state */}
        <div className="flex flex-col gap-6">
          <Card className="p-5">
            <SectionTitle>Threshold policy</SectionTitle>
            {st && (
              <ul className="flex flex-col gap-2 text-sm">
                <PolicyRow
                  ok={st.counts.signals >= st.policy.minSignals}
                  label={`≥ ${st.policy.minSignals} valid signal proofs`}
                  value={`${st.counts.signals}`}
                />
                <PolicyRow
                  ok={st.counts.orgs >= st.policy.minOrgs}
                  label={`≥ ${st.policy.minOrgs} independent credentialed organizations`}
                  value={`${st.counts.orgs}`}
                />
                <PolicyRow
                  ok={st.counts.categories >= st.policy.minCategories}
                  label={`≥ ${st.policy.minCategories} different signal categories`}
                  value={`${st.counts.categories}`}
                />
                <PolicyRow
                  ok={st.counts.highConfidence >= 1}
                  label="≥ 1 high-confidence signal"
                  value={`${st.counts.highConfidence}`}
                />
                <PolicyRow ok label="Same private lineage · valid time window" value="✓" />
                <PolicyRow ok label="Duplicate submissions rejected (nullifiers)" value="✓" />
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <SectionTitle>Convergence state</SectionTitle>
            {reached ? (
              <div className="rounded-lg border border-outbreak/40 bg-outbreak-bg p-4">
                <div className="text-sm font-extrabold uppercase tracking-wide text-outbreak">
                  Early risk convergence detected
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  Independent private signals involving the same hidden supply
                  lineage crossed the configured investigation threshold. This
                  is not yet a confirmed outbreak.
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                Threshold not reached — the final signal awaits the owning
                role's review.
              </p>
            )}

            {reached && !hold && (
              <div className="mt-3">
                <div className="mb-2 text-xs font-semibold text-slate-600">
                  CONFIDENTIAL PRECAUTIONARY HOLD READY
                </div>
                <button
                  className="btn btn-primary w-full"
                  disabled={issueHold.isPending}
                  onClick={() => issueHold.mutate()}
                >
                  {issueHold.isPending ? "Anchoring hold…" : "Issue confidential precautionary hold"}
                </button>
                {issueHold.isPending && (
                  <div className="mt-2">
                    <ProofProgress kind="anchor" />
                  </div>
                )}
                {issueHold.isError && (
                  <p className="mt-2 text-xs text-outbreak">{(issueHold.error as Error).message}</p>
                )}
              </div>
            )}

            {hold && (
              <div className="mt-3 rounded-lg border border-verified/30 bg-verified-bg p-3">
                <Badge tone="verified">Precautionary hold active</Badge>
                <dl className="mt-2 space-y-1 text-xs text-slate-600">
                  <div className="flex justify-between"><dt>Hold commitment</dt><dd><Mono>{truncateHex(hold.holdCommitment, 10, 8)}</Mono></dd></div>
                  <div className="flex justify-between"><dt>Passports in hold set</dt><dd>{hold.memberCount}</dd></div>
                  <div className="flex justify-between"><dt>Anchor tx</dt><dd>{hold.txId ? <Mono>{truncateHex(hold.txId, 8, 6)}</Mono> : "fallback mode (no tx)"}</dd></div>
                </dl>
                <p className="mt-2 text-[11px] text-slate-500">
                  Matching downstream partners receive confidential hold
                  requests; consumers scanning an affected passport now see
                  that it matches this Midnight-anchored hold — not an
                  official recall.
                </p>
                <Link to="/consumer" className="btn btn-glass mt-2 w-full text-xs">
                  → Scan the lettuce passport as a consumer
                </Link>
              </div>
            )}
          </Card>

          {/* Collapsible technical drawer */}
          <details className="glass rounded-xl p-4 text-xs text-slate-500">
            <summary className="cursor-pointer font-semibold text-slate-600">
              How Midnight verified this
            </summary>
            <div className="mt-2 space-y-1">
              <p>
                Each signal binds a registered credential, a signed private
                record, its category and time window, and the hidden lineage
                token inside a zero-knowledge circuit. The public ledger records
                only: the anonymous sentinel tag, per-organization nullifiers,
                category counts, threshold state, and the hold commitment.
              </p>
              {st?.signals
                .filter((s) => s.status === "proven")
                .map((s) => (
                  <div key={s.signalId} className="flex justify-between">
                    <span>{s.category}</span>
                    <span>
                      {s.txId
                        ? `tx ${s.txId.slice(0, 10)}…`
                        : s.preSubmitted
                          ? "previously verified during demo setup"
                          : "fallback (no tx)"}
                    </span>
                  </div>
                ))}
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

function SignalRow({ signal, onReview }: { signal: SentinelSignal; onReview: () => void }) {
  const tone =
    signal.status === "proven" ? "verified" : signal.status === "rejected" ? "outbreak" : "amber";
  return (
    <li className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5">
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold text-hi">
          <span className="text-xs text-slate-400">Day {signal.dayOffset}</span>
          {signal.category.replace(/_/g, " ")}
          {signal.highConfidence && <Badge tone="info">high-confidence</Badge>}
        </div>
        <p className="mt-0.5 text-xs text-slate-500">{signal.summary}</p>
        <p className="mt-0.5 text-[10px] text-slate-400">Owner: {signal.ownerName}</p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <Badge tone={tone}>
          {signal.status === "proven" ? "privately verified" : signal.status}
        </Badge>
        {signal.status === "pending-approval" && (
          <button className="btn btn-glass px-2 py-1 text-[11px]" onClick={onReview}>
            Review as owner →
          </button>
        )}
      </div>
    </li>
  );
}

function PolicyRow({ ok, label, value }: { ok: boolean; label: string; value: string }) {
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-2 text-slate-600">
        <span
          className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold"
          style={{
            background: ok ? "color-mix(in oklab, var(--verified) 20%, transparent)" : "var(--glass-fill)",
            color: ok ? "var(--verified)" : "var(--text-lo)",
          }}
        >
          {ok ? "✓" : "·"}
        </span>
        {label}
      </span>
      <Mono>{value}</Mono>
    </li>
  );
}
