import { Badge } from "./ui";

/**
 * Persistent role-simulation disclosure, shown on the investigator and
 * partner surfaces. Consumer Check deliberately does NOT render this —
 * consumers are real end users, not simulated roles.
 */
export function RoleBanner({ role }: { role: "investigator" | "partner" }) {
  const label = {
    investigator: "Investigator role",
    partner: "Supply-chain partner role",
  }[role];
  const tone = { investigator: "info", partner: "amber" } as const;
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
