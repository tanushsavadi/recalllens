import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { receipts, AFFECTED_LINEAGE_TOKEN } from "@recalllens/demo-fixtures";
import type { ScanCheckResponse } from "@recalllens/schemas";
import type { Gs1Data } from "@recalllens/gs1";
import { api, DEMO_CASE_ID } from "../lib/api";
import { Card, Badge, SectionTitle, SyntheticBadge, Mono, truncateHex } from "../components/ui";
import { ScanProduct } from "../components/ScanProduct";

type Tab = "scan" | "receipt";

export function ConsumerCheck() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("scan");
  const [receiptId, setReceiptId] = useState(receipts[0].receiptId);
  const [scanFields, setScanFields] = useState<(Gs1Data & { method: string }) | null>(null);

  const receiptCheck = useMutation({
    mutationFn: (id: string) => api.consumerCheck(id, DEMO_CASE_ID),
  });

  const scanCheck = useMutation({
    mutationFn: (f: Gs1Data) => api.scanCheck(DEMO_CASE_ID, f.gtin, f.lot ?? "", f.expiry),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["case", DEMO_CASE_ID] }),
  });

  const receipt = receipts.find((r) => r.receiptId === receiptId)!;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Consumer Check</h1>
          <p className="text-sm text-slate-500">
            Privately check whether your purchase intersects the verified affected
            lineage.
          </p>
        </div>
        <SyntheticBadge />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-surface-muted p-1">
        <TabButton active={tab === "scan"} onClick={() => setTab("scan")}>
          Scan a product
        </TabButton>
        <TabButton active={tab === "receipt"} onClick={() => setTab("receipt")}>
          Use a receipt
        </TabButton>
      </div>

      {tab === "scan" && !scanCheck.data && (
        <Card className="p-5">
          <SectionTitle hint="local processing only">Scan the label</SectionTitle>
          <ScanProduct
            onConfirm={(f) => {
              setScanFields(f);
              scanCheck.mutate(f);
            }}
          />
        </Card>
      )}

      {tab === "scan" && (scanCheck.isPending || scanCheck.data) && (
        <ScanResult
          fields={scanFields}
          pending={scanCheck.isPending}
          data={scanCheck.data}
          onReset={() => {
            scanCheck.reset();
            setScanFields(null);
          }}
        />
      )}

      {tab === "receipt" && (
        <>
          <Card className="p-5">
            <SectionTitle>Select a receipt</SectionTitle>
            <div className="flex flex-col gap-2">
              {receipts.map((r) => (
                <label
                  key={r.receiptId}
                  className={
                    "flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm " +
                    (r.receiptId === receiptId
                      ? "border-midnight-700 bg-surface-muted"
                      : "border-slate-200")
                  }
                >
                  <input
                    type="radio"
                    name="receipt"
                    className="mt-1"
                    checked={r.receiptId === receiptId}
                    onChange={() => {
                      setReceiptId(r.receiptId);
                      receiptCheck.reset();
                    }}
                  />
                  <div>
                    <div className="font-semibold">{r.merchantName}</div>
                    <div className="text-xs text-slate-500">
                      {r.items.map((i) => i.description).join(", ")} ·{" "}
                      {r.purchasedAt.slice(0, 10)}
                    </div>
                  </div>
                </label>
              ))}
            </div>
            <button
              className="btn-primary mt-4 w-full"
              disabled={receiptCheck.isPending}
              onClick={() => receiptCheck.mutate(receiptId)}
            >
              {receiptCheck.isPending
                ? "Checking privately…"
                : "Check against affected lineage"}
            </button>
            <p className="mt-2 text-xs text-slate-500">
              The receipt's lineage token is checked for intersection with the
              verified affected lineage. Your identity and purchase details are
              not published.
            </p>
          </Card>

          {receiptCheck.data && (
            <ResultCard
              affected={receiptCheck.data.affected}
              title={
                receiptCheck.data.affected
                  ? "Affected purchase detected"
                  : "No verified intersection found"
              }
              message={receiptCheck.data.message}
              guidance={receiptCheck.data.guidance}
              sourceUrl={receiptCheck.data.sourceUrl}
              footer={`This is not a medical diagnosis. Receipt: ${receipt.merchantName}.`}
            />
          )}
        </>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "flex-1 rounded-full px-3 py-2 text-sm font-semibold transition-colors " +
        (active
          ? "bg-[color-mix(in_oklab,var(--accent)_22%,transparent)] text-accent"
          : "text-mid hover:text-hi")
      }
    >
      {children}
    </button>
  );
}

function ScanResult({
  fields,
  pending,
  data,
  onReset,
}: {
  fields: (Gs1Data & { method: string }) | null;
  pending: boolean;
  data?: ScanCheckResponse;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* Sealed proof card — the raw fields collapse into a sealed commitment. */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between bg-midnight-950 px-4 py-2 text-xs text-white">
          <span className="font-semibold">Sealed proof card</span>
          <Badge tone="verified">🔒 fields kept local</Badge>
        </div>
        <div className="grid grid-cols-3 gap-2 p-4 text-sm">
          <SealedField label="GTIN" value={fields?.gtin} sealed={!!data?.affected} />
          <SealedField label="Lot" value={fields?.lot} sealed />
          <SealedField label="Best-by" value={fields?.expiry} sealed={!!data?.affected} />
        </div>
        <p className="px-4 pb-3 text-[11px] text-slate-500">
          The GTIN + lot are lookup keys into the private vault. The high-entropy
          lineage token and EPCIS records stay private — only the case tag,
          nullifier, and aggregate count reach the public ledger.
        </p>
      </Card>

      {pending && (
        <Card className="p-5 text-center">
          <div className="text-sm font-semibold text-hi">
            Generating zero-knowledge proof…
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Deriving the case witness from the matched private record and
            submitting a Compact-backed transaction.
          </p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-verified" />
          </div>
        </Card>
      )}

      {data && (
        <>
          <ResultCard
            affected={data.affected}
            title={data.title}
            message={data.message}
            guidance={data.guidance}
            sourceUrl={data.sourceUrl}
            footer={data.safetyDisclaimer}
          />
          {data.outcome === "synthetic-positive" && (
            <Card className="border-amber-safety/30 bg-amber-bg p-4">
              <Badge tone="amber">Synthetic positive demonstration</Badge>
              <p className="mt-2 text-sm text-slate-700">
                The private partner records behind this match are{" "}
                <strong>synthetic</strong>. The Compact proof and Midnight state
                transition are <strong>genuine</strong>
                {data.proofSubmitted && data.proof?.txId ? (
                  <>
                    {" "}
                    — proof settled, tx{" "}
                    <Mono>{truncateHex(data.proof.txId, 8, 8)}</Mono>.
                  </>
                ) : (
                  " (this case had already converged on-chain)."
                )}
              </p>
              {data.chain && (
                <p className="mt-1 text-xs text-slate-500">
                  Public state: {data.chain.matchCount}/
                  {data.chain.convergenceThreshold} verified orgs ·{" "}
                  {data.chain.converged ? "converged" : "building"} · case tag{" "}
                  <Mono>{truncateHex(data.chain.caseTag)}</Mono>
                </p>
              )}
            </Card>
          )}
          <button className="btn-ghost" onClick={onReset}>
            Scan another product
          </button>
        </>
      )}
    </div>
  );
}

function SealedField({
  label,
  value,
  sealed,
}: {
  label: string;
  value?: string;
  sealed?: boolean;
}) {
  return (
    <div className="rounded-lg bg-surface-muted p-2 text-center">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-xs font-semibold text-hi">
        {sealed ? "•••• sealed" : (value || "—")}
      </div>
    </div>
  );
}

function ResultCard({
  affected,
  title,
  message,
  guidance,
  sourceUrl,
  footer,
}: {
  affected: boolean;
  title: string;
  message: string;
  guidance: string;
  sourceUrl: string;
  footer: string;
}) {
  return (
    <Card
      className={
        "p-5 " +
        (affected ? "border-outbreak/40 bg-outbreak-bg" : "border-verified/40 bg-verified-bg")
      }
    >
      <Badge tone={affected ? "outbreak" : "verified"}>{title}</Badge>
      <p className="mt-2 text-sm text-slate-700">{message}</p>
      <p className="mt-2 text-sm font-medium text-slate-800">{guidance}</p>
      <a
        className="mt-2 inline-block text-sm font-semibold text-mid underline underline-offset-2"
        href={sourceUrl}
        target="_blank"
        rel="noreferrer"
      >
        Official case &amp; safety guidance ↗
      </a>
      <p className="mt-3 text-xs text-slate-500">{footer}</p>
    </Card>
  );
}

// referenced to keep the affected-lineage constant imported for clarity in devtools
void AFFECTED_LINEAGE_TOKEN;
