export interface EloScore {
  overall: number;
  reading: number;
  vocabulary: number;
  listening: number;
  event_count: number;
}

export interface EloHistoryEntry {
  id: string;
  user_did: string;
  category: string;
  old_score: number;
  new_score: number;
  event_id: string | null;
  created_at: string;
}

export async function fetchEloScore(issuer: string, did: string): Promise<EloScore> {
  const response = await fetch(
    `${issuer}/scores/${encodeURIComponent(did)}`,
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch ELO score: ${response.statusText}`);
  }

  return response.json() as Promise<EloScore>;
}

export async function fetchEloHistory(
  issuer: string,
  did: string,
  limit?: number,
  offset?: number,
): Promise<{ history: EloHistoryEntry[] }> {
  const params = new URLSearchParams();
  if (limit) params.set("limit", limit.toString());
  if (offset) params.set("offset", offset.toString());

  const response = await fetch(
    `${issuer}/scores/${encodeURIComponent(did)}/history?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch ELO history: ${response.statusText}`);
  }

  return response.json() as Promise<{ history: EloHistoryEntry[] }>;
}
