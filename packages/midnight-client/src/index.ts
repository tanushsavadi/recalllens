export * from "./backend";
export * from "./crypto";
export { FallbackBackend } from "./fallback-backend";

import type { ChainBackend } from "./backend";
import { FallbackBackend } from "./fallback-backend";

/**
 * Choose the chain backend at startup.
 *
 * Prefers the live Midnight devnet backend when:
 *   - RECALLLENS_USE_LIVE is not "0", and
 *   - the live-backend module loads, and
 *   - the devnet + a deployed contract are reachable.
 * Otherwise returns the honest deterministic fallback.
 */
export async function selectBackend(): Promise<ChainBackend> {
  if (process.env.RECALLLENS_USE_LIVE === "0") {
    return new FallbackBackend();
  }
  try {
    const mod = await import("./live-backend.js").catch(() =>
      import("./live-backend.ts" as string),
    );
    const live = await (mod as { tryCreateLiveBackend?: () => Promise<ChainBackend | null> })
      .tryCreateLiveBackend?.();
    if (live) return live;
  } catch (e) {
    console.warn(
      `[midnight-client] live backend unavailable, using deterministic fallback: ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
  }
  return new FallbackBackend();
}
