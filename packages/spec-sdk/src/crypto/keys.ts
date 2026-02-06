const ES256_ALGO: EcKeyGenParams = { name: "ECDSA", namedCurve: "P-256" };

export async function importEcPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", jwk, ES256_ALGO, true, ["verify"]);
}

export async function importEcPrivateKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", jwk, ES256_ALGO, false, ["sign"]);
}

export async function exportEcPublicKey(key: CryptoKey): Promise<JsonWebKey> {
  return crypto.subtle.exportKey("jwk", key);
}

export async function jwkToString(jwk: JsonWebKey): Promise<string> {
  return JSON.stringify(jwk);
}

export async function stringToJwk(str: string): Promise<JsonWebKey> {
  return JSON.parse(str) as JsonWebKey;
}

export async function computeJwkThumbprint(jwk: JsonWebKey): Promise<string> {
  const ordered = JSON.stringify({
    crv: jwk.crv,
    kty: jwk.kty,
    x: jwk.x,
    y: jwk.y,
  });

  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(ordered),
  );

  return base64urlEncode(new Uint8Array(hash));
}

function base64urlEncode(data: Uint8Array): string {
  const binary = Array.from(data, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
