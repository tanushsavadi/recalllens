/**
 * RecallLens Product Passport — a signed, GS1 Digital Link-compatible product
 * credential.
 *
 * Signature scheme: ECDSA P-256 with SHA-256 via WebCrypto (available in every
 * evergreen browser AND Node ≥ 20 as globalThis.crypto.subtle) — documented in
 * docs/PRODUCT_PASSPORT.md. Demo issuer keys are generated deterministically
 * from a checked-in seed so the demo is reproducible; this is disclosed and
 * would be an HSM-held key in production.
 *
 * The passport contains NO lineage token, org secret, private key, wallet
 * seed, EPCIS record, or route. Its commitment is derived from the
 * high-entropy passportId (128-bit random) + identifiers, so the public
 * commitment cannot be brute-forced from a predictable lot alone.
 *
 * QR payload format (GS1 Digital Link + rl extensions in the query string):
 *   https://id.recalllens.demo/01/{gtin}/10/{lot}/17/{yymmdd}
 *     ?rlp={passportId}&iss={issuer}&sig={base64url(ECDSA sig over canonical payload)}
 */
import { buildGs1DigitalLink, parseGs1DigitalLink, type Gs1Data } from "./gs1";

const subtle = globalThis.crypto.subtle;

export interface ProductPassport {
  gtin: string;
  lot: string;
  expiry: string; // ISO
  /** random high-entropy passport id (hex, 16 bytes = 32 hex chars) */
  passportId: string;
  issuer: string; // issuer identifier
  issuerCredentialRef: string; // reference to the issuer credential (demo)
  signature: string; // base64url ECDSA P-256/SHA-256
}

export interface VerifiedPassport {
  passport: ProductPassport;
  valid: boolean;
  tampered: boolean;
  /** hex sha-256 commitment used for hold-set membership */
  commitment: string;
}

/* ── canonical bytes that get signed ───────────────────────────────────── */

function canonicalPayload(p: Omit<ProductPassport, "signature">): Uint8Array {
  return new TextEncoder().encode(
    `rl-passport:v1|${p.gtin}|${p.lot}|${p.expiry}|${p.passportId}|${p.issuer}|${p.issuerCredentialRef}`,
  );
}

/* ── base64url helpers ─────────────────────────────────────────────────── */

export function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function fromB64url(s: string): Uint8Array {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}

/* ── demo issuer keys ──────────────────────────────────────────────────── */
/**
 * The demo issuer keypair is fixed via a checked-in JWK so labels printed
 * before the demo still verify. PUBLIC key ships with the app; the PRIVATE
 * key is used only by the label generator and Sentinel seeding. Both are
 * synthetic demo credentials (disclosed), never production secrets.
 */
export const DEMO_ISSUER_ID = "rl-demo-issuer-1";
export const DEMO_ISSUER_CREDENTIAL_REF = "did:demo:recalllens:issuer:1";

export const DEMO_ISSUER_PRIVATE_JWK: JsonWebKey = {
  kty: "EC",
  crv: "P-256",
  d: "KcHCO3Y3lTk8S0OGyd0rzbwrvPD_koCrB-13EshFiYg",
  x: "ALUtKxtkQtiNGP6bVn2afyz4mQTqyeqktujy-tcV30Q",
  y: "Qi8Ji9_fz1c_aUr9oVe6_WJrx3BBTyy-gjGlbp9Y6_M",
  ext: true,
};
export const DEMO_ISSUER_PUBLIC_JWK: JsonWebKey = {
  kty: "EC",
  crv: "P-256",
  x: DEMO_ISSUER_PRIVATE_JWK.x,
  y: DEMO_ISSUER_PRIVATE_JWK.y,
  ext: true,
};

async function importSigningKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}
async function importVerifyKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
}

/* ── issue / verify ────────────────────────────────────────────────────── */

export async function issuePassport(
  data: Gs1Data & { passportId?: string },
  issuerPrivateJwk: JsonWebKey = DEMO_ISSUER_PRIVATE_JWK,
  issuer: string = DEMO_ISSUER_ID,
): Promise<ProductPassport> {
  if (!data.lot || !data.expiry) throw new Error("passport requires lot and expiry");
  const passportId =
    data.passportId ??
    Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  const unsigned = {
    gtin: data.gtin,
    lot: data.lot,
    expiry: data.expiry,
    passportId,
    issuer,
    issuerCredentialRef: DEMO_ISSUER_CREDENTIAL_REF,
  };
  const key = await importSigningKey(issuerPrivateJwk);
  const sig = await subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    canonicalPayload(unsigned) as unknown as ArrayBuffer,
  );
  return { ...unsigned, signature: b64url(new Uint8Array(sig)) };
}

export async function verifyPassport(
  p: ProductPassport,
  issuerPublicJwk: JsonWebKey = DEMO_ISSUER_PUBLIC_JWK,
): Promise<VerifiedPassport> {
  let valid = false;
  try {
    const key = await importVerifyKey(issuerPublicJwk);
    valid = await subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      fromB64url(p.signature) as unknown as ArrayBuffer,
      canonicalPayload(p) as unknown as ArrayBuffer,
    );
  } catch {
    valid = false;
  }
  return {
    passport: p,
    valid,
    tampered: !valid,
    commitment: await passportCommitment(p),
  };
}

/**
 * Hold-set membership commitment: sha-256 over the high-entropy passportId +
 * identifiers. Because passportId is 128-bit random, the commitment cannot be
 * brute-forced from a guessable lot alone.
 */
export async function passportCommitment(
  p: Pick<ProductPassport, "gtin" | "lot" | "passportId">,
): Promise<string> {
  const bytes = new TextEncoder().encode(
    `rl-passport-commit:v1|${p.gtin}|${p.lot}|${p.passportId}`,
  );
  const digest = await subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/* ── QR encode / decode ────────────────────────────────────────────────── */

export function passportToDigitalLink(p: ProductPassport, base = "https://id.recalllens.demo"): string {
  const link = buildGs1DigitalLink(base, { gtin: p.gtin, lot: p.lot, expiry: p.expiry });
  const q = new URLSearchParams({ rlp: p.passportId, iss: p.issuer, sig: p.signature });
  return `${link}?${q.toString()}`;
}

export function passportFromDigitalLink(url: string): ProductPassport | null {
  try {
    const u = new URL(url);
    const rlp = u.searchParams.get("rlp");
    const iss = u.searchParams.get("iss");
    const sig = u.searchParams.get("sig");
    if (!rlp || !iss || !sig) return null;
    const gs1 = parseGs1DigitalLink(url.split("?")[0]);
    if (!gs1.lot || !gs1.expiry) return null;
    return {
      gtin: gs1.gtin,
      lot: gs1.lot,
      expiry: gs1.expiry,
      passportId: rlp,
      issuer: iss,
      issuerCredentialRef: DEMO_ISSUER_CREDENTIAL_REF,
      signature: sig,
    };
  } catch {
    return null;
  }
}
