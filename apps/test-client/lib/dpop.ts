const KEY_STORAGE_KEY = "spec_dpop_keys";

interface StoredKeys {
  publicKey: JsonWebKey;
  privateKey: JsonWebKey;
}

function base64urlEncode(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function generateKeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
}

async function exportKeys(keyPair: CryptoKeyPair): Promise<StoredKeys> {
  const publicKey = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const privateKey = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
  return { publicKey, privateKey };
}

async function importKeys(stored: StoredKeys): Promise<CryptoKeyPair> {
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    stored.publicKey,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["verify"],
  );
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    stored.privateKey,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign"],
  );
  return { publicKey, privateKey } as CryptoKeyPair;
}

export async function getOrCreateKeyPair(): Promise<{
  keyPair: CryptoKeyPair;
  publicJwk: JsonWebKey;
}> {
  const stored = sessionStorage.getItem(KEY_STORAGE_KEY);
  if (stored) {
    const keys: StoredKeys = JSON.parse(stored);
    const keyPair = await importKeys(keys);
    return { keyPair, publicJwk: keys.publicKey };
  }

  const keyPair = await generateKeyPair();
  const exported = await exportKeys(keyPair);
  sessionStorage.setItem(KEY_STORAGE_KEY, JSON.stringify(exported));
  return { keyPair, publicJwk: exported.publicKey };
}

export async function createDpopProof(
  privateKey: CryptoKey,
  publicJwk: JsonWebKey,
  method: string,
  url: string,
  nonce?: string,
): Promise<string> {
  const header = {
    typ: "dpop+jwt",
    alg: "ES256",
    jwk: {
      kty: publicJwk.kty,
      crv: publicJwk.crv,
      x: publicJwk.x,
      y: publicJwk.y,
    },
  };

  const payload: Record<string, unknown> = {
    jti: crypto.randomUUID(),
    htm: method,
    htu: url,
    iat: Math.floor(Date.now() / 1000),
  };

  if (nonce) {
    payload.nonce = nonce;
  }

  const encodedHeader = base64urlEncode(
    new TextEncoder().encode(JSON.stringify(header)),
  );
  const encodedPayload = base64urlEncode(
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    new TextEncoder().encode(signingInput),
  );

  const encodedSignature = base64urlEncode(signature);
  return `${signingInput}.${encodedSignature}`;
}

export function clearKeys(): void {
  sessionStorage.removeItem(KEY_STORAGE_KEY);
}
