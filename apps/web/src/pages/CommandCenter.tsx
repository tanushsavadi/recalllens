import { Link } from "react-router-dom";
import { useOutbreak, useCaseStatus } from "../lib/case-state";
import { Badge, PublicSourceBadge, SyntheticBadge } from "../components/ui";

/**
 * Command Center cockpit: the massive globe is the centerpiece (rendered in
 * GlobeStage behind this). This overlay floats a hero panel (bottom-left), a
 * live stat rail (bottom), and the mission strip — all glass, non-scrolling on
 * desktop, gracefully stacking on small screens. Proof status + provenance live
 * in the top-right WidgetDrawer.
 */
export function CommandCenter() {
  const outbreak = useOutbreak();
  const caseStatus = useCaseStatus();
  const o = outbreak.data?.snapshot.outbreak;
  const chain = caseStatus.data?.chain;
  const converged = chain?.converged ?? false;

  return (
    <div className="pointer-events-none relative z-10">
      {/* HERO — bottom-left floating glass */}
      <div className="fixed inset-x-0 bottom-0 z-10 px-3 pb-4 sm:left-4 sm:right-auto sm:max-w-md sm:px-0">
        <div className="glass glass-strong pointer-events-auto p-5 sm:p-6">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge tone="outbreak">● ACTIVE OUTBREAK</Badge>
            {outbreak.data && <PublicSourceBadge live={outbreak.data.live} />}
            <SyntheticBadge />
          </div>
          <h1 className="display text-[1.6rem] font-semibold leading-[1.08] text-hi sm:text-4xl">
            Detect risk early. Trace it without exposing the supply chain.
          </h1>
          <p className="mt-3 text-[13px] leading-relaxed text-mid sm:text-sm">
            RecallLens combines official recall intelligence with
            privacy-preserving partner proofs, allowing investigators to contain
            affected food while companies keep unrelated records private.
          </p>
          {/* lifecycle strip */}
          <div className="mt-3 flex flex-wrap items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-lo">
            {["Detect", "Verify", "Hold", "Trace", "Recall", "Protect"].map((s, i) => (
              <span key={s} className="flex items-center gap-1">
                {i > 0 && <span className="text-slate-600">→</span>}
                <span>{s}</span>
              </span>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <Link to="/sentinel" className="btn btn-primary">
              Run Sentinel replay →
            </Link>
            <Link to="/consumer" className="btn btn-glass">
              Scan an official recall test card
            </Link>
          </div>
          <div className="mt-3 border-t pt-2 hairline">
            <div className="eyebrow mb-1">Current official case · CDC/FDA</div>
            <p className="text-xs text-mid">
              {o?.title ?? "Cyclospora outbreak linked to shredded iceberg lettuce"}
            </p>
            <a
              className="eyebrow text-accent underline underline-offset-4"
              href={outbreak.data?.snapshot.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              Official CDC page ↗
            </a>
          </div>
        </div>
      </div>

      {/* STAT RAIL — floating glass, bottom-right on desktop */}
      <div className="fixed bottom-4 right-3 z-10 hidden lg:block">
        <div className="glass pointer-events-auto flex items-stretch divide-x divide-[color:var(--line)] p-1">
          <RailStat label="Cases" value={o ? `${o.cases.toLocaleString()}+` : "…"} tone="outbreak" />
          <RailStat label="Hosp." value={`${o?.hospitalizations ?? "…"}`} tone="amber" />
          <RailStat label="Deaths" value={`${o?.deaths ?? "…"}`} />
          <RailStat label="States" value={`${o?.states.length ?? "…"}`} />
          <RailStat
            label="Verified"
            value={`${chain?.matchCount ?? 0}/${chain?.convergenceThreshold ?? 3}`}
            tone={converged ? "verified" : "default"}
          />
        </div>
      </div>

      {/* MISSION EYEBROW — top-left under the nav (desktop) */}
      <div className="fixed left-4 top-24 z-10 hidden md:block">
        <div className="pointer-events-auto">
          <Badge tone={caseStatus.data?.mode === "live-devnet" ? "verified" : "amber"}>
            {caseStatus.data?.mode === "live-devnet" ? "Live Midnight devnet" : "Deterministic fallback"}
          </Badge>
        </div>
        <div className="mt-2 max-w-[190px] text-[11px] leading-snug text-lo">
          Affected states shown at state granularity. Green arcs are anonymous
          proof activity — no facility coordinates or routes.
        </div>
      </div>
    </div>
  );
}

function RailStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "outbreak" | "amber" | "verified";
}) {
  const color = {
    default: "var(--text-hi)",
    outbreak: "var(--outbreak)",
    amber: "var(--amber)",
    verified: "var(--verified)",
  }[tone];
  return (
    <div className="px-4 py-2 text-center">
      <div className="stat-value text-xl" style={{ color }}>{value}</div>
      <div className="stat-label mt-0.5" style={{ letterSpacing: "0.1em" }}>{label}</div>
    </div>
  );
}
