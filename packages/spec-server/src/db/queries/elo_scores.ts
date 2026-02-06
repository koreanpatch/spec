import { query } from "../pool.js";

interface EloScoreRow {
  user_did: string;
  overall_score: number;
  reading_score: number;
  vocabulary_score: number;
  listening_score: number;
  event_count: number;
  last_updated: Date;
}

interface EloHistoryRow {
  id: string;
  user_did: string;
  category: string;
  old_score: number;
  new_score: number;
  event_id: string | null;
  created_at: Date;
}

export async function getScore(userDid: string): Promise<EloScoreRow | null> {
  const result = await query<EloScoreRow>(
    `SELECT * FROM elo_scores WHERE user_did = $1`,
    [userDid],
  );

  return result.rows[0] ?? null;
}

export async function getOrCreateScore(userDid: string): Promise<EloScoreRow> {
  const result = await query<EloScoreRow>(
    `INSERT INTO elo_scores (user_did)
     VALUES ($1)
     ON CONFLICT (user_did) DO NOTHING
     RETURNING *`,
    [userDid],
  );

  if (result.rows[0]) return result.rows[0];
  return (await getScore(userDid))!;
}

export async function updateScore(
  userDid: string,
  category: "overall_score" | "reading_score" | "vocabulary_score" | "listening_score",
  newScore: number,
): Promise<void> {
  await query(
    `UPDATE elo_scores
     SET ${category} = $2, event_count = event_count + 1, last_updated = now()
     WHERE user_did = $1`,
    [userDid, newScore],
  );
}

export async function updateOverallScore(userDid: string): Promise<void> {
  await query(
    `UPDATE elo_scores
     SET overall_score = ROUND((reading_score + vocabulary_score + listening_score) / 3.0)::integer,
         last_updated = now()
     WHERE user_did = $1`,
    [userDid],
  );
}

export async function insertScoreHistory(
  userDid: string,
  category: string,
  oldScore: number,
  newScore: number,
  eventId: string,
): Promise<void> {
  await query(
    `INSERT INTO elo_history (user_did, category, old_score, new_score, event_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [userDid, category, oldScore, newScore, eventId],
  );
}

export async function getScoreHistory(
  userDid: string,
  limit: number = 50,
  offset: number = 0,
): Promise<EloHistoryRow[]> {
  const result = await query<EloHistoryRow>(
    `SELECT * FROM elo_history
     WHERE user_did = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [userDid, limit, offset],
  );

  return result.rows;
}
