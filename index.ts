import { p256 } from "@noble/curves/nist.js";
import { parseMultikey, multibaseToBytes } from "@atproto/crypto";
import canonicalize from "canonicalize";

export function stripMulticodecHeader(bytes: Uint8Array): Uint8Array {
  if (bytes.length !== 34) throw new Error(`Expected 34-byte P-256 private key, got ${bytes.length}`);
  return bytes.slice(2);
}

/**
 * Canonicalizes a record (RFC 8785), then signs with the given ECDSA P-256
 * private key (base58 multibase string, e.g. from `goat key generate`).
 * Returns a base64url-encoded signature.
 */
export function signRecord(record: unknown, privateKey: string): string {
  const canonical = canonicalize(record)!;
  const sig = p256.sign(
    new TextEncoder().encode(canonical),
    stripMulticodecHeader(multibaseToBytes(privateKey))
  );
  return sig.toBase64({ alphabet: "base64url", omitPadding: true });
}

/**
 * Canonicalizes a record (RFC 8785) and verifies the given base64url signature
 * against the provided ECDSA P-256 public key expressed as an ATProto multikey string.
 */
export function verifyRecord(
  record: unknown,
  signature: string,
  publicKey: string,
): boolean {
  const publicKeyParsed = publicKey.startsWith("did:key:") ? publicKey.slice(8) : publicKey;
  const canonical = canonicalize(record)!;
  const { keyBytes } = parseMultikey(publicKeyParsed);
  return p256.verify(
    Uint8Array.fromBase64(signature, { alphabet: "base64url" }),
    new TextEncoder().encode(canonical),
    keyBytes
  );
}
