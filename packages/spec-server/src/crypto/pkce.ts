export async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Buffer.from(hash).toString("base64url");
}

export async function verifyCodeChallenge(verifier: string, challenge: string): Promise<boolean> {
  const computed = await generateCodeChallenge(verifier);
  return computed === challenge;
}
