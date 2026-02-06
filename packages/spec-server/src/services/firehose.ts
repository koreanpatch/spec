import { WebSocket } from "ws";
import { decode } from "cbor-x";
import { query } from "../db/pool.js";
import { verifyEventRecord } from "./verifier.js";
import { processVerifiedEvent } from "./elo.js";

const EVENT_PREFIX = "tools.spec.event.";
const CURSOR_BATCH_INTERVAL = 5_000;
const MAX_RECONNECT_DELAY = 60_000;
const BASE_RECONNECT_DELAY = 1_000;

interface FirehoseConfig {
  relayUrl: string;
}

interface CommitOp {
  action: string;
  path: string;
  cid: unknown;
}

interface CommitMessage {
  $type: string;
  seq: number;
  repo: string;
  ops: CommitOp[];
  blocks: Uint8Array;
  commit: unknown;
}

let latestCursor = 0;
let cursorDirty = false;

async function loadCursor(): Promise<number> {
  const result = await query<{ cursor_value: string }>(
    `SELECT cursor_value::text FROM firehose_cursor WHERE id = 1`,
  );
  return parseInt(result.rows[0]?.cursor_value ?? "0", 10);
}

async function persistCursor(cursor: number): Promise<void> {
  await query(
    `UPDATE firehose_cursor SET cursor_value = $1, updated_at = now() WHERE id = 1`,
    [cursor],
  );
}

function extractCollection(path: string): string {
  const parts = path.split("/");
  return parts.slice(0, -1).join("/");
}

async function handleCommit(message: CommitMessage): Promise<void> {
  for (const op of message.ops) {
    if (op.action !== "create") continue;

    const collection = extractCollection(op.path);
    if (!collection.startsWith(EVENT_PREFIX)) continue;

    let record: Record<string, unknown>;
    try {
      const blocks = decode(message.blocks) as Record<string, unknown>;
      record = blocks as Record<string, unknown>;
    } catch {
      process.stdout.write(`[firehose] Failed to decode blocks for ${op.path}\n`);
      continue;
    }

    const verification = await verifyEventRecord(record, collection);

    if (!verification.valid) {
      process.stdout.write(`[firehose] Rejected ${collection} from ${message.repo}: ${verification.reason}\n`);
      continue;
    }

    await processVerifiedEvent({
      userDid: message.repo,
      eventType: collection,
      eventData: record,
      appDid: verification.appDid!,
      signature: record["signature"] as string,
    });

    process.stdout.write(`[firehose] Processed ${collection} for ${message.repo}\n`);
  }

  latestCursor = message.seq;
  cursorDirty = true;
}

function startCursorPersistence(): NodeJS.Timeout {
  return setInterval(async () => {
    if (!cursorDirty) return;
    try {
      await persistCursor(latestCursor);
      cursorDirty = false;
    } catch (err) {
      process.stderr.write(`[firehose] Failed to persist cursor: ${err}\n`);
    }
  }, CURSOR_BATCH_INTERVAL);
}

export async function startFirehose(config: FirehoseConfig): Promise<void> {
  const cursor = await loadCursor();
  latestCursor = cursor;

  const cursorInterval = startCursorPersistence();
  let reconnectDelay = BASE_RECONNECT_DELAY;

  function connect() {
    const url = `${config.relayUrl}/xrpc/com.atproto.sync.subscribeRepos?cursor=${latestCursor}`;
    process.stdout.write(`[firehose] Connecting to ${url}\n`);

    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";

    ws.on("open", () => {
      process.stdout.write("[firehose] Connected\n");
      reconnectDelay = BASE_RECONNECT_DELAY;
    });

    ws.on("message", async (data: ArrayBuffer) => {
      try {
        const message = decode(new Uint8Array(data)) as CommitMessage;
        if (message.$type === "#commit" && message.ops) {
          await handleCommit(message);
        }
      } catch (err) {
        process.stderr.write(`[firehose] Message processing error: ${err}\n`);
      }
    });

    ws.on("close", () => {
      process.stdout.write(`[firehose] Disconnected, reconnecting in ${reconnectDelay}ms\n`);
      setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
    });

    ws.on("error", (err) => {
      process.stderr.write(`[firehose] WebSocket error: ${err.message}\n`);
      ws.close();
    });
  }

  connect();

  process.on("SIGTERM", async () => {
    clearInterval(cursorInterval);
    if (cursorDirty) {
      await persistCursor(latestCursor);
    }
    process.exit(0);
  });
}
