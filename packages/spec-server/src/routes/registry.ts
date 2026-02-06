import { Hono } from "hono";
import { adminMiddleware } from "../middleware/admin.js";
import { registerApp, findAppByDid, listApprovedApps, revokeApp } from "../db/queries/app_registry.js";

export function registryRoutes() {
  const router = new Hono();

  router.post("/apps", adminMiddleware(), async (c) => {
    const body = await c.req.json<{
      did: string;
      name: string;
      publicKey: unknown;
      permissions: string[];
    }>();

    if (!body.did || !body.name || !body.publicKey || !body.permissions) {
      return c.json({ error: "invalid_request", error_description: "did, name, publicKey, and permissions are required" }, 400);
    }

    const app = await registerApp({
      did: body.did,
      name: body.name,
      publicKey: body.publicKey,
      permissions: body.permissions,
    });

    return c.json(app, 201);
  });

  router.get("/apps", async (c) => {
    const apps = await listApprovedApps();
    return c.json({ apps });
  });

  router.get("/apps/:did", async (c) => {
    const did = decodeURIComponent(c.req.param("did"));
    const app = await findAppByDid(did);

    if (!app) {
      return c.json({ error: "not_found", error_description: "App not found" }, 404);
    }

    return c.json(app);
  });

  router.delete("/apps/:did", adminMiddleware(), async (c) => {
    const did = decodeURIComponent(c.req.param("did"));
    const body = await c.req.json<{ reason?: string }>().catch(() => ({ reason: undefined }));
    const reason = body.reason ?? "No reason provided";

    const app = await revokeApp(did, reason, "admin");

    if (!app) {
      return c.json({ error: "not_found", error_description: "App not found" }, 404);
    }

    return c.json(app);
  });

  return router;
}
