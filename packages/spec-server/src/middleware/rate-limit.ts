import type { MiddlewareHandler } from "hono";

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

interface WindowEntry {
  count: number;
  resetAt: number;
}

export function rateLimitMiddleware(config: RateLimitConfig): MiddlewareHandler {
  const windows = new Map<string, WindowEntry>();

  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of windows) {
      if (entry.resetAt <= now) {
        windows.delete(key);
      }
    }
  }, config.windowMs);

  return async (c, next) => {
    const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim()
      ?? c.req.header("x-real-ip")
      ?? "unknown";

    const now = Date.now();
    let entry = windows.get(ip);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + config.windowMs };
      windows.set(ip, entry);
    }

    entry.count++;

    c.header("X-RateLimit-Limit", config.maxRequests.toString());
    c.header("X-RateLimit-Remaining", Math.max(0, config.maxRequests - entry.count).toString());
    c.header("X-RateLimit-Reset", Math.ceil(entry.resetAt / 1000).toString());

    if (entry.count > config.maxRequests) {
      return c.json({ error: "rate_limit_exceeded" }, 429);
    }

    await next();
  };
}
