/**
 * WidgetDrawer — a macOS-style expandable panel anchored top-right. Collapsed
 * it's a compact glass pill showing the CURRENT LIFECYCLE STATE (always
 * labeled with the subsystem it summarizes — never a bare "Proving 2/3");
 * expanded it shows every lifecycle subsystem simultaneously plus provenance.
 * Driven by the server's authoritative /workflow/:caseId/stage snapshot so it
 * is always truthful and survives route changes / reloads.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useOutbreak, useCaseStatus, useReplay } from "../lib/case-state";
import { api, DEMO_CASE_ID } from "../lib/api";
import { Badge, Mono, truncateHex } from "./ui";

export function useLifecycle() {
  return useQuery({
    queryKey: ["workflow-stage", DEMO_CASE_ID],
    queryFn: () => api.workflowStage(DEMO_CASE_ID),
    refetchInterval: 3500,
  });
}

/** The labeled global status pill text — subsystem is always explicit. */
function pillLabel(lc: NonNullable<ReturnType<typeof useLifecycle>["data"]>): string {
  if (lc.removal.completedAt) return "Removal confirmed";
  if (lc.recall.authorized) return "Targeted action authorized";
  if (lc.trace.converged) {
    return lc.removal.confirmedBy.length > 0
      ? "Removal confirmation pending"
      : `Shared lineage verified ${lc.trace.matchCount}/${lc.trace.threshold}`;
  }
  if (lc.hold.active) {
    return `Hold active · Trace ${lc.trace.matchCount}/${lc.trace.threshold}`;
  }
  if (lc.sentinel.thresholdReached) {
    return `Sentinel verified · Trace ${lc.trace.matchCount}/${lc.trace.threshold}`;
  }
  return `Sentinel signals ${lc.sentinel.signals}/${lc.sentinel.required}`;
}

export function WidgetDrawer() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const outbreak = useOutbreak();
  const caseStatus = useCaseStatus();
  const lifecycle = useLifecycle();
  const replay = useReplay((s) => s.replay);
  const chain = caseStatus.data?.chain;
  const lc = lifecycle.data;
  const converged = lc?.trace.converged ?? false;
  const done = !!lc?.removal.completedAt || !!lc?.recall.authorized;
  const o = outbreak.data?.snapshot.outbreak;

  return (
    <div className="pointer-events-none fixed right-3 top-[4.5rem] z-30 flex w-[min(92vw,360px)] flex-col items-end gap-2 print:hidden sm:top-4">
      {/* Collapsed pill / toggle — always subsystem-labeled */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="glass glass-strong pill pointer-events-auto flex items-center gap-2.5 px-3 py-2 text-left transition-transform hover:-translate-y-0.5"
        aria-expanded={open}
        aria-label="Toggle lifecycle widgets"
      >
        <span
          className="relative flex h-2.5 w-2.5"
          title={converged || done ? "Verified" : "In progress"}
        >
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70"
            style={{ background: converged || done ? "var(--verified)" : "var(--amber)" }}
          />
          <span
            className="relative inline-flex h-2.5 w-2.5 rounded-full"
            style={{ background: converged || done ? "var(--verified)" : "var(--amber)" }}
          />
        </span>
        <span className="text-[11px] font-semibold text-hi sm:text-[13px]">
          {lc ? pillLabel(lc) : "Loading lifecycle…"}
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
        {/* Lifecycle widget — every subsystem at once */}
        <div className="glass p-4">
          <div className="eyebrow mb-2">Lifecycle · private coordination</div>
          {lc && (
            <dl className="flex flex-col gap-1 text-[11px]">
              <LifecycleRow
                label="Sentinel signals"
                done={lc.sentinel.thresholdReached}
                value={
                  lc.sentinel.thresholdReached
                    ? `verified ${lc.sentinel.signals}/${lc.sentinel.required}`
                    : `${lc.sentinel.signals}/${lc.sentinel.required}`
                }
              />
              <LifecycleRow
                label="Precautionary hold"
                done={lc.hold.active}
                value={lc.hold.active ? "active" : "not issued"}
              />
              <LifecycleRow
                label="Trace proofs"
                done={lc.trace.converged}
                value={
                  lc.trace.converged
                    ? `shared lineage ${lc.trace.matchCount}/${lc.trace.threshold}`
                    : `${lc.trace.matchCount}/${lc.trace.threshold}`
                }
              />
              <LifecycleRow
                label="Encrypted disclosure"
                done={lc.disclosure.sent}
                value={lc.disclosure.sent ? "package sent" : "not sent"}
              />
              <LifecycleRow
                label="Targeted action"
                done={lc.recall.authorized}
                value={lc.recall.authorized ? "authorized (RecallLens, not FDA)" : "not authorized"}
              />
              <LifecycleRow
                label="Removal"
                done={!!lc.removal.completedAt}
                value={
                  lc.removal.completedAt
                    ? "all partners reported"
                    : lc.removal.confirmedBy.length > 0
                      ? `${lc.removal.confirmedBy.length} partner(s) reported`
                      : "pending"
                }
              />
            </dl>
          )}
        </div>

        {/* Proof status widget */}
        <div className="glass p-4">
          <div className="eyebrow mb-2">Public Midnight state</div>
          <div className="flex items-end justify-between">
            <div>
              <div className="stat-value text-3xl" style={{ color: converged ? "var(--verified)" : "var(--text-hi)" }}>
                {lc?.trace.matchCount ?? 0}/{lc?.trace.threshold ?? 3}
              </div>
              <div className="text-[11px] text-lo">distinct verified orgs (trace)</div>
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

function LifecycleRow({ label, value, done }: { label: string; value: string; done: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="flex items-center gap-1.5 text-lo">
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: done ? "var(--verified)" : "var(--text-lo)" }}
        />
        {label}
      </dt>
      <dd className="font-medium" style={{ color: done ? "var(--verified)" : "var(--text-mid)" }}>
        {value}
      </dd>
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
