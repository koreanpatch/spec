import { Hono } from "hono";
import { cors } from "hono/cors";
import { oauthRoutes } from "./routes/oauth.js";
import { wellKnownRoutes } from "./routes/well-known.js";
import { csrfMiddleware } from "./middleware/csrf.js";
import { rateLimitMiddleware } from "./middleware/rate-limit.js";

export type Env = {
  Variables: {
    dpopJkt: string;
    dpopNonce: string;
  };
};

export function createApp() {
  const app = new Hono<Env>();

  app.use("*", cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "DPoP"],
    exposeHeaders: ["DPoP-Nonce"],
  }));

  app.use("/oauth/*", rateLimitMiddleware({ windowMs: 60_000, maxRequests: 60 }));
  app.use("/oauth/*", csrfMiddleware());

  app.route("/.well-known", wellKnownRoutes());
  app.route("/oauth", oauthRoutes());

  return app;
}
