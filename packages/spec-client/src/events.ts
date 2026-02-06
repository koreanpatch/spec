import { signRecord } from "spec-sdk";

export interface WriteEventOptions {
  userDid: string;
  collection: string;
  record: Record<string, unknown>;
  appPrivateKey: CryptoKey;
  pdsUrl: string;
  accessToken: string;
  dpopProof: string;
}

export async function writeSignedEvent(options: WriteEventOptions): Promise<{ uri: string; cid: string }> {
  const signed = await signRecord(options.record, options.appPrivateKey);

  const response = await fetch(`${options.pdsUrl}/xrpc/com.atproto.repo.createRecord`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `DPoP ${options.accessToken}`,
      "DPoP": options.dpopProof,
    },
    body: JSON.stringify({
      repo: options.userDid,
      collection: options.collection,
      record: signed,
    }),
  });

  if (!response.ok) {
    const error = await response.json() as { error?: string; message?: string };
    throw new Error(`Failed to write event: ${error.error ?? error.message ?? response.statusText}`);
  }

  return response.json() as Promise<{ uri: string; cid: string }>;
}

export interface ListEventsOptions {
  userDid: string;
  collection: string;
  pdsUrl: string;
  accessToken: string;
  dpopProof: string;
  limit?: number;
  cursor?: string;
}

export async function listEvents(options: ListEventsOptions): Promise<{
  records: Array<{ uri: string; cid: string; value: Record<string, unknown> }>;
  cursor?: string;
}> {
  const params = new URLSearchParams({
    repo: options.userDid,
    collection: options.collection,
    limit: (options.limit ?? 50).toString(),
  });
  if (options.cursor) params.set("cursor", options.cursor);

  const response = await fetch(
    `${options.pdsUrl}/xrpc/com.atproto.repo.listRecords?${params.toString()}`,
    {
      headers: {
        "Authorization": `DPoP ${options.accessToken}`,
        "DPoP": options.dpopProof,
      },
    },
  );

  if (!response.ok) {
    const error = await response.json() as { error?: string; message?: string };
    throw new Error(`Failed to list events: ${error.error ?? error.message ?? response.statusText}`);
  }

  return response.json() as Promise<{
    records: Array<{ uri: string; cid: string; value: Record<string, unknown> }>;
    cursor?: string;
  }>;
}
