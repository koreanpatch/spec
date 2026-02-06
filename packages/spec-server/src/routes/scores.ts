import { Hono } from "hono";
import { getScore, getScoreHistory } from "../db/queries/elo_scores.js";

export function scoreRoutes() {
  const router = new Hono();

  router.get("/:did", async (c) => {
    const did = decodeURIComponent(c.req.param("did"));
    const score = await getScore(did);

    if (!score) {
      return c.json({
        overall: 1000,
        reading: 1000,
        vocabulary: 1000,
        listening: 1000,
        event_count: 0,
      });
    }

    return c.json({
      overall: score.overall_score,
      reading: score.reading_score,
      vocabulary: score.vocabulary_score,
      listening: score.listening_score,
      event_count: score.event_count,
    });
  });

  router.get("/:did/history", async (c) => {
    const did = decodeURIComponent(c.req.param("did"));
    const limit = Math.min(parseInt(c.req.query("limit") ?? "50", 10), 100);
    const offset = parseInt(c.req.query("offset") ?? "0", 10);

    const history = await getScoreHistory(did, limit, offset);

    return c.json({ history });
  });

  return router;
}
