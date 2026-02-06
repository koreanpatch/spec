const ES256_ALGO: EcKeyGenParams = { name: "ECDSA", namedCurve: "P-256" };
const ES256_SIGN: EcdsaParams = { name: "ECDSA", hash: "SHA-256" };

export function canonicalize(obj: unknown): string {
  if (obj === null || obj === undefined) return "null";
  if (typeof obj === "boolean" || typeof obj === "number") return JSON.stringify(obj);
  if (typeof obj === "string") return JSON.stringify(obj);
  if (Array.isArray(obj)) return `[${obj.map(canonicalize).join(",")}]`;
  if (typeof obj === "object") {
    const sorted = Object.keys(obj as Record<string, unknown>).sort();
    const entries = sorted.map(
      (k) => `${JSON.stringify(k)}:${canonicalize((obj as Record<string, unknown>)[k])}`,
    );
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(obj);
}

function stripSignature(record: Record<string, unknown>): Record<string, unknown> {
  const { signature: _, ...rest } = record;
  return rest;
}

export async function signRecord(
  record: Record<string, unknown>,
  privateKey: CryptoKey,
): Promise<Record<string, unknown>> {
  const stripped = stripSignature(record);
  const data = new TextEncoder().encode(canonicalize(stripped));
  const sig = await crypto.subtle.sign(ES256_SIGN, privateKey, data);
  const signature = base64urlEncode(new Uint8Array(sig));
  return { ...stripped, signature };
}

export async function verifyRecord(
  record: Record<string, unknown>,
  publicKey: CryptoKey,
): Promise<boolean> {
  const signature = record["signature"];
  if (typeof signature !== "string") return false;

  const stripped = stripSignature(record);
  const data = new TextEncoder().encode(canonicalize(stripped));
  const sig = base64urlDecode(signature);

  return crypto.subtle.verify(ES256_SIGN, publicKey, sig.buffer as ArrayBuffer, data);
}

export async function generateSigningKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(ES256_ALGO, true, ["sign", "verify"]);
}

export async function exportSigningPublicKey(keyPair: CryptoKeyPair): Promise<JsonWebKey> {
  return crypto.subtle.exportKey("jwk", keyPair.publicKey);
}

export async function importSigningPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    ES256_ALGO,
    true,
    ["verify"],
  );
}

export async function importSigningPrivateKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    ES256_ALGO,
    false,
    ["sign"],
  );
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
