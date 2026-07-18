/**
 * SYNTHETIC DEMONSTRATION DATA.
 *
 * Every organization below is fictional. None of these records represent
 * Taylor Farms, Taco Bell, or any real company's private data. Secrets are
 * fixed constants so the demo is deterministic and reproducible; because
 * these fixtures are checked into a public repository, the accurate privacy
 * claim is "zero raw partner records written to the public Midnight ledger",
 * NOT "these values were never published anywhere".
 */
import type { Organization } from "@recalllens/schemas";

export const SYNTHETIC_LABEL = "Synthetic demonstration data";

export const organizations: Organization[] = [
  {
    orgId: "org-sierra-verde",
    name: "Sierra Verde Growers",
    role: "farm",
    orgSecret:
      "11a1c0ffee00000000000000000000000000000000000000000000000000a001",
    synthetic: true,
  },
  {
    orgId: "org-northstar",
    name: "Northstar Fresh Processing",
    role: "processor",
    orgSecret:
      "22b2c0ffee00000000000000000000000000000000000000000000000000b002",
    synthetic: true,
  },
  {
    orgId: "org-meridian",
    name: "Meridian Cold Chain",
    role: "distributor",
    orgSecret:
      "33c3c0ffee00000000000000000000000000000000000000000000000000c003",
    synthetic: true,
  },
  {
    orgId: "org-quickserve",
    name: "QuickServe Restaurant Group",
    role: "restaurant",
    orgSecret:
      "44d4c0ffee00000000000000000000000000000000000000000000000000d004",
    synthetic: true,
  },
];

export function orgByRole(role: Organization["role"]): Organization {
  const org = organizations.find((o) => o.role === role);
  if (!org) throw new Error(`no fixture org with role ${role}`);
  return org;
}
