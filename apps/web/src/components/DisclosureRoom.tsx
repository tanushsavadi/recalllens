import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api, DEMO_CASE_ID } from "../lib/api";
import { Card, SectionTitle, Badge, Mono, truncateHex } from "./ui";
import type { OrgProof } from "@recalllens/schemas";

const REQUESTABLE_FIELDS = [
  "sourceGln",
  "destinationGln",
  "lotCode",
  "eventTime",
  "quantity",
] as const;

/**
 * Selective Disclosure Case Room (P1). The investigator requests specific
 * minimum fields; the partner approves or rejects; approval produces an
 * authorization hash. Honest limitation is stated in the UI: this records an
 * authorization, it does not encrypt/deliver plaintext to one recipient.
 */
export function DisclosureRoom({ proofs }: { proofs: OrgProof[] }) {
  const confirmed = proofs.filter((p) => p.stage === "confirmed");
  const [orgId, setOrgId] = useState(confirmed[0]?.orgId ?? proofs[0]?.orgId ?? "");
  const [fields, setFields] = useState<string[]>(["lotCode", "sourceGln"]);

  const authorize = useMutation({
    mutationFn: (approved: boolean) =>
      api.authorizeDisclosure(DEMO_CASE_ID, orgId, fields, approved),
  });

  const toggle = (f: string) =>
    setFields((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f],
    );

  const orgName =
    proofs.find((p) => p.orgId === orgId)?.orgName ?? "Select an organization";

  return (
    <Card className="p-5">
      <SectionTitle hint="P1 — authorization record, not encrypted delivery">
        Selective disclosure case room
      </SectionTitle>
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className="stat-label" htmlFor="disclosure-org">
            Organization
          </label>
          <select
            id="disclosure-org"
            name="disclosure-org"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={orgId}
            onChange={(e) => {
              setOrgId(e.target.value);
              authorize.reset();
            }}
          >
            {proofs.map((p) => (
              <option key={p.orgId} value={p.orgId}>
                {p.orgName} ({p.role})
              </option>
            ))}
          </select>

          <div className="mt-3">
            <span className="stat-label">Investigator requests (minimum fields)</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {REQUESTABLE_FIELDS.map((f) => (
                <button
                  key={f}
                  onClick={() => {
                    toggle(f);
                    authorize.reset();
                  }}
                  className={
                    "rounded-full px-3 py-1 text-xs font-semibold " +
                    (fields.includes(f)
                      ? "bg-midnight-800 text-white"
                      : "bg-slate-100 text-slate-600")
                  }
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              className="btn-primary"
              disabled={!orgId || fields.length === 0 || authorize.isPending}
              onClick={() => authorize.mutate(true)}
            >
              Partner approves
            </button>
            <button
              className="btn-ghost"
              disabled={!orgId || authorize.isPending}
              onClick={() => authorize.mutate(false)}
            >
              Partner rejects
            </button>
          </div>
        </div>

        <div>
          <span className="stat-label">Authorization record</span>
          {authorize.data ? (
            <div className="mt-2 rounded-lg border border-slate-200 p-3 text-sm">
              <div className="flex items-center gap-2">
                <Badge tone={authorize.data.approved ? "verified" : "outbreak"}>
                  {authorize.data.approved ? "Approved" : "Rejected"}
                </Badge>
                <span className="text-slate-600">{orgName}</span>
              </div>
              <div className="mt-2 text-xs text-slate-500">Requested fields</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {authorize.data.requestedFields.map((f) => (
                  <Mono key={f} className="rounded bg-surface-muted px-1.5 py-0.5">
                    {f}
                  </Mono>
                ))}
              </div>
              <div className="mt-2 text-xs text-slate-500">Authorization hash</div>
              <Mono className="break-all">{truncateHex(authorize.data.authorizationHash, 16, 12)}</Mono>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-400">
              Choose fields and approve/reject to produce an authorization hash.
            </p>
          )}
          <p className="mt-3 text-xs text-slate-500">
            Honest limitation: this records an authorization binding the case,
            organization, and approved field set. It does not encrypt or deliver
            the private plaintext to one recipient — Compact's disclose() does
            not encrypt, and encrypted delivery is future work.
          </p>
        </div>
      </div>
    </Card>
  );
}
