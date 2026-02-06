const encoder = new TextEncoder();

export function base64urlEncode(data: Uint8Array): string {
  const binary = Array.from(data, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64urlDecode(str: string): Uint8Array {
  const padded = str + "=".repeat((4 - (str.length % 4)) % 4);
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export function encodeJson(obj: unknown): string {
  return base64urlEncode(encoder.encode(JSON.stringify(obj)));
}

export function decodeJson<T = unknown>(str: string): T {
  const bytes = base64urlDecode(str);
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

export async function computeJwkThumbprint(jwk: JsonWebKey): Promise<string> {
  const ordered = JSON.stringify({
    crv: jwk.crv,
    kty: jwk.kty,
    x: jwk.x,
    y: jwk.y,
  });

  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(ordered));
  return base64urlEncode(new Uint8Array(hash));
}

export async function sha256(input: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return base64urlEncode(new Uint8Array(hash));
}

export function generateRandomString(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return base64urlEncode(bytes);
}
