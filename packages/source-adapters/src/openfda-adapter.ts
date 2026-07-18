/**
 * openFDA food-enforcement adapter — HISTORICAL / supporting recall data only.
 *
 * This is NOT used as the current public-alert source (the current outbreak
 * comes from the CDC adapter). openFDA is queried for historical produce
 * recalls to give the investigator context. Tolerant of outages: callers
 * should treat an empty result as "no supporting data", not an error.
 */
import { FdaEnforcementResponse, type FdaEnforcementResponse as FdaResp } from "@recalllens/schemas";

const OPENFDA_BASE = "https://api.fda.gov/food/enforcement.json";

export interface OpenFdaOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export async function searchFoodRecalls(
  query: string,
  limit = 5,
  opts: OpenFdaOptions = {},
): Promise<FdaResp> {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const url = `${OPENFDA_BASE}?search=${encodeURIComponent(query)}&limit=${limit}`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), opts.timeoutMs ?? 5000);
  try {
    const res = await fetchImpl(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`openFDA responded ${res.status}`);
    const json = await res.json();
    return FdaEnforcementResponse.parse(json);
  } finally {
    clearTimeout(t);
  }
}
