import type { MiddlewareHandler } from "hono";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function csrfMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    if (SAFE_METHODS.has(c.req.method)) {
      await next();
      return;
    }

    const origin = c.req.header("Origin");
    const referer = c.req.header("Referer");
    const issuer = process.env["ISSUER_URL"] ?? "http://localhost:3000";
    const expected = new URL(issuer).origin;

    const requestOrigin = origin ?? (referer ? new URL(referer).origin : null);

    if (!requestOrigin || requestOrigin !== expected) {
      return c.json({ error: "invalid_request", error_description: "CSRF validation failed" }, 403);
    }

    await next();
  };
}
