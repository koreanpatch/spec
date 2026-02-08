import { query } from "../pool.js";

interface UserRow {
  id: string;
  did: string;
  handle: string | null;
  created_at: Date;
}

interface UserWithEmailRow extends UserRow {
  email: string | null;
  password_hash: string | null;
}

export async function findOrCreateUser(did: string, handle?: string): Promise<UserRow> {
  const result = await query<UserRow>(
    `INSERT INTO users (did, handle)
     VALUES ($1, $2)
     ON CONFLICT (did) DO UPDATE SET did = EXCLUDED.did
     RETURNING *`,
    [did, handle ?? null],
  );

  return result.rows[0]!;
}

export async function findUserByDid(did: string): Promise<UserRow | null> {
  const result = await query<UserRow>(
    `SELECT * FROM users WHERE did = $1`,
    [did],
  );

  return result.rows[0] ?? null;
}

export async function findUserByEmail(email: string): Promise<UserWithEmailRow | null> {
  const result = await query<UserWithEmailRow>(
    `SELECT id, did, handle, email, password_hash, created_at FROM users WHERE email = $1`,
    [email],
  );

  return result.rows[0] ?? null;
}

export async function findUserById(id: string): Promise<UserRow | null> {
  const result = await query<UserRow>(
    `SELECT id, did, handle, created_at FROM users WHERE id = $1`,
    [id],
  );

  return result.rows[0] ?? null;
}
