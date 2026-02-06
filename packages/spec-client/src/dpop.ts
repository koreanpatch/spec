import { base64urlEncode, encodeJson, sha256 } from "./crypto.js";

const ES256_ALGO: EcKeyGenParams = { name: "ECDSA", namedCurve: "P-256" };
const ES256_SIGN: EcdsaParams = { name: "ECDSA", hash: "SHA-256" };

export interface DpopKeyPair {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  publicJwk: JsonWebKey;
}

export async function createDpopKeyPair(): Promise<DpopKeyPair> {
  const keyPair = await crypto.subtle.generateKey(ES256_ALGO, false, ["sign", "verify"]);
  const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);

  return {
    privateKey: keyPair.privateKey,
    publicKey: keyPair.publicKey,
    publicJwk,
  };
}

export interface DpopProofOptions {
  keyPair: DpopKeyPair;
  method: string;
  url: string;
  nonce?: string;
  accessToken?: string;
}

export async function createDpopProof(options: DpopProofOptions): Promise<string> {
  const header = {
    typ: "dpop+jwt",
    alg: "ES256",
    jwk: {
      kty: options.keyPair.publicJwk.kty,
      crv: options.keyPair.publicJwk.crv,
      x: options.keyPair.publicJwk.x,
      y: options.keyPair.publicJwk.y,
    },
  };

  const payload: Record<string, unknown> = {
    jti: crypto.randomUUID(),
    htm: options.method,
    htu: options.url,
    iat: Math.floor(Date.now() / 1000),
  };

  if (options.nonce) {
    payload["nonce"] = options.nonce;
  }

  if (options.accessToken) {
    payload["ath"] = await sha256(options.accessToken);
  }

  const signingInput = `${encodeJson(header)}.${encodeJson(payload)}`;
  const data = new TextEncoder().encode(signingInput);
  const signature = await crypto.subtle.sign(ES256_SIGN, options.keyPair.privateKey, data);

  return `${signingInput}.${base64urlEncode(new Uint8Array(signature))}`;
}
