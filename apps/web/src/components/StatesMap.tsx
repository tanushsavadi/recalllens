/**
 * Lightweight affected-states visualization. Rather than pull a full US
 * TopoJSON map (heavy, and MapLibre needs tiles/network), we render a compact
 * grid-cartogram of the affected states — reliable offline, accessible, and
 * unmistakable. Affected states are highlighted in outbreak red.
 */
import clsx from "clsx";

// Standard US state-grid cartogram positions (row, col).
const GRID: Record<string, [number, number]> = {
  AK: [0, 0], ME: [0, 10],
  VT: [1, 9], NH: [1, 10],
  WA: [2, 0], ID: [2, 1], MT: [2, 2], ND: [2, 3], MN: [2, 4], IL: [2, 5], WI: [2, 6], MI: [2, 7], NY: [2, 8], RI: [2, 9], MA: [2, 10],
  OR: [3, 0], NV: [3, 1], WY: [3, 2], SD: [3, 3], IA: [3, 4], IN: [3, 5], OH: [3, 6], PA: [3, 7], NJ: [3, 8], CT: [3, 9],
  CA: [4, 0], UT: [4, 1], CO: [4, 2], NE: [4, 3], MO: [4, 4], KY: [4, 5], WV: [4, 6], VA: [4, 7], MD: [4, 8], DE: [4, 9],
  AZ: [5, 1], NM: [5, 2], KS: [5, 3], AR: [5, 4], TN: [5, 5], NC: [5, 6], SC: [5, 7],
  OK: [6, 3], LA: [6, 4], MS: [6, 5], AL: [6, 6], GA: [6, 7],
  TX: [7, 3], FL: [7, 8], HI: [7, 0],
};

const NAME_TO_ABBR: Record<string, string> = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA",
  Colorado: "CO", Connecticut: "CT", Delaware: "DE", Florida: "FL", Georgia: "GA",
  Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA",
  Kansas: "KS", Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD",
  Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS",
  Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV",
  "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
  "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH", Oklahoma: "OK",
  Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI", "South Carolina": "SC",
  "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT",
  Virginia: "VA", Washington: "WA", "West Virginia": "WV", Wisconsin: "WI",
  Wyoming: "WY",
};

export function StatesMap({ affected }: { affected: string[] }) {
  const affectedAbbr = new Set(
    affected.map((s) => NAME_TO_ABBR[s] ?? s).filter(Boolean),
  );
  const cols = 11;
  const rows = 8;
  return (
    <div
      role="img"
      aria-label={`Affected states: ${affected.join(", ")}`}
      className="grid gap-1"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: rows * cols }).map((_, i) => {
        const r = Math.floor(i / cols);
        const c = i % cols;
        const abbr = Object.keys(GRID).find(
          (k) => GRID[k][0] === r && GRID[k][1] === c,
        );
        if (!abbr) return <div key={i} />;
        const isAffected = affectedAbbr.has(abbr);
        return (
          <div
            key={i}
            className={clsx(
              "flex aspect-square items-center justify-center rounded text-[10px] font-bold",
              isAffected
                ? "bg-outbreak text-white ring-2 ring-outbreak/40"
                : "bg-slate-100 text-slate-400",
            )}
            title={abbr}
          >
            {abbr}
          </div>
        );
      })}
    </div>
  );
}
