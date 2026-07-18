/**
 * Client-side derivations — reuse the COMPILED contract's `pure circuit`
 * implementations so off-chain values byte-match what the circuit computes.
 * There is deliberately no second hashing implementation in JS.
 */
import { pureCircuits } from "@recalllens/contract";
import type { TraceEvent, Organization } from "@recalllens/schemas";

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) throw new Error(`odd-length hex: ${hex}`);
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function eventTimeUnix(iso: string): bigint {
  return BigInt(Math.floor(new Date(iso).getTime() / 1000));
}

export function eventCommitment(ev: TraceEvent): Uint8Array {
  return pureCircuits.deriveEventCommitment(
    hexToBytes(ev.lineageToken),
    productHash(ev.productGtin),
    eventTimeUnix(ev.eventTime),
    hexToBytes(ev.blinding),
  );
}

export function orgCommitment(org: Organization): Uint8Array {
  return pureCircuits.deriveOrgCommitment(hexToBytes(org.orgSecret));
}

export function caseTag(caseId: string, lineageToken: string): Uint8Array {
  return pureCircuits.deriveCaseTag(hexToBytes(caseId), hexToBytes(lineageToken));
}

export function orgNullifier(caseId: string, orgSecret: string): Uint8Array {
  return pureCircuits.deriveOrgNullifier(hexToBytes(caseId), hexToBytes(orgSecret));
}

/**
 * Product predicate hash. The GTIN is public; we derive a 32-byte predicate
 * hash from it deterministically. We reuse the contract's org-commitment
 * derivation shape only for a stable 32-byte encoding? No — that would be a
 * separate hashing path. Instead we encode the GTIN into a 32-byte value the
 * SAME way on both sides (left-padded ASCII), which is what the circuit's
 * productHash field is compared against. The case's productHash and each
 * event's productHash are both produced by THIS function, so they match by
 * construction.
 */
export function productHash(gtin: string): Uint8Array {
  const bytes = new TextEncoder().encode(`rl:gtin:${gtin}`);
  const out = new Uint8Array(32);
  // left-pad (store in the low bytes); throws if the label is too long.
  if (bytes.length > 32) throw new Error("productHash preimage too long");
  out.set(bytes, 32 - bytes.length);
  return out;
}

export function productHashHex(gtin: string): string {
  return bytesToHex(productHash(gtin));
}
