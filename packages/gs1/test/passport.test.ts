import { describe, it, expect } from "vitest";
import {
  issuePassport,
  verifyPassport,
  passportToDigitalLink,
  passportFromDigitalLink,
  passportCommitment,
} from "../src/passport";
import { encryptDisclosure, decryptDisclosure } from "../src/disclosure-crypto";

const DATA = { gtin: "00810099110042", lot: "NFP-SHRED-26164-07", expiry: "2026-06-28" };

describe("Product Passport (ECDSA P-256)", () => {
  it("issues and verifies a signed passport", async () => {
    const p = await issuePassport(DATA);
    expect(p.passportId).toMatch(/^[0-9a-f]{32}$/);
    const v = await verifyPassport(p);
    expect(v.valid).toBe(true);
    expect(v.tampered).toBe(false);
    expect(v.commitment).toMatch(/^[0-9a-f]{64}$/);
  });

  it("detects tampering (lot changed after signing)", async () => {
    const p = await issuePassport(DATA);
    const v = await verifyPassport({ ...p, lot: "EVIL-LOT-999" });
    expect(v.valid).toBe(false);
    expect(v.tampered).toBe(true);
  });

  it("detects a forged signature", async () => {
    const p = await issuePassport(DATA);
    const v = await verifyPassport({ ...p, signature: p.signature.slice(0, -4) + "AAAA" });
    expect(v.valid).toBe(false);
  });

  it("round-trips through a GS1 Digital Link QR payload", async () => {
    const p = await issuePassport(DATA);
    const link = passportToDigitalLink(p);
    expect(link).toContain("/01/00810099110042/10/NFP-SHRED-26164-07/17/260628");
    expect(link).toContain("rlp=");
    const back = passportFromDigitalLink(link);
    expect(back).not.toBeNull();
    const v = await verifyPassport(back!);
    expect(v.valid).toBe(true);
  });

  it("QR contains no secrets (no lineage token, key material, or seed)", async () => {
    const p = await issuePassport(DATA);
    const link = passportToDigitalLink(p);
    // affected lineage token from fixtures must never appear
    expect(link).not.toContain("7f3a2b911d4e5f60");
    // private key scalar must never appear
    expect(link).not.toContain("KcHCO3Y3lTk8");
    // genesis seed pattern
    expect(link).not.toMatch(/0{20,}1/);
  });

  it("commitment is stable and bound to passportId (not lot-brute-forceable)", async () => {
    const p = await issuePassport(DATA);
    const c1 = await passportCommitment(p);
    const c2 = await passportCommitment(p);
    expect(c1).toBe(c2);
    const other = await issuePassport(DATA); // same lot, different passportId
    expect(await passportCommitment(other)).not.toBe(c1);
  });
});

describe("Encrypted selective disclosure (ECDH + AES-GCM)", () => {
  it("encrypts approved fields; investigator decrypts them", async () => {
    const approved = { sourceGln: "0810099000017", lotCode: "SVG-ICE-26162-A", eventDate: "2026-06-11" };
    const pkg = await encryptDisclosure(approved);
    expect(pkg.ciphertext.length).toBeGreaterThan(20);
    const decrypted = await decryptDisclosure(pkg);
    expect(decrypted).toEqual(approved);
  });

  it("ciphertext excludes unapproved fields", async () => {
    const pkg = await encryptDisclosure({ lotCode: "SVG-ICE-26162-A" });
    const decrypted = await decryptDisclosure(pkg);
    expect(Object.keys(decrypted)).toEqual(["lotCode"]);
    expect(decrypted).not.toHaveProperty("destinationGln");
    // and the raw ciphertext can't contain the unapproved value at all
    expect(pkg.ciphertext).not.toContain("0810099000048");
  });

  it("tampered ciphertext fails to decrypt (GCM auth)", async () => {
    const pkg = await encryptDisclosure({ lotCode: "X" });
    const bad = { ...pkg, ciphertext: pkg.ciphertext.slice(0, -4) + "AAAA" };
    await expect(decryptDisclosure(bad)).rejects.toThrow();
  });
});
