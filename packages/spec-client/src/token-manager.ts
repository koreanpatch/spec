import { createDpopProof } from "./dpop.js";
import type { DpopKeyPair } from "./dpop.js";
import type { AuthSession } from "./auth-flow.js";

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  sub: string;
  scope: string;
}

export interface FetchTokensParams {
  code: string;
  session: AuthSession;
}

export async function fetchTokens(params: FetchTokensParams): Promise<TokenResponse> {
  const tokenUrl = `${params.session.issuer}/oauth/token`;

  const dpopProof = await createDpopProof({
    keyPair: params.session.dpopKeyPair,
    method: "POST",
    url: tokenUrl,
    nonce: params.session.dpopNonce ?? undefined,
  });

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.session.redirectUri,
    client_id: params.session.clientId,
    code_verifier: params.session.codeVerifier,
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "DPoP": dpopProof,
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const error = await response.json() as { error: string; error_description?: string };
    throw new Error(`Token exchange failed: ${error.error} ${error.error_description ?? ""}`);
  }

  const dpopNonce = response.headers.get("DPoP-Nonce");
  if (dpopNonce) {
    params.session.dpopNonce = dpopNonce;
  }

  const tokenResponse = await response.json() as TokenResponse;

  if (!tokenResponse.scope?.includes("atproto")) {
    throw new Error("Server did not grant atproto scope");
  }

  return tokenResponse;
}

export interface RefreshTokensParams {
  refreshToken: string;
  issuer: string;
  dpopKeyPair: DpopKeyPair;
  dpopNonce?: string | null;
}

export async function refreshTokens(params: RefreshTokensParams): Promise<TokenResponse & { dpopNonce: string | null }> {
  const tokenUrl = `${params.issuer}/oauth/token`;

  const dpopProof = await createDpopProof({
    keyPair: params.dpopKeyPair,
    method: "POST",
    url: tokenUrl,
    nonce: params.dpopNonce ?? undefined,
  });

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: params.refreshToken,
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "DPoP": dpopProof,
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const error = await response.json() as { error: string; error_description?: string };
    throw new Error(`Token refresh failed: ${error.error} ${error.error_description ?? ""}`);
  }

  const dpopNonce = response.headers.get("DPoP-Nonce");
  const tokenResponse = await response.json() as TokenResponse;

  return { ...tokenResponse, dpopNonce };
}

export interface TokenManagerConfig {
  issuer: string;
  dpopKeyPair: DpopKeyPair;
  initialTokens: TokenResponse;
  dpopNonce?: string | null;
  onTokenRefresh?: (tokens: TokenResponse) => void;
}

export interface TokenManager {
  getAccessToken: () => Promise<string>;
  revoke: () => void;
}

export function createTokenManager(config: TokenManagerConfig): TokenManager {
  let currentTokens = config.initialTokens;
  let currentNonce = config.dpopNonce ?? null;
  let expiresAt = Date.now() + config.initialTokens.expires_in * 1000;
  let refreshPromise: Promise<void> | null = null;
  let revoked = false;

  async function refresh(): Promise<void> {
    if (!currentTokens.refresh_token) {
      throw new Error("No refresh token available");
    }

    const result = await refreshTokens({
      refreshToken: currentTokens.refresh_token,
      issuer: config.issuer,
      dpopKeyPair: config.dpopKeyPair,
      dpopNonce: currentNonce,
    });

    currentTokens = result;
    currentNonce = result.dpopNonce;
    expiresAt = Date.now() + result.expires_in * 1000;
    config.onTokenRefresh?.(result);
  }

  return {
    async getAccessToken(): Promise<string> {
      if (revoked) {
        throw new Error("Token manager has been revoked");
      }

      const bufferMs = 60_000;
      if (Date.now() + bufferMs >= expiresAt) {
        if (!refreshPromise) {
          refreshPromise = refresh().finally(() => { refreshPromise = null; });
        }
        await refreshPromise;
      }

      return currentTokens.access_token;
    },

    revoke(): void {
      revoked = true;
    },
  };
}
