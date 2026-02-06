export async function generateMasterKey(): Promise<CryptoKey> {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  return crypto.subtle.importKey(
    "raw",
    raw.buffer as ArrayBuffer,
    "HKDF",
    false,
    ["deriveBits", "deriveKey"],
  );
}

export async function exportMasterKeyMaterial(masterKey: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", masterKey);
  return base64urlEncode(new Uint8Array(raw));
}

export async function importMasterKeyMaterial(encoded: string): Promise<CryptoKey> {
  const raw = base64urlDecode(encoded);
  return crypto.subtle.importKey(
    "raw",
    raw.buffer as ArrayBuffer,
    "HKDF",
    false,
    ["deriveBits", "deriveKey"],
  );
}

export async function deriveAppKey(
  masterKey: CryptoKey,
  appDid: string,
): Promise<CryptoKey> {
  const info = new TextEncoder().encode(`spec-app-key:${appDid}`);
  const keyMaterial = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(0),
      info,
    },
    masterKey,
    256,
  );

  return crypto.subtle.importKey(
    "raw",
    keyMaterial,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

export interface EncryptedEnvelope {
  appDid: string;
  iv: string;
  ct: string;
}

export async function encryptField(
  plaintext: string,
  masterKey: CryptoKey,
  appDid: string,
): Promise<string> {
  const appKey = await deriveAppKey(masterKey, appDid);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, appKey, data);

  const envelope: EncryptedEnvelope = {
    appDid,
    iv: base64urlEncode(iv),
    ct: base64urlEncode(new Uint8Array(ciphertext)),
  };

  return base64urlEncode(new TextEncoder().encode(JSON.stringify(envelope)));
}

export async function decryptField(
  encrypted: string,
  masterKey: CryptoKey,
): Promise<{ plaintext: string; appDid: string }> {
  const envelopeBytes = base64urlDecode(encrypted);
  const envelope = JSON.parse(new TextDecoder().decode(envelopeBytes)) as EncryptedEnvelope;

  const appKey = await deriveAppKey(masterKey, envelope.appDid);
  const iv = base64urlDecode(envelope.iv);
  const ct = base64urlDecode(envelope.ct);

  const data = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
    appKey,
    ct.buffer as ArrayBuffer,
  );

  return {
    plaintext: new TextDecoder().decode(data),
    appDid: envelope.appDid,
  };
}

export function parseEncryptedEnvelope(encrypted: string): EncryptedEnvelope {
  const bytes = base64urlDecode(encrypted);
  return JSON.parse(new TextDecoder().decode(bytes)) as EncryptedEnvelope;
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
