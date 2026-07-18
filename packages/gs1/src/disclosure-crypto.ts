/**
 * Field-level encrypted selective disclosure (WebCrypto, browser + Node ≥20).
 *
 * Scheme: ephemeral ECDH P-256 → HKDF-SHA-256 → AES-256-GCM.
 *   - The INVESTIGATOR holds a long-lived P-256 keypair (demo keypair below,
 *     disclosed as synthetic).
 *   - The PARTNER encrypts ONLY the approved fields with a fresh ephemeral
 *     key; the ciphertext + IV + ephemeral public key are the only payload
 *     that transits. Rejected fields never enter the plaintext.
 *   - The investigator derives the same AES key and decrypts.
 */
import { b64url, fromB64url } from "./passport";

const subtle = globalThis.crypto.subtle;

/** Demo investigator keypair — synthetic demo credential, disclosed. */
export const DEMO_INVESTIGATOR_PRIVATE_JWK: JsonWebKey = {
  kty: "EC",
  crv: "P-256",
  d: "ABpXiSZLMCDaVC5qkvwNvtpKOZRF1afVDl74vD8BQV0",
  x: "keTxlmekR4XIvxRJkSTuJjc6D7Q6mjJgEAa5tfNY77o",
  y: "rbIpRE5usiHh4W_cxUOD2NKHCMN-PgZaPWrqD9E9VeE",
  ext: true,
};
export const DEMO_INVESTIGATOR_PUBLIC_JWK: JsonWebKey = {
  kty: "EC",
  crv: "P-256",
  x: DEMO_INVESTIGATOR_PRIVATE_JWK.x,
  y: DEMO_INVESTIGATOR_PRIVATE_JWK.y,
  ext: true,
};

async function deriveAesKey(
  privateKey: CryptoKey,
  publicKey: CryptoKey,
): Promise<CryptoKey> {
  const bits = await subtle.deriveBits({ name: "ECDH", public: publicKey }, privateKey, 256);
  const hkdfKey = await subtle.importKey("raw", bits, "HKDF", false, ["deriveKey"]);
  return subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new TextEncoder().encode("rl-disclosure:v1") as unknown as ArrayBuffer,
      info: new Uint8Array(0) as unknown as ArrayBuffer,
    },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export interface EncryptedDisclosure {
  ciphertext: string; // b64url
  iv: string; // b64url
  ephemeralPublicKey: string; // JSON-stringified JWK, b64url
  ciphertextDigest: string; // hex sha-256 of ciphertext
}

/** Partner side: encrypt ONLY the approved fields for the investigator. */
export async function encryptDisclosure(
  approvedFields: Record<string, string>,
  investigatorPublicJwk: JsonWebKey = DEMO_INVESTIGATOR_PUBLIC_JWK,
): Promise<EncryptedDisclosure> {
  const eph = await subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
    "deriveKey",
  ]);
  const invPub = await subtle.importKey(
    "jwk",
    investigatorPublicJwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const aes = await deriveAesKey(eph.privateKey, invPub);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(approvedFields));
  const ct = new Uint8Array(
    await subtle.encrypt({ name: "AES-GCM", iv: iv as unknown as ArrayBuffer }, aes, plaintext as unknown as ArrayBuffer),
  );
  const ephJwk = await subtle.exportKey("jwk", eph.publicKey);
  const digest = new Uint8Array(await subtle.digest("SHA-256", ct as unknown as ArrayBuffer));
  return {
    ciphertext: b64url(ct),
    iv: b64url(iv),
    ephemeralPublicKey: b64url(new TextEncoder().encode(JSON.stringify(ephJwk))),
    ciphertextDigest: Array.from(digest)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(""),
  };
}

/** Investigator side: decrypt with the long-lived private key. */
export async function decryptDisclosure(
  pkg: EncryptedDisclosure,
  investigatorPrivateJwk: JsonWebKey = DEMO_INVESTIGATOR_PRIVATE_JWK,
): Promise<Record<string, string>> {
  const priv = await subtle.importKey(
    "jwk",
    investigatorPrivateJwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveBits", "deriveKey"],
  );
  const ephJwk = JSON.parse(new TextDecoder().decode(fromB64url(pkg.ephemeralPublicKey))) as JsonWebKey;
  const ephPub = await subtle.importKey("jwk", ephJwk, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const aes = await deriveAesKey(priv, ephPub);
  const pt = await subtle.decrypt(
    { name: "AES-GCM", iv: fromB64url(pkg.iv) as unknown as ArrayBuffer },
    aes,
    fromB64url(pkg.ciphertext) as unknown as ArrayBuffer,
  );
  return JSON.parse(new TextDecoder().decode(new Uint8Array(pt))) as Record<string, string>;
}
