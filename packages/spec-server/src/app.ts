import { Hono } from "hono";
import { cors } from "hono/cors";
import { oauthRoutes } from "./routes/oauth.js";
import { wellKnownRoutes } from "./routes/well-known.js";
import { registryRoutes } from "./routes/registry.js";
import { scoreRoutes } from "./routes/scores.js";
import { authUiRoutes } from "./routes/auth-ui.js";
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
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "DPoP"],
    exposeHeaders: ["DPoP-Nonce"],
  }));

  app.use("/oauth/*", rateLimitMiddleware({ windowMs: 60_000, maxRequests: 60 }));
  app.use("/oauth/*", csrfMiddleware());

  app.use("/registry/*", rateLimitMiddleware({ windowMs: 60_000, maxRequests: 30 }));

  app.route("/", authUiRoutes());
  app.route("/.well-known", wellKnownRoutes());
  app.route("/oauth", oauthRoutes());
  app.route("/registry", registryRoutes());
  app.route("/scores", scoreRoutes());

  return app;
}
