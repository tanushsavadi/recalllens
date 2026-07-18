/**
 * Selective-disclosure authorization (P1).
 *
 * IMPORTANT HONESTY NOTE: this produces an authorization *record* and a hash
 * binding {caseId, orgId, approved field set}. It does NOT encrypt or deliver
 * private plaintext to a single recipient — Compact's disclose() does not
 * encrypt, and we have not built encrypted delivery infrastructure. The UI
 * states this limitation explicitly. The hash is an app-level commitment
 * (sha256 with a domain separator), not an on-chain circuit value.
 */
import { createHash } from "node:crypto";
import type { DisclosureAuthorization } from "@recalllens/schemas";

export function authorizationHash(
  caseId: string,
  orgId: string,
  fields: string[],
  approved: boolean,
): string {
  const canonical = JSON.stringify({
    sep: "rl:disclosure:v1",
    caseId,
    orgId,
    fields: [...fields].sort(),
    approved,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

export function makeAuthorization(
  caseId: string,
  orgId: string,
  requestedFields: string[],
  approved: boolean,
  now: string,
): DisclosureAuthorization {
  return {
    caseId,
    orgId,
    requestedFields,
    approved,
    authorizationHash: authorizationHash(caseId, orgId, requestedFields, approved),
    createdAt: now,
  };
}
