/**
 * CDC outbreak adapter.
 *
 * Strategy (honest live-or-cached):
 *   1. Attempt a live fetch of the official CDC page and parse it.
 *   2. On any failure (Akamai 403 from datacenter IPs is the common case),
 *      fall back to the checked-in, timestamped cached snapshot.
 * The returned snapshot's `source` field always tells the UI which path was
 * used, so the badge ("LIVE" vs "CACHED") reflects reality.
 */
import cachedSnapshot from "../fixtures/cdc-cyclospora-07-26.snapshot.json" with { type: "json" };
import { OutbreakSnapshot, type OutbreakSnapshot as OutbreakSnapshotT } from "@recalllens/schemas";
import { parseCdcOutbreakHtml, toSnapshot, CDC_SOURCE_URL } from "./cdc-parser";
import { sha256Hex } from "./sha256";

export function getCachedSnapshot(): OutbreakSnapshotT {
  // Validate the checked-in JSON so a hand-edit can't ship malformed data.
  return OutbreakSnapshot.parse(cachedSnapshot);
}

export interface FetchOptions {
  /** override for testing; defaults to global fetch */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  now?: () => Date;
}

export interface CdcResult {
  snapshot: OutbreakSnapshotT;
  live: boolean;
  /** present when the live attempt failed */
  liveError?: string;
}

export async function getOutbreak(opts: FetchOptions = {}): Promise<CdcResult> {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const now = opts.now ?? (() => new Date());
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), opts.timeoutMs ?? 5000);
    const res = await fetchImpl(CDC_SOURCE_URL, {
      signal: controller.signal,
      headers: { accept: "text/html" },
    });
    clearTimeout(t);
    if (!res.ok) throw new Error(`CDC responded ${res.status}`);
    const html = await res.text();
    const parsed = parseCdcOutbreakHtml(html);
    // Current CDC page revisions state only the COUNT ("in 5 States") in the
    // title without naming the states in prose. When the live parse yields no
    // names but the live title's count matches the cached official snapshot
    // (an earlier revision of the SAME CDC page that did name them), reuse
    // those official names. Never fabricated — both lists are CDC content.
    if (parsed.states.length === 0) {
      const cached = getCachedSnapshot();
      const countMatch = parsed.title.match(/in\s+(\d+)\s+states/i);
      const titleCount = countMatch ? Number(countMatch[1]) : null;
      if (titleCount !== null && cached.outbreak.states.length === titleCount) {
        parsed.states = [...cached.outbreak.states];
      }
    }
    const snapshot = toSnapshot(parsed, {
      source: "cdc-page",
      sourceUrl: CDC_SOURCE_URL,
      retrievedAt: now().toISOString(),
      contentSha256: sha256Hex(html),
    });
    return { snapshot, live: true };
  } catch (err) {
    return {
      snapshot: getCachedSnapshot(),
      live: false,
      liveError: err instanceof Error ? err.message : String(err),
    };
  }
}
