import { useEffect, useState } from "react";
import { Mono } from "./ui";

/**
 * Honest proof-stage indicator: named stages + elapsed seconds, indeterminate
 * bar — never a fabricated percentage. A genuine ZK proof takes ~60–90s; the
 * stage names describe what the pipeline is actually doing at typical times.
 */
export function ProofProgress({ kind = "proof" }: { kind?: "proof" | "signal" | "anchor" }) {
  const [startedAt] = useState(() => Date.now());
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  const what = kind === "signal" ? "signal proof" : kind === "anchor" ? "anchor transaction" : "private proof";
  const stage =
    elapsed < 10
      ? `1/4 · Generating ${what} (local proof server)`
      : elapsed < 45
        ? "2/4 · Proving circuit constraints"
        : elapsed < 70
          ? "3/4 · Submitting to Midnight"
          : "4/4 · Waiting for confirmation";
  return (
    <div className="rounded-lg border border-slate-200 p-3 text-xs text-slate-500">
      <div className="flex items-center justify-between">
        <span>{stage}</span>
        <Mono>{elapsed}s</Mono>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
        <div
          className="h-full w-1/3 animate-pulse rounded-full"
          style={{ background: "var(--accent)" }}
        />
      </div>
      <p className="mt-1 text-[10px] text-slate-400">
        Genuine ZK proofs typically take 60–90 seconds; progress is
        indeterminate by nature.
      </p>
    </div>
  );
}
