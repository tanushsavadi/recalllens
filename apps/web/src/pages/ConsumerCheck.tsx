import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { EvidenceReceipt } from "@recalllens/schemas";
import { passportFromDigitalLink } from "@recalllens/gs1";
import { api } from "../lib/api";
import { Card, Badge, SectionTitle, SyntheticBadge, Mono, truncateHex } from "../components/ui";
import { RoleBanner } from "../components/RoleBanner";
import { ScanProduct, type ScanConfirm } from "../components/ScanProduct";

/**
 * Consumer Check — Scan → Confirm → Verify evidence → Result.
 *
 * Verification order (server-side, shown in the receipt):
 *   1. official FDA advisory identifiers
 *   2. authorized RecallLens recall predicate
 *   3. proof-verified Sentinel hold
 *   4. no / insufficient evidence
 * The consumer NEVER triggers a supply-chain partner proof.
 */
export function ConsumerCheck() {
  const [confirmed, setConfirmed] = useState<ScanConfirm | null>(null);

  const verify = useMutation({
    mutationFn: (f: ScanConfirm) => {
      // A RecallLens passport, when present in the scanned QR, rides along for
      // signature verification + hold/recall membership.
      const passport = f.rawText ? passportFromDigitalLink(f.rawText) : null;
      return api.consumer.verify({
        gtin: f.gtin,
        lot: f.lot || undefined,
        expiry: f.expiry || undefined,
        productName: f.productName || undefined,
        passport: passport
          ? { passportId: passport.passportId, issuer: passport.issuer, signature: passport.signature }
          : undefined,
      });
    },
  });

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Consumer Check</h1>
          <p className="text-sm text-slate-500">
            Check a product against official recalls and proof-verified
            RecallLens holds.
          </p>
        </div>
        <SyntheticBadge />
      </div>
      <RoleBanner role="consumer" />

      {!verify.data && !verify.isPending && (
        <Card className="p-5">
          <SectionTitle hint="all scanning is local to this device">
            Step 1 &amp; 2 — scan, then confirm
          </SectionTitle>
          <ScanProduct
            allowProductName
            onConfirm={(f) => {
              setConfirmed(f);
              verify.mutate(f);
            }}
          />
        </Card>
      )}

      {verify.isPending && (
        <Card className="p-5 text-center">
          <div className="text-sm font-semibold text-hi">Checking evidence sources…</div>
          <p className="mt-1 text-xs text-slate-500">
            Official FDA advisories → authorized RecallLens recalls →
            proof-verified holds. Only the confirmed identifiers leave this
            device.
          </p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-verified" />
          </div>
        </Card>
      )}

      {verify.isError && (
        <Card className="p-5">
          <Badge tone="outbreak">Verification failed</Badge>
          <p className="mt-2 text-sm text-slate-600">{(verify.error as Error).message}</p>
          <button className="btn btn-glass mt-3" onClick={() => verify.reset()}>
            Try again
          </button>
        </Card>
      )}

      {verify.data && (
        <>
          <ResultCard receipt={verify.data} scanned={confirmed} />
          <EvidenceReceiptCard receipt={verify.data} />
          <button
            className="btn btn-glass"
            onClick={() => {
              verify.reset();
              setConfirmed(null);
            }}
          >
            Scan another product
          </button>
        </>
      )}
    </div>
  );
}

const LEVEL_STYLE: Record<
  EvidenceReceipt["level"],
  { tone: "outbreak" | "amber" | "verified" | "info" | "neutral"; bg: string }
> = {
  EXACT_OFFICIAL_RECALL_MATCH: { tone: "outbreak", bg: "border-outbreak/40 bg-outbreak-bg" },
  AUTHORIZED_RECALL_MATCH: { tone: "outbreak", bg: "border-outbreak/40 bg-outbreak-bg" },
  PROOF_VERIFIED_PRECAUTIONARY_HOLD: { tone: "amber", bg: "border-amber-safety/40 bg-amber-bg" },
  POSSIBLE_ADVISORY_MATCH: { tone: "amber", bg: "border-amber-safety/40 bg-amber-bg" },
  NO_VERIFIED_MATCH: { tone: "verified", bg: "border-verified/40 bg-verified-bg" },
  INSUFFICIENT_DATA: { tone: "neutral", bg: "border-slate-300" },
};

function ResultCard({
  receipt,
  scanned,
}: {
  receipt: EvidenceReceipt;
  scanned: ScanConfirm | null;
}) {
  const style = LEVEL_STYLE[receipt.level];
  return (
    <Card className={`p-5 ${style.bg}`}>
      <Badge tone={style.tone}>{receipt.headline}</Badge>
      <p className="mt-2 text-sm text-slate-700">{receipt.explanation}</p>
      <p className="mt-2 text-sm font-medium text-slate-800">{receipt.guidance}</p>
      {receipt.source?.url && (
        <a
          className="mt-2 inline-block text-sm font-semibold text-accent underline underline-offset-2"
          href={receipt.source.url}
          target="_blank"
          rel="noreferrer"
        >
          Official source ↗
        </a>
      )}
      <p className="mt-3 text-xs text-slate-500">{receipt.safetyDisclaimer}</p>
      {scanned && (
        <p className="mt-1 text-[11px] text-slate-400">
          Scanned: <Mono>{scanned.gtin}</Mono>
          {scanned.lot ? <> · lot <Mono>{scanned.lot}</Mono></> : null}
        </p>
      )}
    </Card>
  );
}

/** The full "evidence receipt" — provenance is never hidden in a footer. */
function EvidenceReceiptCard({ receipt }: { receipt: EvidenceReceipt }) {
  return (
    <Card className="p-5">
      <SectionTitle>Evidence receipt</SectionTitle>
      <dl className="flex flex-col gap-1.5 text-xs">
        <Row k="Evidence level"><Mono>{receipt.level}</Mono></Row>
        <Row k="Why this level">{receipt.whyThisLevel}</Row>
        {receipt.source && (
          <>
            <Row k="Authority">
              {receipt.source.authority}{" "}
              <Badge tone={receipt.source.kind === "official" ? "verified" : receipt.source.kind === "network" ? "info" : "amber"}>
                {receipt.source.kind}
              </Badge>
            </Row>
            <Row k="Source status">
              {receipt.source.live ? "live fetch" : "cached snapshot"}
              {receipt.source.cadenceNote ? ` — ${receipt.source.cadenceNote}` : ""}
            </Row>
            {receipt.source.sourceTimestamp && (
              <Row k="Source updated">{receipt.source.sourceTimestamp}</Row>
            )}
            <Row k="Retrieved">{receipt.source.retrievedAt}</Row>
          </>
        )}
        {receipt.fieldsMatched.length > 0 && (
          <Row k="Fields matched">
            {receipt.fieldsMatched.map((f) => `${f.field}=${f.value}`).join(" · ")}
          </Row>
        )}
        {receipt.fieldsMissing.length > 0 && (
          <Row k="Fields missing">{receipt.fieldsMissing.join(" · ")}</Row>
        )}
        <Row k="Midnight involved">
          {receipt.midnightInvolved
            ? `yes — ${receipt.network ?? "network"}${receipt.txId ? `, tx ${truncateHex(receipt.txId, 8, 6)}` : " (fallback mode: no tx)"}`
            : "no"}
        </Row>
        <Row k="Synthetic data">{receipt.syntheticData ? "yes — RecallLens demo records" : "no"}</Row>
        <Row k="Data left device">{receipt.dataLeftDevice}</Row>
        {receipt.passport && (
          <Row k="Passport">
            {receipt.passport.valid ? "signature valid" : "SIGNATURE INVALID"} · issuer{" "}
            <Mono>{receipt.passport.issuer}</Mono>
          </Row>
        )}
      </dl>
    </Card>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-1.5 last:border-0">
      <dt className="shrink-0 text-slate-500">{k}</dt>
      <dd className="text-right text-slate-700">{children}</dd>
    </div>
  );
}
