/**
 * WidgetDrawer — a macOS-style expandable panel anchored top-right. Collapsed
 * it's a compact glass pill showing live proof status; expanded it slides open
 * a stack of glass "widgets" (proof status, provenance, private/public key).
 * Driven by the shared on-chain state so it's always truthful.
 */
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useOutbreak, useCaseStatus, useReplay } from "../lib/case-state";
import { Badge, Mono, truncateHex } from "./ui";

export function WidgetDrawer() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const outbreak = useOutbreak();
  const caseStatus = useCaseStatus();
  const replay = useReplay((s) => s.replay);
  const chain = caseStatus.data?.chain;
  const converged = chain?.converged ?? false;
  const count = chain?.matchCount ?? 0;
  const threshold = chain?.convergenceThreshold ?? 3;
  const o = outbreak.data?.snapshot.outbreak;

  return (
    <div className="pointer-events-none fixed right-3 top-4 z-30 flex w-[min(92vw,360px)] flex-col items-end gap-2">
      {/* Collapsed pill / toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="glass glass-strong pill pointer-events-auto flex items-center gap-2.5 px-3 py-2 text-left transition-transform hover:-translate-y-0.5"
        aria-expanded={open}
        aria-label="Toggle proof widgets"
      >
        <span
          className="relative flex h-2.5 w-2.5"
          title={converged ? "Converged" : "Building"}
        >
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70"
            style={{ background: converged ? "var(--verified)" : "var(--amber)" }}
          />
          <span
            className="relative inline-flex h-2.5 w-2.5 rounded-full"
            style={{ background: converged ? "var(--verified)" : "var(--amber)" }}
          />
        </span>
        <span className="text-[13px] font-semibold text-hi">
          {converged ? "Common origin verified" : `Proving ${count}/${threshold}`}
        </span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.2"
          className={"text-mid transition-transform " + (open ? "rotate-180" : "")}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Expanded widget stack — fully removed from the hit-test when closed. */}
      <div
        aria-hidden={!open}
        className={
          "flex w-full flex-col gap-2 transition-all duration-300 " +
          (open
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none invisible -translate-y-2 opacity-0")
        }
      >
        {/* Proof status widget */}
        <div className="glass p-4">
          <div className="eyebrow mb-2">Public Midnight state</div>
          <div className="flex items-end justify-between">
            <div>
              <div className="stat-value text-3xl" style={{ color: converged ? "var(--verified)" : "var(--text-hi)" }}>
                {count}/{threshold}
              </div>
              <div className="text-[11px] text-lo">distinct verified orgs</div>
            </div>
            <Badge tone={caseStatus.data?.mode === "live-devnet" ? "verified" : "amber"}>
              {caseStatus.data?.mode === "live-devnet" ? "live devnet" : "fallback"}
            </Badge>
          </div>
          <dl className="mt-3 flex flex-col gap-1 text-[11px] text-lo">
            <Row label="Contract"><Mono>{truncateHex(chain?.contractAddress, 8, 6)}</Mono></Row>
            <Row label="Case tag"><Mono>{truncateHex(chain?.caseTag, 8, 6)}</Mono></Row>
            <Row label="Nullifiers"><span className="text-mid">{chain?.nullifiers.length ?? 0}</span></Row>
          </dl>
          {converged && (
            <button className="btn btn-glass mt-3 w-full text-xs" onClick={replay}>
              ↻ Replay convergence
            </button>
          )}
        </div>

        {/* Provenance widget */}
        <div className="glass p-4">
          <div className="eyebrow mb-2">Official source</div>
          <div className="flex items-center gap-2">
            {outbreak.data &&
              (outbreak.data.live ? (
                <Badge tone="verified">● LIVE</Badge>
              ) : (
                <Badge tone="info">◍ CACHED</Badge>
              ))}
            <span className="text-xs text-mid">CDC · {o?.pathogen}</span>
          </div>
          <div className="mt-2 text-[11px] text-lo">
            <div>Updated {o?.officialLastUpdated}</div>
            <div>
              Retrieved{" "}
              {outbreak.data &&
                new Date(outbreak.data.snapshot.retrievedAt)
                  .toISOString()
                  .replace("T", " ")
                  .slice(0, 16)}{" "}
              UTC ·{" "}
              <button
                className="underline underline-offset-2 hover:text-mid"
                onClick={() => qc.invalidateQueries({ queryKey: ["outbreak"] })}
              >
                refresh
              </button>
            </div>
          </div>
        </div>

        {/* Private/public key widget */}
        <div className="glass p-4 text-[11px] leading-relaxed text-mid">
          <div className="eyebrow mb-2">What stays private</div>
          Supplier/customer identities, lot codes, quantities, routes, invoices,
          temperatures, receipts — <span className="text-hi">never</span> written
          to the public ledger. Zero raw partner records on-chain.
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
