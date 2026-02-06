import { query } from "../pool.js";

interface AppRegistryRow {
  did: string;
  name: string;
  public_key: unknown;
  permissions: unknown;
  approved_at: Date;
  revoked_at: Date | null;
  revocation_reason: string | null;
  revoked_by: string | null;
}

interface RegisterAppParams {
  did: string;
  name: string;
  publicKey: unknown;
  permissions: string[];
}

export async function registerApp(params: RegisterAppParams): Promise<AppRegistryRow> {
  const result = await query<AppRegistryRow>(
    `INSERT INTO app_registry (did, name, public_key, permissions)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (did) DO UPDATE SET
       name = EXCLUDED.name,
       public_key = EXCLUDED.public_key,
       permissions = EXCLUDED.permissions,
       revoked_at = NULL,
       revocation_reason = NULL,
       revoked_by = NULL
     RETURNING *`,
    [params.did, params.name, JSON.stringify(params.publicKey), JSON.stringify(params.permissions)],
  );

  return result.rows[0]!;
}

export async function findAppByDid(did: string): Promise<AppRegistryRow | null> {
  const result = await query<AppRegistryRow>(
    `SELECT * FROM app_registry WHERE did = $1`,
    [did],
  );

  return result.rows[0] ?? null;
}

export async function listApprovedApps(): Promise<AppRegistryRow[]> {
  const result = await query<AppRegistryRow>(
    `SELECT * FROM app_registry WHERE revoked_at IS NULL ORDER BY approved_at DESC`,
  );

  return result.rows;
}

export async function revokeApp(
  did: string,
  reason: string,
  revokedBy: string,
): Promise<AppRegistryRow | null> {
  const result = await query<AppRegistryRow>(
    `UPDATE app_registry
     SET revoked_at = now(), revocation_reason = $2, revoked_by = $3
     WHERE did = $1
     RETURNING *`,
    [did, reason, revokedBy],
  );

  return result.rows[0] ?? null;
}

export async function checkRevocationStatus(did: string): Promise<{ revoked: boolean; reason?: string }> {
  const result = await query<{ revoked_at: Date | null; revocation_reason: string | null }>(
    `SELECT revoked_at, revocation_reason FROM app_registry WHERE did = $1`,
    [did],
  );

  const row = result.rows[0];
  if (!row) return { revoked: true, reason: "App not found in registry" };
  if (row.revoked_at) return { revoked: true, reason: row.revocation_reason ?? undefined };
  return { revoked: false };
}
