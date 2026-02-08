import { getOrCreateKeyPair, createDpopProof, clearKeys } from "./dpop";

const SPEC_ISSUER = "http://localhost:3000";
const CLIENT_ID = "http://localhost:3005/client-metadata.json";
const REDIRECT_URI = "http://localhost:3005/callback";

function base64urlEncode(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function generateRandom(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64urlEncode(bytes);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return base64urlEncode(hash);
}

interface AuthState {
  codeVerifier: string;
  state: string;
}

export async function startOAuthFlow(): Promise<void> {
  const codeVerifier = generateRandom();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateRandom();

  const { keyPair, publicJwk } = await getOrCreateKeyPair();

  const dpopProof = await createDpopProof(
    keyPair.privateKey,
    publicJwk,
    "POST",
    `${SPEC_ISSUER}/oauth/par`,
  );

  const parResponse = await fetch(`${SPEC_ISSUER}/oauth/par`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      DPoP: dpopProof,
    },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: "atproto transition:generic",
      response_type: "code",
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      state,
    }),
  });

  if (!parResponse.ok) {
    const text = await parResponse.text();
    throw new Error(`PAR failed (${parResponse.status}): ${text}`);
  }

  const { request_uri } = await parResponse.json();

  sessionStorage.setItem(
    "spec_oauth_state",
    JSON.stringify({ codeVerifier, state } satisfies AuthState),
  );

  const authorizeUrl = new URL(`${SPEC_ISSUER}/oauth/authorize`);
  authorizeUrl.searchParams.set("request_uri", request_uri);
  authorizeUrl.searchParams.set("client_id", CLIENT_ID);

  window.location.href = authorizeUrl.toString();
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  sub: string;
  scope: string;
}

export async function handleCallback(
  code: string,
  state: string,
): Promise<TokenResponse> {
  const storedJson = sessionStorage.getItem("spec_oauth_state");
  if (!storedJson) {
    throw new Error("No OAuth state found in session");
  }

  const authState: AuthState = JSON.parse(storedJson);

  if (authState.state !== state) {
    throw new Error("State mismatch - possible CSRF attack");
  }

  const { keyPair, publicJwk } = await getOrCreateKeyPair();

  const dpopProof = await createDpopProof(
    keyPair.privateKey,
    publicJwk,
    "POST",
    `${SPEC_ISSUER}/oauth/token`,
  );

  const tokenResponse = await fetch(`${SPEC_ISSUER}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      DPoP: dpopProof,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      code_verifier: authState.codeVerifier,
    }),
  });

  if (!tokenResponse.ok) {
    const text = await tokenResponse.text();
    throw new Error(`Token exchange failed (${tokenResponse.status}): ${text}`);
  }

  const tokens: TokenResponse = await tokenResponse.json();

  sessionStorage.removeItem("spec_oauth_state");

  return tokens;
}

export function logout(): void {
  localStorage.removeItem("spec_tokens");
  clearKeys();
}
