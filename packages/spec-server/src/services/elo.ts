import { getOrCreateScore, updateScore, updateOverallScore, insertScoreHistory } from "../db/queries/elo_scores.js";
import { insertVerifiedEvent } from "../db/queries/events.js";

const K_FACTOR = 32;
const DEFAULT_DIFFICULTY = 1000;

type ScoreCategory = "reading_score" | "vocabulary_score" | "listening_score";

const EVENT_CATEGORY_MAP: Record<string, { primary: ScoreCategory; secondary?: ScoreCategory }> = {
  "tools.spec.event.word.saved": { primary: "vocabulary_score" },
  "tools.spec.event.sentence.read": { primary: "reading_score" },
  "tools.spec.event.book.completed": { primary: "reading_score", secondary: "vocabulary_score" },
  "tools.spec.event.course.completed": { primary: "reading_score" },
  "tools.spec.event.anki.reviewed": { primary: "vocabulary_score" },
};

export function calculateEloChange(
  currentScore: number,
  eventDifficulty: number,
  success: boolean,
): number {
  const expectedScore = 1 / (1 + Math.pow(10, (eventDifficulty - currentScore) / 400));
  const actualScore = success ? 1 : 0;
  return Math.round(K_FACTOR * (actualScore - expectedScore));
}

interface VerifiedEvent {
  userDid: string;
  eventType: string;
  eventData: Record<string, unknown>;
  appDid: string;
  signature: string;
}

export async function processVerifiedEvent(event: VerifiedEvent): Promise<void> {
  const stored = await insertVerifiedEvent({
    userDid: event.userDid,
    eventType: event.eventType,
    eventData: event.eventData,
    appDid: event.appDid,
    signature: event.signature,
    verified: true,
  });

  const mapping = EVENT_CATEGORY_MAP[event.eventType];
  if (!mapping) return;

  const score = await getOrCreateScore(event.userDid);
  const difficulty = (event.eventData["difficulty"] as number) ?? DEFAULT_DIFFICULTY;
  const success = true;

  const primaryOld = score[mapping.primary];
  const primaryDelta = calculateEloChange(primaryOld, difficulty, success);
  const primaryNew = Math.max(0, primaryOld + primaryDelta);

  await updateScore(event.userDid, mapping.primary, primaryNew);
  await insertScoreHistory(event.userDid, mapping.primary, primaryOld, primaryNew, stored.id);

  if (mapping.secondary) {
    const secondaryOld = score[mapping.secondary];
    const secondaryDelta = Math.round(calculateEloChange(secondaryOld, difficulty, success) * 0.5);
    const secondaryNew = Math.max(0, secondaryOld + secondaryDelta);

    await updateScore(event.userDid, mapping.secondary, secondaryNew);
    await insertScoreHistory(event.userDid, mapping.secondary, secondaryOld, secondaryNew, stored.id);
  }

  await updateOverallScore(event.userDid);
}
