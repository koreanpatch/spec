import { query } from "../pool.js";

interface RefreshTokenRow {
  id: string;
  session_id: string;
  token_hash: string;
  dpop_jkt: string;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: Date;
  did: string;
  client_id: string;
  scope: string;
}

interface CreateRefreshTokenParams {
  sessionId: string;
  tokenHash: string;
  dpopJkt: string;
  expiresAt: Date;
}

export async function createRefreshToken(params: CreateRefreshTokenParams): Promise<void> {
  await query(
    `INSERT INTO refresh_tokens (session_id, token_hash, dpop_jkt, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [params.sessionId, params.tokenHash, params.dpopJkt, params.expiresAt],
  );
}

export async function findValidRefreshToken(tokenHash: string): Promise<RefreshTokenRow | null> {
  const result = await query<RefreshTokenRow>(
    `SELECT rt.*, s.did, s.client_id, s.scope
     FROM refresh_tokens rt
     JOIN sessions s ON s.id = rt.session_id
     WHERE rt.token_hash = $1
       AND rt.revoked_at IS NULL
       AND rt.expires_at > now()`,
    [tokenHash],
  );

  return result.rows[0] ?? null;
}

export async function revokeRefreshToken(tokenId: string): Promise<void> {
  await query(
    `UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1`,
    [tokenId],
  );
}

export async function revokeAllSessionTokens(sessionId: string): Promise<void> {
  await query(
    `UPDATE refresh_tokens SET revoked_at = now() WHERE session_id = $1 AND revoked_at IS NULL`,
    [sessionId],
  );
}
