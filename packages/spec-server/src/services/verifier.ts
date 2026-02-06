import { verifyRecord, importEcPublicKey, type stringToJwk } from "spec-sdk";
import { findAppByDid } from "../db/queries/app_registry.js";

export interface VerificationResult {
  valid: boolean;
  reason?: string;
  appDid?: string;
}

export async function verifyEventRecord(
  record: Record<string, unknown>,
  eventType: string,
): Promise<VerificationResult> {
  const appDid = record["appDid"];
  if (typeof appDid !== "string") {
    return { valid: false, reason: "Missing appDid field" };
  }

  const app = await findAppByDid(appDid);
  if (!app) {
    return { valid: false, reason: `App ${appDid} not found in registry` };
  }

  if (app.revoked_at) {
    return { valid: false, reason: `App ${appDid} was revoked: ${app.revocation_reason}` };
  }

  const permissions = app.permissions as string[];
  const shortType = eventType.replace("tools.spec.event.", "");
  if (!permissions.includes(shortType) && !permissions.includes("*")) {
    return { valid: false, reason: `App ${appDid} lacks permission for ${shortType}` };
  }

  let publicKey: CryptoKey;
  try {
    const jwk = app.public_key as JsonWebKey;
    publicKey = await importEcPublicKey(jwk);
  } catch {
    return { valid: false, reason: `Failed to import public key for ${appDid}` };
  }

  const isValid = await verifyRecord(record, publicKey);
  if (!isValid) {
    return { valid: false, reason: "Signature verification failed" };
  }

  return { valid: true, appDid };
}
