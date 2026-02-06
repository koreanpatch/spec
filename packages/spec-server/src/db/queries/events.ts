import { query } from "../pool.js";

interface EventCacheRow {
  id: string;
  user_did: string;
  event_type: string;
  event_data: unknown;
  app_did: string;
  signature: string;
  verified: boolean;
  created_at: Date;
}

interface InsertEventParams {
  userDid: string;
  eventType: string;
  eventData: unknown;
  appDid: string;
  signature: string;
  verified: boolean;
}

export async function insertVerifiedEvent(params: InsertEventParams): Promise<EventCacheRow> {
  const result = await query<EventCacheRow>(
    `INSERT INTO event_cache (user_did, event_type, event_data, app_did, signature, verified)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [params.userDid, params.eventType, JSON.stringify(params.eventData), params.appDid, params.signature, params.verified],
  );

  return result.rows[0]!;
}

export async function findEventsByDid(
  userDid: string,
  limit: number = 50,
  offset: number = 0,
): Promise<EventCacheRow[]> {
  const result = await query<EventCacheRow>(
    `SELECT * FROM event_cache
     WHERE user_did = $1 AND verified = true
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [userDid, limit, offset],
  );

  return result.rows;
}

export async function countEventsByDid(userDid: string): Promise<number> {
  const result = await query<{ count: string }>(
    `SELECT count(*)::text as count FROM event_cache WHERE user_did = $1 AND verified = true`,
    [userDid],
  );

  return parseInt(result.rows[0]?.count ?? "0", 10);
}
