import bcrypt from "bcrypt";
import { query } from "../db/pool.js";
import { generateDid, generateHandle } from "../utils/did.js";

const BCRYPT_ROUNDS = parseInt(process.env["BCRYPT_ROUNDS"] ?? "12", 10);

export interface CreateUserParams {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  did: string;
  handle: string;
  email: string;
  created_at: Date;
}

export async function createUser(params: CreateUserParams): Promise<AuthUser> {
  const { email, password } = params;

  if (!isValidEmail(email)) {
    throw new Error("Invalid email format");
  }

  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const existing = await query("SELECT id FROM users WHERE email = $1", [email]);
  if (existing.rows.length > 0) {
    throw new Error("Email already registered");
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const did = generateDid();
  const handle = generateHandle(email);

  const result = await query<AuthUser>(
    `INSERT INTO users (did, handle, email, password_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING id, did, handle, email, created_at`,
    [did, handle, email, passwordHash],
  );

  return result.rows[0]!;
}

export async function authenticateUser(
  email: string,
  password: string,
): Promise<AuthUser | null> {
  const result = await query<AuthUser & { password_hash: string }>(
    "SELECT id, did, handle, email, password_hash, created_at FROM users WHERE email = $1",
    [email],
  );

  if (result.rows.length === 0) {
    return null;
  }

  const user = result.rows[0]!;

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return null;
  }

  return {
    id: user.id,
    did: user.did,
    handle: user.handle,
    email: user.email,
    created_at: user.created_at,
  };
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
