import { serve } from "@hono/node-server";
import { createApp } from "./app.js";

const PORT = parseInt(process.env["PORT"] ?? "3000", 10);

const app = createApp();

serve({ fetch: app.fetch, port: PORT }, (info) => {
  process.stdout.write(`spec-server listening on :${info.port}\n`);
});
