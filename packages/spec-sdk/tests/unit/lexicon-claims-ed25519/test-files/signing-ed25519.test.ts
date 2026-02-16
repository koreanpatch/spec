import { describe, it, expect } from "vitest";
import {
  signRecordEd25519,
  verifyRecordEd25519,
  generateEd25519KeyPair,
  exportEd25519PublicKey,
  importEd25519PublicKey,
  importEd25519PrivateKey,
} from "../../../src/crypto/signing-ed25519.js";

const sampleClaim = {
  record: "at://did:plc:abc123/com.example.lexicon/vocab-1",
  date: "2026-02-16T12:00:00Z",
  signedBy: "did:plc:xyz789",
};

describe("signRecordEd25519", () => {
  it("adds a signature to the record", async () => {
    const keyPair = await generateEd25519KeyPair();
    const signed = await signRecordEd25519(sampleClaim, keyPair.privateKey);
    expect(signed).toHaveProperty("signature");
    expect(typeof (signed as { signature: string }).signature).toBe("string");
    expect((signed as { signature: string }).signature.length).toBeGreaterThan(0);
  });
});

describe("verifyRecordEd25519", () => {
  it("returns true for a valid signature", async () => {
    const keyPair = await generateEd25519KeyPair();
    const signed = await signRecordEd25519(sampleClaim, keyPair.privateKey);
    expect(await verifyRecordEd25519(signed, keyPair.publicKey)).toBe(true);
  });

  it("returns false when verified with a different key", async () => {
    const keyPairA = await generateEd25519KeyPair();
    const keyPairB = await generateEd25519KeyPair();
    const signed = await signRecordEd25519(sampleClaim, keyPairA.privateKey);
    expect(await verifyRecordEd25519(signed, keyPairB.publicKey)).toBe(false);
  });

  it("returns false when the record was modified after signing", async () => {
    const keyPair = await generateEd25519KeyPair();
    const signed = await signRecordEd25519(sampleClaim, keyPair.privateKey);
    const modified = { ...signed, record: "at://did:plc:other/com.other/record" };
    expect(await verifyRecordEd25519(modified, keyPair.publicKey)).toBe(false);
  });

  it("returns false when signature is missing", async () => {
    const keyPair = await generateEd25519KeyPair();
    expect(await verifyRecordEd25519(sampleClaim, keyPair.publicKey)).toBe(false);
  });
});

describe("key export and import", () => {
  it("exported public key JWK has correct kty and crv", async () => {
    const keyPair = await generateEd25519KeyPair();
    const jwk = await exportEd25519PublicKey(keyPair.publicKey);
    expect(jwk.kty).toBe("OKP");
    expect(jwk.crv).toBe("Ed25519");
  });

  it("imported public key can verify signatures", async () => {
    const keyPair = await generateEd25519KeyPair();
    const jwk = await exportEd25519PublicKey(keyPair.publicKey);
    const imported = await importEd25519PublicKey(jwk);
    const signed = await signRecordEd25519(sampleClaim, keyPair.privateKey);
    expect(await verifyRecordEd25519(signed, imported)).toBe(true);
  });

  it("imported private key can sign", async () => {
    const keyPair = await generateEd25519KeyPair();
    const privateJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
    const imported = await importEd25519PrivateKey(privateJwk);
    const signed = await signRecordEd25519(sampleClaim, imported);
    expect(await verifyRecordEd25519(signed, keyPair.publicKey)).toBe(true);
  });
});
