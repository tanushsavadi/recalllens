import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  organizations,
  affectedEvents,
  cleanEvents,
  SYNTHETIC_LABEL,
} from "@recalllens/demo-fixtures";
import type { TraceEvent } from "@recalllens/schemas";
import { api, DEMO_CASE_ID } from "../lib/api";
import {
  Card,
  Badge,
  SectionTitle,
  SyntheticBadge,
  Mono,
  truncateHex,
} from "../components/ui";

export function PartnerVault() {
  const qc = useQueryClient();
  const [activeOrgId, setActiveOrgId] = useState(organizations[0].orgId);
  const activeOrg = organizations.find((o) => o.orgId === activeOrgId)!;

  const status = useQuery({
    queryKey: ["case", DEMO_CASE_ID],
    queryFn: () => api.caseStatus(DEMO_CASE_ID),
    refetchInterval: 3000,
  });

  const prove = useMutation({
    mutationFn: (orgId: string) => api.submitProof(DEMO_CASE_ID, orgId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["case", DEMO_CASE_ID] }),
  });

  const orgEvents = useMemo(() => {
    const evs: TraceEvent[] = [];
    if (affectedEvents[activeOrgId]) evs.push(affectedEvents[activeOrgId]);
    if (cleanEvents[activeOrgId]) evs.push(cleanEvents[activeOrgId]);
    return evs;
  }, [activeOrgId]);

  const proof = status.data?.proofs.find((p) => p.orgId === activeOrgId);
  const confirmed = proof?.stage === "confirmed";
  const canProve = !!affectedEvents[activeOrgId];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Partner Vault</h1>
          <p className="text-sm text-slate-500">
            Each organization's private EPCIS records stay local. Only a hiding
            commitment and, after a match, an anonymous tag + nullifier become
            public.
          </p>
        </div>
        <SyntheticBadge />
      </div>

      {/* Role switcher */}
      <div className="flex flex-wrap gap-2">
        {organizations.map((o) => (
          <button
            key={o.orgId}
            onClick={() => setActiveOrgId(o.orgId)}
            className={
              o.orgId === activeOrgId
                ? "btn-primary"
                : "btn-ghost"
            }
          >
            {o.name}
            <span className="ml-1 text-[10px] uppercase opacity-60">
              {o.role}
            </span>
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card className="p-5">
          <SectionTitle hint={SYNTHETIC_LABEL}>
            {activeOrg.name} — local EPCIS event ledger
          </SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3">Biz step</th>
                  <th className="py-2 pr-3">Lot</th>
                  <th className="py-2 pr-3">Product</th>
                  <th className="py-2 pr-3">Qty</th>
                  <th className="py-2 pr-3">Event time</th>
                  <th className="py-2">Lineage</th>
                </tr>
              </thead>
              <tbody>
                {orgEvents.map((ev) => (
                  <tr key={ev.eventId} className="border-b border-slate-100">
                    <td className="py-2 pr-3 capitalize">{ev.bizStep}</td>
                    <td className="py-2 pr-3">
                      <Mono>{ev.lotCode}</Mono>
                    </td>
                    <td className="py-2 pr-3">{ev.productGtin}</td>
                    <td className="py-2 pr-3 tabular-nums">
                      {ev.quantity} {ev.quantityUom}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-slate-500">
                      {ev.eventTime.slice(0, 10)}
                    </td>
                    <td className="py-2">
                      <Mono>{truncateHex(ev.lineageToken, 6, 4)}</Mono>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 rounded-md bg-surface-muted px-3 py-2 text-xs text-slate-500">
            These rows never leave the browser vault. The GTIN is a public
            product identifier; supplier/destination GLNs, lot codes, quantities,
            and the raw lineage token are private.
          </p>
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="p-5">
            <SectionTitle>Run private match</SectionTitle>
            {proof && (
              <div className="mb-3">
                <Badge
                  tone={
                    confirmed
                      ? "verified"
                      : proof.stage === "failed"
                        ? "outbreak"
                        : proof.stage === "queued"
                          ? "neutral"
                          : "amber"
                  }
                >
                  {proof.stage}
                </Badge>
              </div>
            )}
            <button
              className="btn-primary w-full"
              disabled={!canProve || confirmed || prove.isPending}
              onClick={() => prove.mutate(activeOrgId)}
            >
              {confirmed
                ? "Proof confirmed on-chain"
                : prove.isPending
                  ? "Proving…"
                  : canProve
                    ? "Prove this record matches the case"
                    : "No affected record for this org"}
            </button>
            {prove.isError && (
              <p className="mt-2 text-xs text-outbreak">
                {(prove.error as Error).message}
              </p>
            )}
            {proof?.txId && (
              <p className="mt-2 text-xs text-slate-500">
                tx <Mono>{truncateHex(proof.txId, 8, 8)}</Mono>
              </p>
            )}
          </Card>

          <Card className="p-5">
            <SectionTitle>What stays private / becomes public</SectionTitle>
            <div className="space-y-3 text-sm">
              <div>
                <Badge tone="amber">Stays private</Badge>
                <p className="mt-1 text-slate-600">
                  Supplier &amp; customer GLNs, lot code, quantity, route,
                  temperatures, and the raw 256-bit lineage token — held only in
                  this vault.
                </p>
              </div>
              <div>
                <Badge tone="verified">Becomes public on match</Badge>
                <p className="mt-1 text-slate-600">
                  A case-scoped anonymous lineage tag and an organization
                  nullifier (both hashes of high-entropy secrets), plus the fact
                  that the verified match count increased by one.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
