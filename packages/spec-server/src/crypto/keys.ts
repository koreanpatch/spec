const ES256_ALGO: EcKeyGenParams = { name: "ECDSA", namedCurve: "P-256" };

let signingKeyPair: CryptoKeyPair | null = null;

export async function getSigningKeyPair(): Promise<CryptoKeyPair> {
  if (!signingKeyPair) {
    signingKeyPair = await crypto.subtle.generateKey(ES256_ALGO, false, ["sign", "verify"]);
  }
  return signingKeyPair;
}

export async function getPublicJwk(): Promise<JsonWebKey> {
  const { publicKey } = await getSigningKeyPair();
  return crypto.subtle.exportKey("jwk", publicKey);
}

export function base64urlEncode(data: Uint8Array): string {
  return Buffer.from(data).toString("base64url");
}

export function base64urlDecode(str: string): Uint8Array {
  return new Uint8Array(Buffer.from(str, "base64url"));
}

export function encodeJson(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

export function decodeJson<T = unknown>(str: string): T {
  return JSON.parse(Buffer.from(str, "base64url").toString("utf-8")) as T;
}
