import { Badge } from "./ui";

/**
 * Persistent role-simulation disclosure, shown on every role surface.
 */
export function RoleBanner({ role }: { role: "investigator" | "partner" | "consumer" }) {
  const label = {
    investigator: "Investigator role",
    partner: "Supply-chain partner role",
    consumer: "Consumer role",
  }[role];
  const tone = { investigator: "info", partner: "amber", consumer: "verified" } as const;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone={tone[role]}>{label}</Badge>
      <span className="text-[11px] text-lo">
        Demo role simulation: these actors would use separate authenticated
        organizations and devices in production.
      </span>
    </div>
  );
}
