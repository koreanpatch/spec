/**
 * Ed25519 signing and verification for lexicon verification claims.
 *
 * Uses the same canonicalization as the P-256 flow: the payload is the
 * canonical JSON of the record with the `signature` field stripped.
 * Signatures are base64url-encoded.
 */

import { canonicalize } from "./signing.js";

const ED25519_ALGO: AlgorithmIdentifier = { name: "Ed25519" };

function stripSignature(record: Record<string, unknown>): Record<string, unknown> {
  const { signature: _, ...rest } = record;
  return rest;
}

function base64urlEncode(data: Uint8Array): string {
  const binary = Array.from(data, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(str: string): Uint8Array {
  const padded = str + "=".repeat((4 - (str.length % 4)) % 4);
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/**
 * Sign a record with Ed25519. The signature covers the canonical JSON of
 * the record minus the `signature` field.
 */
export async function signRecordEd25519(
  record: Record<string, unknown>,
  privateKey: CryptoKey,
): Promise<Record<string, unknown>> {
  const stripped = stripSignature(record);
  const data = new TextEncoder().encode(canonicalize(stripped));
  const sig = await crypto.subtle.sign(ED25519_ALGO, privateKey, data);
  const signature = base64urlEncode(new Uint8Array(sig));
  return { ...stripped, signature };
}

/**
 * Verify an Ed25519 signature on a record. Returns true if the signature
 * is valid for the canonical JSON of the record minus the `signature` field.
 */
export async function verifyRecordEd25519(
  record: Record<string, unknown>,
  publicKey: CryptoKey,
): Promise<boolean> {
  const signature = record["signature"];
  if (typeof signature !== "string") return false;

  const stripped = stripSignature(record);
  const data = new TextEncoder().encode(canonicalize(stripped));
  const sig = base64urlDecode(signature);

  return crypto.subtle.verify(ED25519_ALGO, publicKey, sig.buffer as ArrayBuffer, data);
}

/**
 * Generate an Ed25519 key pair for signing and verification.
 */
export async function generateEd25519KeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: "Ed25519" },
    true,
    ["sign", "verify"],
  );
}

/**
 * Export the public key as a JWK for storage or transmission.
 * Ed25519 keys use kty "OKP" and crv "Ed25519".
 */
export async function exportEd25519PublicKey(key: CryptoKey): Promise<JsonWebKey> {
  return crypto.subtle.exportKey("jwk", key);
}

/**
 * Import an Ed25519 public key from JWK format.
 * Expects kty "OKP" and crv "Ed25519".
 */
export async function importEd25519PublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", jwk, { name: "Ed25519" }, true, ["verify"]);
}

/**
 * Import an Ed25519 private key from JWK format.
 * Expects kty "OKP" and crv "Ed25519".
 */
export async function importEd25519PrivateKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", jwk, { name: "Ed25519" }, false, ["sign"]);
}
