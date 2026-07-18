/**
 * USDA FoodData Central adapter — resolves branded product identity by GTIN or
 * name. CORRECT host is api.nal.usda.gov/fdc/v1 (the api.fdc.nal.usda.gov host
 * in some docs does not resolve). Requires a data.gov API key; DEMO_KEY works
 * but is throttled to ~10 req/hour, so we treat USDA as optional enrichment:
 * on any failure or missing key we fall back to the checked-in labeled sample
 * and never fake a successful live request.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, "..", "fixtures");

const FDC_SEARCH = "https://api.nal.usda.gov/fdc/v1/foods/search";

export const FdcBrandedFood = z.object({
  fdcId: z.number(),
  description: z.string(),
  dataType: z.string(),
  gtinUpc: z.string().optional(),
  brandOwner: z.string().optional(),
  brandName: z.string().nullable().optional(),
  packageWeight: z.string().optional(),
});
export type FdcBrandedFood = z.infer<typeof FdcBrandedFood>;

export interface UsdaResult {
  foods: FdcBrandedFood[];
  live: boolean;
  liveError?: string;
  retrievedAt: string;
}

export interface UsdaOptions {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  now?: () => Date;
}

export async function resolveProduct(
  query: string,
  opts: UsdaOptions = {},
): Promise<UsdaResult> {
  const apiKey = opts.apiKey ?? process.env.USDA_API_KEY;
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const now = opts.now ?? (() => new Date());

  if (apiKey) {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), opts.timeoutMs ?? 5000);
      const url = `${FDC_SEARCH}?query=${encodeURIComponent(query)}&dataType=Branded&pageSize=10&api_key=${encodeURIComponent(apiKey)}`;
      const res = await fetchImpl(url, { signal: controller.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error(`USDA FDC responded ${res.status}`);
      const json = (await res.json()) as { foods?: unknown[] };
      const foods = (json.foods ?? [])
        .map((f) => FdcBrandedFood.safeParse(f))
        .filter((r): r is { success: true; data: FdcBrandedFood } => r.success)
        .map((r) => r.data);
      return { foods, live: true, retrievedAt: now().toISOString() };
    } catch (err) {
      return cachedSample(err instanceof Error ? err.message : String(err));
    }
  }
  return cachedSample("USDA_API_KEY not configured");
}

function cachedSample(liveError: string): UsdaResult {
  const raw = JSON.parse(
    fs.readFileSync(path.join(FIXTURES, "usda-greenwise-sample.json"), "utf-8"),
  ) as { foods: unknown[] };
  const foods = raw.foods
    .map((f) => FdcBrandedFood.safeParse(f))
    .filter((r): r is { success: true; data: FdcBrandedFood } => r.success)
    .map((r) => r.data);
  return {
    foods,
    live: false,
    liveError,
    retrievedAt: "2026-07-18T18:32:00Z",
  };
}
