import { decodeJson, base64urlDecode } from "./keys.js";
import { computeJktThumbprint } from "./jwt.js";

const ES256_IMPORT: EcKeyImportParams = { name: "ECDSA", namedCurve: "P-256" };
const ES256_VERIFY: EcdsaParams = { name: "ECDSA", hash: "SHA-256" };
const MAX_IAT_DRIFT_SECONDS = 300;

interface DpopHeader {
  typ: string;
  alg: string;
  jwk: JsonWebKey;
}

interface DpopPayload {
  jti: string;
  htm: string;
  htu: string;
  iat: number;
  nonce?: string;
  ath?: string;
}

interface DpopResult {
  valid: true;
  jkt: string;
  nonce?: string;
}

interface DpopError {
  valid: false;
  reason: string;
}

const recentJtis = new Map<string, number>();

setInterval(() => {
  const cutoff = Date.now() - MAX_IAT_DRIFT_SECONDS * 2 * 1000;
  for (const [jti, ts] of recentJtis) {
    if (ts < cutoff) {
      recentJtis.delete(jti);
    }
  }
}, 60_000);

export async function verifyDpopProof(
  proof: string,
  expectedMethod: string,
  expectedUrl: string,
): Promise<DpopResult | DpopError> {
  const parts = proof.split(".");
  if (parts.length !== 3) {
    return { valid: false, reason: "Malformed DPoP proof" };
  }

  const [headerStr, payloadStr, signatureStr] = parts as [string, string, string];

  let header: DpopHeader;
  let payload: DpopPayload;
  try {
    header = decodeJson<DpopHeader>(headerStr);
    payload = decodeJson<DpopPayload>(payloadStr);
  } catch {
    return { valid: false, reason: "Failed to decode DPoP proof" };
  }

  if (header.typ !== "dpop+jwt") {
    return { valid: false, reason: "Invalid DPoP typ header" };
  }

  if (header.alg !== "ES256") {
    return { valid: false, reason: "Unsupported DPoP algorithm" };
  }

  if (!header.jwk?.kty || !header.jwk?.x || !header.jwk?.y) {
    return { valid: false, reason: "Missing JWK in DPoP header" };
  }

  if (payload.htm !== expectedMethod) {
    return { valid: false, reason: "DPoP htm mismatch" };
  }

  if (payload.htu !== expectedUrl) {
    return { valid: false, reason: "DPoP htu mismatch" };
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - payload.iat) > MAX_IAT_DRIFT_SECONDS) {
    return { valid: false, reason: "DPoP iat outside acceptable window" };
  }

  if (recentJtis.has(payload.jti)) {
    return { valid: false, reason: "DPoP jti replay detected" };
  }

  let publicKey: CryptoKey;
  try {
    publicKey = await crypto.subtle.importKey(
      "jwk",
      { ...header.jwk, key_ops: ["verify"] },
      ES256_IMPORT,
      true,
      ["verify"],
    );
  } catch {
    return { valid: false, reason: "Failed to import DPoP public key" };
  }

  const signingInput = new TextEncoder().encode(`${headerStr}.${payloadStr}`);
  const signature = base64urlDecode(signatureStr);

  let signatureValid: boolean;
  try {
    signatureValid = await crypto.subtle.verify(ES256_VERIFY, publicKey, signature.buffer as ArrayBuffer, signingInput);
  } catch {
    return { valid: false, reason: "DPoP signature verification failed" };
  }

  if (!signatureValid) {
    return { valid: false, reason: "Invalid DPoP signature" };
  }

  recentJtis.set(payload.jti, Date.now());

  const jkt = await computeJktThumbprint(header.jwk);

  return { valid: true, jkt, nonce: payload.nonce };
}
