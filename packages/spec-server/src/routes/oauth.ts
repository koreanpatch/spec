import { Hono, type Context } from "hono";
import { getCookie } from "hono/cookie";
import type { Env } from "../app.js";
import { dpopMiddleware, generateNonce } from "../middleware/dpop.js";
import { query } from "../db/pool.js";
import { createSession, findSessionByRequestUri, findSessionByCode, setAuthorizationCode } from "../db/queries/sessions.js";
import { createRefreshToken, findValidRefreshToken, revokeRefreshToken } from "../db/queries/tokens.js";
import { findOrCreateUser } from "../db/queries/users.js";
import { verifyCodeChallenge } from "../crypto/pkce.js";
import { signAccessToken, computeJktThumbprint } from "../crypto/jwt.js";

export function oauthRoutes() {
  const router = new Hono<Env>();

  router.post("/par", dpopMiddleware(), async (c) => {
    const body = await c.req.parseBody();

    const clientId = body["client_id"] as string;
    const redirectUri = body["redirect_uri"] as string;
    const responseType = body["response_type"] as string;
    const codeChallenge = body["code_challenge"] as string;
    const codeChallengeMethod = body["code_challenge_method"] as string;
    const scope = body["scope"] as string;
    const state = body["state"] as string;
    const loginHint = body["login_hint"] as string | undefined;

    if (responseType !== "code") {
      return c.json({ error: "unsupported_response_type" }, 400);
    }

    if (codeChallengeMethod !== "S256") {
      return c.json({ error: "invalid_request", error_description: "Only S256 code challenge method is supported" }, 400);
    }

    if (!scope?.includes("atproto")) {
      return c.json({ error: "invalid_scope", error_description: "atproto scope is required" }, 400);
    }

    const dpopJkt = c.get("dpopJkt");
    const requestUri = `urn:ietf:params:oauth:request_uri:${crypto.randomUUID()}`;
    const expiresIn = 90;

    await createSession({
      clientId,
      redirectUri,
      codeChallenge,
      codeChallengeMethod,
      scope,
      state,
      loginHint: loginHint ?? null,
      dpopJkt,
      requestUri,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    });

    c.header("DPoP-Nonce", generateNonce());
    return c.json({ request_uri: requestUri, expires_in: expiresIn }, 201);
  });

  router.get("/authorize", async (c) => {
    const requestUri = c.req.query("request_uri");
    const clientId = c.req.query("client_id");

    if (!requestUri) {
      return c.json({ error: "invalid_request", error_description: "Missing request_uri" }, 400);
    }

    const session = await findSessionByRequestUri(requestUri);

    if (!session) {
      return c.json({ error: "invalid_request", error_description: "Unknown or expired request_uri" }, 400);
    }

    if (clientId && session.client_id !== clientId) {
      return c.json({ error: "invalid_client" }, 400);
    }

    if (new Date(session.expires_at) < new Date()) {
      return c.json({ error: "expired_request_uri" }, 400);
    }

    const userId = getCookie(c, "spec_user");

    if (!userId) {
      return c.redirect(`/login?request_uri=${encodeURIComponent(requestUri)}`);
    }

    if (!session.authorized || session.user_id !== userId) {
      return c.redirect(`/consent?request_uri=${encodeURIComponent(requestUri)}`);
    }

    const authorizationCode = crypto.randomUUID();
    await setAuthorizationCode(session.id, authorizationCode);

    const redirectUrl = new URL(session.redirect_uri);
    redirectUrl.searchParams.set("code", authorizationCode);
    if (session.state) {
      redirectUrl.searchParams.set("state", session.state);
    }
    redirectUrl.searchParams.set("iss", process.env["ISSUER_URL"] ?? "http://localhost:3000");

    return c.redirect(redirectUrl.toString());
  });

  router.post("/token", dpopMiddleware(), async (c) => {
    const body = await c.req.parseBody();
    const grantType = body["grant_type"] as string;
    const dpopJkt = c.get("dpopJkt");

    if (grantType === "authorization_code") {
      return await handleAuthorizationCode(c, body, dpopJkt);
    }

    if (grantType === "refresh_token") {
      return await handleRefreshToken(c, body, dpopJkt);
    }

    return c.json({ error: "unsupported_grant_type" }, 400);
  });

  router.post("/introspect", dpopMiddleware(), async (c) => {
    const body = await c.req.parseBody();
    const token = body["token"] as string;

    if (!token) {
      return c.json({ active: false });
    }

    try {
      const { verifyAccessToken } = await import("../crypto/jwt.js");
      const payload = await verifyAccessToken(token);
      return c.json({
        active: true,
        sub: payload.sub,
        client_id: payload.client_id,
        scope: payload.scope,
        exp: payload.exp,
        iat: payload.iat,
        token_type: "DPoP",
      });
    } catch {
      return c.json({ active: false });
    }
  });

  return router;
}

async function handleAuthorizationCode(
  c: Context<Env>,
  body: Record<string, string | File>,
  dpopJkt: string,
) {
  const code = body["code"] as string;
  const codeVerifier = body["code_verifier"] as string;
  const redirectUri = body["redirect_uri"] as string;
  const clientId = body["client_id"] as string;

  if (!code || !codeVerifier || !redirectUri || !clientId) {
    return c.json({ error: "invalid_request" }, 400);
  }

  const session = await findSessionByCode(code);

  if (!session) {
    return c.json({ error: "invalid_grant" }, 400);
  }

  if (session.client_id !== clientId || session.redirect_uri !== redirectUri) {
    return c.json({ error: "invalid_grant" }, 400);
  }

  if (session.dpop_jkt !== dpopJkt) {
    return c.json({ error: "invalid_dpop_proof" }, 400);
  }

  const challengeValid = await verifyCodeChallenge(codeVerifier, session.code_challenge);
  if (!challengeValid) {
    return c.json({ error: "invalid_grant", error_description: "PKCE verification failed" }, 400);
  }

  const userDid = session.login_hint ?? session.did ?? `did:plc:${crypto.randomUUID()}`;
  const user = await findOrCreateUser(userDid);

  const accessToken = await signAccessToken({
    sub: user.did,
    client_id: session.client_id,
    scope: session.scope,
    jkt: dpopJkt,
  });

  const refreshTokenValue = crypto.randomUUID();
  await createRefreshToken({
    sessionId: session.id,
    tokenHash: await hashToken(refreshTokenValue),
    dpopJkt,
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  });

  c.header("DPoP-Nonce", generateNonce());
  return c.json({
    access_token: accessToken,
    token_type: "DPoP",
    expires_in: 900,
    refresh_token: refreshTokenValue,
    sub: user.did,
    scope: session.scope,
  });
}

async function handleRefreshToken(
  c: Context<Env>,
  body: Record<string, string | File>,
  dpopJkt: string,
) {
  const refreshToken = body["refresh_token"] as string;

  if (!refreshToken) {
    return c.json({ error: "invalid_request" }, 400);
  }

  const tokenHash = await hashToken(refreshToken);
  const existing = await findValidRefreshToken(tokenHash);

  if (!existing) {
    return c.json({ error: "invalid_grant" }, 400);
  }

  if (existing.dpop_jkt !== dpopJkt) {
    return c.json({ error: "invalid_dpop_proof" }, 400);
  }

  await revokeRefreshToken(existing.id);

  const accessToken = await signAccessToken({
    sub: existing.did,
    client_id: existing.client_id,
    scope: existing.scope,
    jkt: dpopJkt,
  });

  const newRefreshTokenValue = crypto.randomUUID();
  await createRefreshToken({
    sessionId: existing.session_id,
    tokenHash: await hashToken(newRefreshTokenValue),
    dpopJkt,
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  });

  c.header("DPoP-Nonce", generateNonce());
  return c.json({
    access_token: accessToken,
    token_type: "DPoP",
    expires_in: 900,
    refresh_token: newRefreshTokenValue,
    sub: existing.did,
    scope: existing.scope,
  });
}

async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Buffer.from(hash).toString("base64url");
}
