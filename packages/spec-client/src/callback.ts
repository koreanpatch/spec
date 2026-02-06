import type { AuthSession } from "./auth-flow.js";

export interface CallbackResult {
  code: string;
  state: string;
  iss: string;
}

export function handleCallback(callbackUrl: string, session: AuthSession): CallbackResult {
  const url = new URL(callbackUrl);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const iss = url.searchParams.get("iss");

  if (!code || !state || !iss) {
    throw new Error("Missing required callback parameters: code, state, or iss");
  }

  if (state !== session.state) {
    throw new Error("State mismatch: possible CSRF attack");
  }

  if (iss !== session.issuer) {
    throw new Error("Issuer mismatch: authorization server identity verification failed");
  }

  return { code, state, iss };
}
