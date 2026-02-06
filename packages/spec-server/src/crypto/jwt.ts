import { getSigningKeyPair, encodeJson, decodeJson, base64urlEncode, base64urlDecode } from "./keys.js";

const ES256_SIGN: EcdsaParams = { name: "ECDSA", hash: "SHA-256" };
const ACCESS_TOKEN_TTL_SECONDS = 900;

interface AccessTokenClaims {
  sub: string;
  client_id: string;
  scope: string;
  jkt: string;
}

interface AccessTokenPayload {
  sub: string;
  client_id: string;
  scope: string;
  cnf: { jkt: string };
  iat: number;
  exp: number;
  iss: string;
  jti: string;
}

export async function signAccessToken(claims: AccessTokenClaims): Promise<string> {
  const { privateKey } = await getSigningKeyPair();
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "ES256", typ: "at+jwt" };
  const payload: AccessTokenPayload = {
    sub: claims.sub,
    client_id: claims.client_id,
    scope: claims.scope,
    cnf: { jkt: claims.jkt },
    iat: now,
    exp: now + ACCESS_TOKEN_TTL_SECONDS,
    iss: process.env["ISSUER_URL"] ?? "http://localhost:3000",
    jti: crypto.randomUUID(),
  };

  const signingInput = `${encodeJson(header)}.${encodeJson(payload)}`;
  const data = new TextEncoder().encode(signingInput);
  const signature = await crypto.subtle.sign(ES256_SIGN, privateKey, data);

  return `${signingInput}.${base64urlEncode(new Uint8Array(signature))}`;
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed JWT");
  }

  const [headerStr, payloadStr, signatureStr] = parts as [string, string, string];
  const header = decodeJson<{ alg: string }>(headerStr);

  if (header.alg !== "ES256") {
    throw new Error("Unsupported algorithm");
  }

  const { publicKey } = await getSigningKeyPair();
  const signingInput = new TextEncoder().encode(`${headerStr}.${payloadStr}`);
  const signature = base64urlDecode(signatureStr);

  const valid = await crypto.subtle.verify(ES256_SIGN, publicKey, signature.buffer as ArrayBuffer, signingInput);
  if (!valid) {
    throw new Error("Invalid signature");
  }

  const payload = decodeJson<AccessTokenPayload>(payloadStr);
  const now = Math.floor(Date.now() / 1000);

  if (payload.exp <= now) {
    throw new Error("Token expired");
  }

  return payload;
}

export async function computeJktThumbprint(jwk: JsonWebKey): Promise<string> {
  const ordered = JSON.stringify({
    crv: jwk.crv,
    kty: jwk.kty,
    x: jwk.x,
    y: jwk.y,
  });

  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ordered));
  return base64urlEncode(new Uint8Array(hash));
}
