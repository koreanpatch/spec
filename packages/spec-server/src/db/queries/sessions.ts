import { query } from "../pool.js";

interface SessionRow {
  id: string;
  user_id: string | null;
  client_id: string;
  dpop_jkt: string;
  scope: string;
  code_challenge: string;
  code_challenge_method: string;
  redirect_uri: string;
  state: string;
  login_hint: string | null;
  did: string | null;
  request_uri: string;
  code: string | null;
  expires_at: Date;
  created_at: Date;
}

interface CreateSessionParams {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  scope: string;
  state: string;
  loginHint: string | null;
  dpopJkt: string;
  requestUri: string;
  expiresAt: Date;
}

export async function createSession(params: CreateSessionParams): Promise<SessionRow> {
  const result = await query<SessionRow>(
    `INSERT INTO sessions
       (client_id, redirect_uri, code_challenge, code_challenge_method, scope, state, login_hint, dpop_jkt, request_uri, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      params.clientId,
      params.redirectUri,
      params.codeChallenge,
      params.codeChallengeMethod,
      params.scope,
      params.state,
      params.loginHint,
      params.dpopJkt,
      params.requestUri,
      params.expiresAt,
    ],
  );

  return result.rows[0]!;
}

export async function findSessionByRequestUri(requestUri: string): Promise<SessionRow | null> {
  const result = await query<SessionRow>(
    `SELECT * FROM sessions WHERE request_uri = $1`,
    [requestUri],
  );

  return result.rows[0] ?? null;
}

export async function findSessionByCode(code: string): Promise<SessionRow | null> {
  const result = await query<SessionRow>(
    `SELECT * FROM sessions WHERE code = $1`,
    [code],
  );

  return result.rows[0] ?? null;
}

export async function markSessionAuthorized(sessionId: string, code: string): Promise<void> {
  await query(
    `UPDATE sessions SET code = $1 WHERE id = $2`,
    [code, sessionId],
  );
}
