/**
 * FDA outbreak-advisory adapter — live-or-cached, same honest strategy as the
 * CDC adapter. Both July-2026 advisory pages were retrieved LIVE via direct
 * fetch on 2026-07-18 (no bot block observed, unlike www.cdc.gov); the
 * checked-in snapshots are the fallback.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseFdaAdvisoryHtml,
  FDA_LETTUCE_URL,
  FDA_BLUEBERRIES_URL,
  type FdaAdvisory,
} from "./fda-parser";
import { sha256Hex } from "./sha256";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, "..", "fixtures");

/** When each checked-in snapshot was retrieved (live fetch, this session). */
const SNAPSHOT_RETRIEVED_AT = "2026-07-18T18:31:11Z";

export type FdaSourceId = "lettuce" | "blueberries";

const SOURCES: Record<FdaSourceId, { url: string; fixture: string }> = {
  lettuce: { url: FDA_LETTUCE_URL, fixture: "fda-lettuce-07-26.raw.html" },
  blueberries: {
    url: FDA_BLUEBERRIES_URL,
    fixture: "fda-blueberries-07-26.raw.html",
  },
};

export interface FdaAdvisoryResult {
  advisory: FdaAdvisory;
  sourceUrl: string;
  live: boolean;
  liveError?: string;
  retrievedAt: string;
  contentSha256: string;
}

export interface FdaFetchOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  now?: () => Date;
}

export async function getFdaAdvisory(
  id: FdaSourceId,
  opts: FdaFetchOptions = {},
): Promise<FdaAdvisoryResult> {
  const { url, fixture } = SOURCES[id];
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const now = opts.now ?? (() => new Date());

  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), opts.timeoutMs ?? 5000);
    const res = await fetchImpl(url, {
      signal: controller.signal,
      headers: { accept: "text/html" },
    });
    clearTimeout(t);
    if (!res.ok) throw new Error(`FDA responded ${res.status}`);
    const html = await res.text();
    return {
      advisory: parseFdaAdvisoryHtml(html),
      sourceUrl: url,
      live: true,
      retrievedAt: now().toISOString(),
      contentSha256: sha256Hex(html),
    };
  } catch (err) {
    const html = fs.readFileSync(path.join(FIXTURES, fixture), "utf-8");
    return {
      advisory: parseFdaAdvisoryHtml(html),
      sourceUrl: url,
      live: false,
      liveError: err instanceof Error ? err.message : String(err),
      retrievedAt: SNAPSHOT_RETRIEVED_AT,
      contentSha256: sha256Hex(html),
    };
  }
}
