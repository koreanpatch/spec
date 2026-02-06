import type { MiddlewareHandler } from "hono";

export function adminMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const adminToken = process.env["ADMIN_TOKEN"];

    if (!adminToken) {
      return c.json({ error: "server_error", error_description: "ADMIN_TOKEN not configured" }, 500);
    }

    const authHeader = c.req.header("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ error: "unauthorized", error_description: "Bearer token required" }, 401);
    }

    const token = authHeader.slice(7);

    if (token !== adminToken) {
      return c.json({ error: "forbidden", error_description: "Invalid admin token" }, 403);
    }

    await next();
  };
}
