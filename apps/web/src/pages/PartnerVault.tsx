import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  organizations,
  affectedEvents,
  cleanEvents,
  SYNTHETIC_LABEL,
} from "@recalllens/demo-fixtures";
import type { TraceEvent } from "@recalllens/schemas";
import { encryptDisclosure } from "@recalllens/gs1";
import { api, DEMO_CASE_ID } from "../lib/api";
import {
  Card,
  Badge,
  SectionTitle,
  SyntheticBadge,
  Mono,
  truncateHex,
} from "../components/ui";
import { RoleBanner } from "../components/RoleBanner";
import { ScanProduct } from "../components/ScanProduct";
import { ProofProgress } from "../components/ProofProgress";

const DISCLOSABLE = ["sourceGln", "lotCode", "eventDate", "destinationGln"] as const;
type DiscField = (typeof DISCLOSABLE)[number];

/** Human-readable display labels for disclosure fields. Display-only: the
 * underlying EPCIS/GS1 payload keys, schema, and encryption are unchanged. */
export const DISCLOSURE_FIELD_LABELS: Record<DiscField, string> = {
  sourceGln: "Origin facility",
  lotCode: "Shipment lot",
  eventDate: "Shipment date",
  destinationGln: "Destination facility",
};

export function PartnerVault() {
  const qc = useQueryClient();
  const [activeOrgId, setActiveOrgId] = useState(organizations[0].orgId);
  const activeOrg = organizations.find((o) => o.orgId === activeOrgId)!;

  const requests = useQuery({
    queryKey: ["requests", DEMO_CASE_ID],
    queryFn: () => api.investigator.matchRequests(DEMO_CASE_ID),
    refetchInterval: 3000,
  });
  const myRequest = requests.data?.requests.find((r) => r.orgId === activeOrgId);

  const scan = useMutation({
    mutationFn: (f: { gtin: string; lot: string }) =>
      api.partner.scan(DEMO_CASE_ID, activeOrgId, f.gtin, f.lot),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["requests", DEMO_CASE_ID] }),
  });
  const approve = useMutation({
    mutationFn: () => api.partner.approve(DEMO_CASE_ID, activeOrgId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["requests", DEMO_CASE_ID] });
      qc.invalidateQueries({ queryKey: ["case", DEMO_CASE_ID] });
    },
  });
  const reject = useMutation({
    mutationFn: () => api.partner.reject(DEMO_CASE_ID, activeOrgId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["requests", DEMO_CASE_ID] }),
  });

  const orgEvents = useMemo(() => {
    const evs: TraceEvent[] = [];
    if (affectedEvents[activeOrgId]) evs.push(affectedEvents[activeOrgId]);
    if (cleanEvents[activeOrgId]) evs.push(cleanEvents[activeOrgId]);
    return evs;
  }, [activeOrgId]);

  const status = myRequest?.status ?? "none";
  const showScan = status === "requested";
  const showApprove = status === "scanned";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Partner Vault</h1>
          <p className="text-sm text-slate-500">
            Only your own records. Proofs run only after you scan your shipment
            label and explicitly approve.
          </p>
        </div>
        <SyntheticBadge />
      </div>
      <RoleBanner role="partner" />

      {/* Role switcher */}
      <div className="flex flex-wrap gap-2">
        {organizations.map((o) => (
          <button
            key={o.orgId}
            onClick={() => {
              setActiveOrgId(o.orgId);
              scan.reset();
              approve.reset();
            }}
            className={o.orgId === activeOrgId ? "btn btn-primary" : "btn btn-glass"}
          >
            {o.name}
            <span className="ml-1 text-[10px] uppercase opacity-60">{o.role}</span>
          </button>
        ))}
      </div>

      {/* items-start: the ledger card sizes to its contents instead of
          stretching to match the (often much taller) right column. */}
      <div className="grid items-start gap-6 lg:grid-cols-[1.5fr_1fr]">
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
                    <td className="py-2 pr-3"><Mono>{ev.lotCode}</Mono></td>
                    <td className="py-2 pr-3">{ev.productGtin}</td>
                    <td className="py-2 pr-3 tabular-nums">{ev.quantity} {ev.quantityUom}</td>
                    <td className="py-2 pr-3 tabular-nums text-slate-500">{ev.eventTime.slice(0, 10)}</td>
                    <td className="py-2"><Mono>{truncateHex(ev.lineageToken, 6, 4)}</Mono></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 rounded-md bg-surface-muted px-3 py-2 text-xs text-slate-500">
            These rows never leave this vault. Other partners and the
            investigator cannot see them.
          </p>
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="p-5">
            <SectionTitle>Private-match request</SectionTitle>
            {status === "none" && (
              <p className="text-sm text-slate-500">
                No pending request from the investigator for {activeOrg.name}.
              </p>
            )}
            {myRequest && status !== "none" && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Badge
                    tone={
                      status === "proven" ? "verified" : status === "rejected" ? "outbreak" : "amber"
                    }
                  >
                    {status}
                  </Badge>
                  {status === "proven" && (
                    <span className="text-[10px] text-slate-400">
                      {myRequest.txId ? (
                        <>tx <Mono>{truncateHex(myRequest.txId, 6, 6)}</Mono></>
                      ) : myRequest.preSubmitted ? (
                        "previously verified during demo setup"
                      ) : (
                        "no tx (fallback mode)"
                      )}
                    </span>
                  )}
                </div>

                {/* The exact predicate under review */}
                <div className="rounded-lg border border-slate-200 p-3 text-xs text-slate-600">
                  <div className="mb-1 font-semibold uppercase tracking-wide text-slate-500">
                    Requested predicate
                  </div>
                  <p>{myRequest.predicate.description}</p>
                  <dl className="mt-2 space-y-0.5">
                    <div className="flex justify-between"><dt>Product GTIN</dt><dd><Mono>{myRequest.predicate.productGtin}</Mono></dd></div>
                    <div className="flex justify-between"><dt>Window</dt><dd>{myRequest.predicate.windowStart.slice(0, 10)} → {myRequest.predicate.windowEnd.slice(0, 10)}</dd></div>
                  </dl>
                </div>

                {showScan && (
                  <>
                    <p className="text-xs font-semibold text-slate-600">
                      Step 1 — scan your shipment/product label to locate your
                      committed record:
                    </p>
                    <ScanProduct
                      onConfirm={(f) => scan.mutate({ gtin: f.gtin, lot: f.lot ?? "" })}
                    />
                    {scan.isError && (
                      <p className="text-xs text-outbreak">{(scan.error as Error).message}</p>
                    )}
                  </>
                )}

                {showApprove && (
                  <div className="flex flex-col gap-2">
                    <div className="rounded-lg border border-verified/30 bg-verified-bg p-3 text-xs">
                      <div className="font-semibold text-verified-fg">Committed record located</div>
                      {scan.data && (
                        <p className="mt-1 text-verified-fg/90">
                          {scan.data.record.bizStep} · lot <Mono>{scan.data.record.lotCode}</Mono> ·{" "}
                          {scan.data.record.eventTime.slice(0, 10)}
                        </p>
                      )}
                      <p className="mt-2 text-slate-600">
                        <strong>Becomes public:</strong> an anonymous case tag +
                        a one-time nullifier + the verified count.{" "}
                        <strong>Stays private:</strong> this record, your
                        identity, partners, quantities, routes.
                      </p>
                    </div>
                    <button
                      className="btn btn-primary"
                      disabled={approve.isPending}
                      onClick={() => approve.mutate()}
                    >
                      {approve.isPending
                        ? "Generating your private proof…"
                        : "Approve and generate private proof"}
                    </button>
                    {approve.isPending && <ProofProgress />}
                    <button
                      className="btn btn-glass"
                      disabled={approve.isPending}
                      onClick={() => reject.mutate()}
                    >
                      Reject request
                    </button>
                    {approve.isError && (
                      <p className="text-xs text-outbreak">{(approve.error as Error).message}</p>
                    )}
                  </div>
                )}

                {status === "proven" && (
                  <p className="rounded-md bg-verified-bg px-3 py-2 text-xs text-verified-fg">
                    Your proof settled on Midnight. The investigator sees only
                    the anonymous result.
                  </p>
                )}
              </div>
            )}
          </Card>

          <DisclosurePanel orgId={activeOrgId} proven={status === "proven"} />
          <RemovalPanel orgId={activeOrgId} />
        </div>
      </div>
    </div>
  );
}

/**
 * Field-by-field disclosure approval + in-browser encryption.
 *
 * Idempotency: the "sent" state is SERVER-DRIVEN (does a package exist for
 * this case+org?), so a reload can never re-enable the send button. The
 * server also rejects duplicate sends for the same case+org.
 */
function DisclosurePanel({ orgId, proven }: { orgId: string; proven: boolean }) {
  const qc = useQueryClient();
  const [approved, setApproved] = useState<Record<DiscField, boolean>>({
    sourceGln: true,
    lotCode: true,
    eventDate: true,
    destinationGln: false,
  });
  const [error, setError] = useState<string | null>(null);

  const existing = useQuery({
    queryKey: ["disclosure-package"],
    queryFn: () => api.investigator.getDisclosurePackage(),
    refetchInterval: 5000,
  });
  const sent = existing.data?.package?.orgId === orgId;

  const ev = affectedEvents[orgId];

  async function encryptAndSend() {
    try {
      const fields: Record<string, string> = {};
      if (approved.sourceGln) fields.sourceGln = ev.sourceGln;
      if (approved.lotCode) fields.lotCode = ev.lotCode;
      if (approved.eventDate) fields.eventDate = ev.eventTime.slice(0, 10);
      if (approved.destinationGln) fields.destinationGln = ev.destinationGln;
      const enc = await encryptDisclosure(fields);
      const approvedList = DISCLOSABLE.filter((f) => approved[f]);
      const rejectedList = DISCLOSABLE.filter((f) => !approved[f]);
      // authorization hash binds case+org+field set (computed in-browser)
      const canonical = JSON.stringify({
        sep: "rl:disclosure:v1",
        caseId: DEMO_CASE_ID,
        orgId,
        fields: approvedList.slice().sort(),
        approved: true,
      });
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(canonical),
      );
      const authorizationHash = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      await api.partner.sendDisclosurePackage({
        caseId: DEMO_CASE_ID,
        orgId,
        approvedFields: approvedList,
        rejectedFields: rejectedList,
        ciphertext: enc.ciphertext,
        iv: enc.iv,
        ephemeralPublicKey: enc.ephemeralPublicKey,
        authorizationHash,
        ciphertextDigest: enc.ciphertextDigest,
        createdAt: new Date().toISOString(),
      });
      qc.invalidateQueries({ queryKey: ["disclosure-package"] });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  if (!ev) return null;
  return (
    <Card className="p-5">
      <SectionTitle hint="each field individually">Selective disclosure</SectionTitle>
      {!proven ? (
        <p className="text-sm text-slate-500">
          Available after your proof settles — disclosure always follows
          verification, never precedes it.
        </p>
      ) : sent ? (
        <div className="rounded-md bg-verified-bg px-3 py-2 text-xs text-verified-fg">
          <div className="font-semibold">Encrypted package sent</div>
          <p className="mt-1">
            Only ciphertext left this browser; the investigator decrypts the
            approved fields with their own key.
          </p>
          {existing.data?.package && (
            <dl className="mt-2 space-y-0.5 text-[11px] text-slate-500">
              <div className="flex justify-between">
                <dt>Authorization hash</dt>
                <dd><Mono>{truncateHex(existing.data.package.authorizationHash, 8, 6)}</Mono></dd>
              </div>
              <div className="flex justify-between">
                <dt>Ciphertext digest</dt>
                <dd><Mono>{truncateHex(existing.data.package.ciphertextDigest, 8, 6)}</Mono></dd>
              </div>
            </dl>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {DISCLOSABLE.map((f) => (
            <label key={f} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <span>
                <span className="font-medium text-hi">{DISCLOSURE_FIELD_LABELS[f]}</span>
                <Mono className="ml-1.5 text-slate-400">· {f}</Mono>
                <span className="ml-2 text-xs text-slate-400">
                  {f === "sourceGln" && ev.sourceGln}
                  {f === "lotCode" && ev.lotCode}
                  {f === "eventDate" && ev.eventTime.slice(0, 10)}
                  {f === "destinationGln" && "— withheld by partner"}
                </span>
              </span>
              <input
                type="checkbox"
                checked={approved[f]}
                onChange={(e) => setApproved((s) => ({ ...s, [f]: e.target.checked }))}
              />
            </label>
          ))}
          <button className="btn btn-primary" onClick={encryptAndSend}>
            Encrypt approved fields for the investigator
          </button>
          {error && <p className="text-xs text-outbreak">{error}</p>}
          <p className="text-[11px] text-slate-500">
            ECDH + AES-GCM in this browser. Unchecked fields never enter the
            plaintext, so they cannot be decrypted later.
          </p>
        </div>
      )}
    </Card>
  );
}

/**
 * Removal confirmation — a PARTNER-REPORTED attestation. The evidence basis
 * comes from the server and is shown verbatim: it is off-chain and not
 * cryptographically verified, and the UI must never overclaim it.
 */
function RemovalPanel({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const removal = useQuery({ queryKey: ["removal"], queryFn: api.removal, refetchInterval: 5000 });
  const confirm = useMutation({
    mutationFn: () => api.partner.confirmRemoval(orgId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["removal"] }),
  });
  const mine = removal.data?.removal?.confirmedBy.includes(orgId) ?? false;
  return (
    <Card className="p-5">
      <SectionTitle hint="off-chain attestation">Removal confirmation</SectionTitle>
      {mine ? (
        <div>
          <Badge tone="verified">Partner-reported quarantine/removal</Badge>
          <p className="mt-2 text-[11px] text-slate-500">
            {removal.data?.removal?.evidenceBasis}
          </p>
        </div>
      ) : (
        <button className="btn btn-glass w-full" onClick={() => confirm.mutate()} disabled={confirm.isPending}>
          Report quarantine / removal of affected inventory
        </button>
      )}
      {removal.data?.removal?.completedAt && (
        <p className="mt-2 text-xs text-verified-fg">
          All affected partners have reported removal.
        </p>
      )}
    </Card>
  );
}
