import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { EvidenceReceipt } from "@recalllens/schemas";
import { passportFromDigitalLink } from "@recalllens/gs1";
import { api } from "../lib/api";
import { Card, Badge, SectionTitle, SyntheticBadge, Mono, truncateHex } from "../components/ui";
import { ScanProduct, type ScanConfirm } from "../components/ScanProduct";

/**
 * Consumer Check — Scan → Confirm → Verify evidence → Result.
 *
 * This screen reads as a consumer product, not a role simulator: no role
 * badge or demo-role copy (unlike the investigator/partner surfaces).
 *
 * Verification order (server-side, shown in the receipt):
 *   1. official FDA advisory identifiers
 *   2. authorized RecallLens recall scope
 *   3. Midnight-anchored Sentinel hold
 *   4. no / insufficient evidence
 * The consumer NEVER triggers a supply-chain partner proof.
 *
 * State isolation: each verification is bound to the scan attempt that
 * produced it (attempt counter). A slow response for an older scan is
 * discarded if a newer scan started, and "Scan another product" clears the
 * result + receipt entirely.
 */
export function ConsumerCheck() {
  const [confirmed, setConfirmed] = useState<ScanConfirm | null>(null);
  const attemptRef = useRef(0);

  const verify = useMutation({
    mutationFn: async (f: ScanConfirm & { attempt: number }) => {
      // A RecallLens passport, when present in the scanned QR, rides along for
      // signature verification + hold/recall membership.
      const passport = f.rawText ? passportFromDigitalLink(f.rawText) : null;
      const receipt = await api.consumer.verify({
        gtin: f.gtin || undefined,
        lot: f.lot || undefined,
        expiry: f.expiry || undefined,
        productName: f.productName || undefined,
        scanOrigin: f.origin,
        passport: passport
          ? { passportId: passport.passportId, issuer: passport.issuer, signature: passport.signature }
          : undefined,
      });
      return { receipt, attempt: f.attempt };
    },
  });

  // Drop results that belong to an older scan attempt.
  const current =
    verify.data && verify.data.attempt === attemptRef.current ? verify.data.receipt : null;

  function startNewScan() {
    attemptRef.current += 1;
    verify.reset();
    setConfirmed(null);
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Consumer Check</h1>
          <p className="text-sm text-slate-500">
            Scan a product to check official recalls and privacy-preserving
            RecallLens safety actions.
          </p>
        </div>
        <SyntheticBadge />
      </div>

      {!current && !verify.isPending && (
        <Card className="p-5">
          <SectionTitle hint="all scanning is local to this device">
            Step 1 &amp; 2 — scan, then confirm
          </SectionTitle>
          <ScanProduct
            allowProductName
            onConfirm={(f) => {
              attemptRef.current += 1;
              setConfirmed(f);
              verify.mutate({ ...f, attempt: attemptRef.current });
            }}
          />
        </Card>
      )}

      {verify.isPending && (
        <Card className="p-5 text-center">
          <div className="text-sm font-semibold text-hi">Checking evidence sources…</div>
          <p className="mt-1 text-xs text-slate-500">
            Official FDA advisories → RecallLens targeted actions →
            Midnight-anchored holds. Only the confirmed identifiers leave this
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
          <button className="btn btn-glass mt-3" onClick={startNewScan}>
            Try again
          </button>
        </Card>
      )}

      {current && (
        <>
          <ResultCard receipt={current} scanned={confirmed} />
          <EvidenceReceiptCard receipt={current} />
          <button className="btn btn-glass" onClick={startNewScan}>
            Scan another product
          </button>
        </>
      )}
    </div>
  );
}

/**
 * Result styling by level. NO_VERIFIED_MATCH deliberately uses the neutral
 * info-blue treatment — a no-match is not a safety guarantee and must not
 * look like a green success state.
 */
const LEVEL_STYLE: Record<
  EvidenceReceipt["level"],
  { tone: "outbreak" | "amber" | "verified" | "info" | "neutral"; bg: string }
> = {
  EXACT_OFFICIAL_RECALL_MATCH: { tone: "outbreak", bg: "border-outbreak/40 bg-outbreak-bg" },
  AUTHORIZED_RECALL_MATCH: { tone: "outbreak", bg: "border-outbreak/40 bg-outbreak-bg" },
  PROOF_VERIFIED_PRECAUTIONARY_HOLD: { tone: "amber", bg: "border-amber-safety/40 bg-amber-bg" },
  POSSIBLE_ADVISORY_MATCH: { tone: "amber", bg: "border-amber-safety/40 bg-amber-bg" },
  NO_VERIFIED_MATCH: { tone: "info", bg: "border-info/40 bg-info-bg" },
  INSUFFICIENT_DATA: { tone: "neutral", bg: "border-slate-300" },
  VERIFICATION_UNAVAILABLE: { tone: "neutral", bg: "border-slate-300" },
};

/** Plain-language input provenance for the result card. */
const PROVENANCE_LABEL: Record<EvidenceReceipt["inputProvenance"], string> = {
  "signed-synthetic-passport": "Signed RecallLens demonstration passport (synthetic)",
  "public-identifier-card": "Public identifiers from the scanned label",
  "manual-entry": "Manually entered identifiers",
  "invalid-signature": "Passport with an INVALID signature",
};

function ResultCard({
  receipt,
  scanned,
}: {
  receipt: EvidenceReceipt;
  scanned: ScanConfirm | null;
}) {
  const style = LEVEL_STYLE[receipt.level];
  const headlineColor = {
    outbreak: "var(--outbreak)",
    amber: "var(--amber)",
    verified: "var(--verified)",
    info: "var(--accent)",
    neutral: "var(--text-mid)",
  }[style.tone];
  return (
    <Card className={`p-5 ${style.bg}`}>
      {/* Primary result headline — sized to survive 1080p video compression */}
      <h2
        className="text-base font-extrabold uppercase leading-snug tracking-wide sm:text-lg"
        style={{ color: headlineColor }}
      >
        {receipt.headline}
      </h2>
      <p className="mt-2 text-sm text-slate-700">{receipt.explanation}</p>
      <p className="mt-2 text-sm font-semibold text-slate-800">{receipt.guidance}</p>

      {/* Sources checked — plain language, always visible */}
      <div className="mt-3 rounded-lg bg-surface-muted px-3 py-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Sources checked
        </div>
        <ul className="mt-1 space-y-0.5 text-sm text-slate-600">
          {receipt.sourcesChecked.map((c) => (
            <li key={c.system} className="flex items-baseline justify-between gap-3">
              <span>{c.system}</span>
              <span className="text-right font-medium">{c.result}</span>
            </li>
          ))}
        </ul>
      </div>

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
          Scanned:{" "}
          {scanned.gtin ? (
            <>
              <Mono>{scanned.gtin}</Mono>
              {scanned.lot ? <> · lot <Mono>{scanned.lot}</Mono></> : null}
            </>
          ) : scanned.lot ? (
            <>
              lot <Mono>{scanned.lot}</Mono>
              <span className="ml-1">(no GTIN printed on this label)</span>
            </>
          ) : (
            <Mono>{scanned.productName ?? "—"}</Mono>
          )}
        </p>
      )}
    </Card>
  );
}

/**
 * The full "evidence receipt": a plain-language summary up top, with the raw
 * technical values (enums, hashes, timestamps) in a collapsed section so the
 * primary result stays readable in seconds.
 */
function EvidenceReceiptCard({ receipt }: { receipt: EvidenceReceipt }) {
  return (
    <Card className="p-5">
      <SectionTitle>Evidence receipt</SectionTitle>
      <dl className="flex flex-col gap-1.5 text-xs">
        <Row k="Scanned input">
          {PROVENANCE_LABEL[receipt.inputProvenance]}
        </Row>
        <Row k="Input data">
          {receipt.inputSynthetic
            ? "Synthetic demonstration data (RecallLens demo passport)"
            : "As printed / entered — no RecallLens passport"}
        </Row>
        {receipt.source && (
          <>
            <Row k="Primary source">
              {receipt.source.authority}{" "}
              <Badge tone={receipt.source.kind === "official" ? "verified" : receipt.source.kind === "network" ? "info" : "amber"}>
                {receipt.source.kind}
              </Badge>
            </Row>
            <Row k="Source status">
              {receipt.source.live ? "live fetch" : "cached snapshot"}
              {receipt.source.cadenceNote ? ` — ${receipt.source.cadenceNote}` : ""}
            </Row>
          </>
        )}
        <Row k="Why this result">{receipt.whyThisLevel}</Row>
        {receipt.fieldsMatched.length > 0 && (
          <Row k="Fields matched">
            {receipt.fieldsMatched.map((f) => `${f.field}=${f.value}`).join(" · ")}
          </Row>
        )}
        {receipt.fieldsMissing.length > 0 && (
          <Row k="Fields missing">{receipt.fieldsMissing.join(" · ")}</Row>
        )}
        <Row k="Midnight involved">
          {receipt.midnight.involved ? (
            <>
              yes — {receipt.midnight.networkLabel ?? "Midnight"}
              {receipt.midnight.contractAddress
                ? " · deployed contract"
                : ""}
            </>
          ) : (
            <>no{receipt.midnight.note ? ` — ${receipt.midnight.note}` : ""}</>
          )}
        </Row>
        {receipt.midnight.involved && receipt.midnight.txId && (
          <Row k="Transaction">
            <Mono>{truncateHex(receipt.midnight.txId, 10, 8)}</Mono>
          </Row>
        )}
        <Row k="Data left device">
          {receipt.dataLeftDevice.fieldsTransmitted.length > 0
            ? receipt.dataLeftDevice.fieldsTransmitted.join(" · ")
            : "nothing"}
          {" — image never transmitted"}
        </Row>
        {receipt.passport && (
          <Row k="Passport">
            {receipt.passport.valid ? "signature valid" : "SIGNATURE INVALID"} ·
            synthetic demo credential
          </Row>
        )}
      </dl>

      {/* Raw technical values, collapsed by default */}
      <details className="mt-3 rounded-lg bg-surface-muted px-3 py-2 text-xs text-slate-500">
        <summary className="cursor-pointer font-semibold text-slate-600">
          Technical details
        </summary>
        <dl className="mt-2 flex flex-col gap-1.5">
          <Row k="Evidence level"><Mono>{receipt.level}</Mono></Row>
          <Row k="Decision basis"><Mono>{receipt.basis}</Mono></Row>
          {receipt.source?.sourceTimestamp && (
            <Row k="Source updated"><Mono>{receipt.source.sourceTimestamp}</Mono></Row>
          )}
          {receipt.source && <Row k="Retrieved"><Mono>{receipt.source.retrievedAt}</Mono></Row>}
          {receipt.midnight.contractAddress && (
            <Row k="Contract"><Mono>{truncateHex(receipt.midnight.contractAddress, 10, 8)}</Mono></Row>
          )}
          {receipt.midnight.txId && (
            <Row k="Tx id"><Mono>{receipt.midnight.txId}</Mono></Row>
          )}
          {receipt.midnight.note && <Row k="Midnight note">{receipt.midnight.note}</Row>}
          {receipt.passport && (
            <>
              <Row k="Passport id"><Mono>{receipt.passport.passportId}</Mono></Row>
              <Row k="Issuer"><Mono>{receipt.passport.issuer}</Mono></Row>
            </>
          )}
          {receipt.sourcesChecked.map((c) => (
            <Row key={`tech-${c.system}`} k={c.system}>
              {c.result}
              {c.live !== null ? (c.live ? " · live" : " · cached/fallback") : ""}
              {c.detail ? ` · ${c.detail}` : ""}
            </Row>
          ))}
        </dl>
      </details>
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
