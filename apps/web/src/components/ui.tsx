import clsx from "clsx";
import type { ReactNode } from "react";

export function Card({
  children,
  className,
  as: As = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: React.ElementType;
}) {
  return <As className={clsx("glass", className)}>{children}</As>;
}

export function Stat({
  label,
  value,
  tone = "default",
  sub,
}: {
  label: string;
  value: ReactNode;
  tone?: "default" | "outbreak" | "verified" | "amber";
  sub?: ReactNode;
}) {
  const toneClass = {
    default: "text-hi",
    outbreak: "text-outbreak",
    verified: "text-verified",
    amber: "text-amber",
  }[tone];
  return (
    <div className="flex flex-col gap-1">
      <span className="stat-label">{label}</span>
      <span className={clsx("stat-value text-3xl", toneClass)}>{value}</span>
      {sub && <span className="text-xs text-lo">{sub}</span>}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
  title,
}: {
  children: ReactNode;
  tone?: "neutral" | "outbreak" | "verified" | "amber" | "info";
  title?: string;
}) {
  const style: Record<string, React.CSSProperties> = {
    neutral: { background: "var(--glass-fill)", color: "var(--text-mid)", border: "1px solid var(--glass-border)" },
    outbreak: { background: "color-mix(in oklab, var(--outbreak) 18%, transparent)", color: "var(--outbreak)" },
    verified: { background: "color-mix(in oklab, var(--verified) 18%, transparent)", color: "var(--verified)" },
    amber: { background: "color-mix(in oklab, var(--amber) 18%, transparent)", color: "var(--amber)" },
    info: { background: "color-mix(in oklab, var(--accent) 16%, transparent)", color: "var(--accent)" },
  };
  return (
    <span className="badge" style={style[tone]} title={title}>
      {children}
    </span>
  );
}

export function SyntheticBadge() {
  return (
    <Badge tone="amber" title="Fictional records, not from any real company">
      <span aria-hidden className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--amber)" }} />
      <span className="whitespace-nowrap text-[10px] sm:text-[11px]">
        Synthetic demonstration data
      </span>
    </Badge>
  );
}

export function PublicSourceBadge({ live }: { live: boolean }) {
  return live ? (
    <Badge tone="verified" title="Fetched live from the official source this session">
      ● LIVE official source
    </Badge>
  ) : (
    <Badge tone="info" title="Timestamped official snapshot (live fetch unavailable)">
      ◍ CACHED official snapshot
    </Badge>
  );
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <code className={clsx("mono text-xs", className)}>{children}</code>;
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-4">
      <h2 className="text-[13px] font-bold uppercase tracking-[0.09em] text-mid">{children}</h2>
      {hint && <span className="text-xs text-lo">{hint}</span>}
    </div>
  );
}

export function truncateHex(hex: string | null | undefined, head = 8, tail = 6) {
  if (!hex) return "—";
  if (hex.length <= head + tail + 1) return hex;
  return `${hex.slice(0, head)}…${hex.slice(-tail)}`;
}
