import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { startFirehose } from "./services/firehose.js";

const PORT = parseInt(process.env["PORT"] ?? "3000", 10);
const RELAY_URL = process.env["RELAY_URL"] ?? "wss://bsky.network";

const app = createApp();

serve({ fetch: app.fetch, port: PORT }, (info) => {
  process.stdout.write(`spec-server listening on :${info.port}\n`);

  if (process.env["ENABLE_FIREHOSE"] !== "false") {
    startFirehose({ relayUrl: RELAY_URL }).catch((err) => {
      process.stderr.write(`Firehose startup failed: ${err}\n`);
    });
  }
});
