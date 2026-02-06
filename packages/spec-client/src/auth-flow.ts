import { createDpopKeyPair, createDpopProof } from "./dpop.js";
import type { DpopKeyPair } from "./dpop.js";
import { generateRandomString, sha256 } from "./crypto.js";

export interface AuthFlowConfig {
  issuer: string;
  clientId: string;
  redirectUri: string;
  scope?: string;
  loginHint?: string;
}

export interface AuthSession {
  issuer: string;
  clientId: string;
  redirectUri: string;
  state: string;
  codeVerifier: string;
  dpopKeyPair: DpopKeyPair;
  dpopNonce: string | null;
}

export interface AuthFlowResult {
  authorizeUrl: string;
  session: AuthSession;
}

export async function startAuthFlow(config: AuthFlowConfig): Promise<AuthFlowResult> {
  const dpopKeyPair = await createDpopKeyPair();
  const state = generateRandomString(32);
  const codeVerifier = generateRandomString(43);
  const codeChallenge = await sha256(codeVerifier);
  const scope = config.scope ?? "atproto";

  const parUrl = `${config.issuer}/oauth/par`;

  const dpopProof = await createDpopProof({
    keyPair: dpopKeyPair,
    method: "POST",
    url: parUrl,
  });

  const parBody = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    scope,
    state,
  });

  if (config.loginHint) {
    parBody.set("login_hint", config.loginHint);
  }

  const parResponse = await fetch(parUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "DPoP": dpopProof,
    },
    body: parBody.toString(),
  });

  if (!parResponse.ok) {
    const error = await parResponse.json() as { error: string; error_description?: string };
    throw new Error(`PAR failed: ${error.error} ${error.error_description ?? ""}`);
  }

  const dpopNonce = parResponse.headers.get("DPoP-Nonce");
  const parResult = await parResponse.json() as { request_uri: string; expires_in: number };

  const authorizeParams = new URLSearchParams({
    request_uri: parResult.request_uri,
    client_id: config.clientId,
  });

  const authorizeUrl = `${config.issuer}/oauth/authorize?${authorizeParams.toString()}`;

  return {
    authorizeUrl,
    session: {
      issuer: config.issuer,
      clientId: config.clientId,
      redirectUri: config.redirectUri,
      state,
      codeVerifier,
      dpopKeyPair,
      dpopNonce,
    },
  };
}
