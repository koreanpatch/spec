import {
  encryptField as sdkEncryptField,
  decryptField as sdkDecryptField,
  generateMasterKey as sdkGenerateMasterKey,
  exportMasterKeyMaterial,
  importMasterKeyMaterial,
  parseEncryptedEnvelope,
} from "spec-sdk";

export { exportMasterKeyMaterial, importMasterKeyMaterial } from "spec-sdk";

export async function generateMasterKey(): Promise<CryptoKey> {
  return sdkGenerateMasterKey();
}

export async function encryptField(
  plaintext: string,
  masterKey: CryptoKey,
  appDid: string,
): Promise<string> {
  return sdkEncryptField(plaintext, masterKey, appDid);
}

export interface DecryptFieldOptions {
  encrypted: string;
  masterKey: CryptoKey;
  userApprovedApps?: string[];
}

export async function decryptField(options: DecryptFieldOptions): Promise<string> {
  const envelope = parseEncryptedEnvelope(options.encrypted);

  if (options.userApprovedApps && !options.userApprovedApps.includes(envelope.appDid)) {
    throw new Error("You have not authorized this app to decrypt your data");
  }

  const result = await sdkDecryptField(options.encrypted, options.masterKey);
  return result.plaintext;
}

export interface AppReputation {
  trusted: boolean;
  reason?: string;
  revokedAt?: string;
}

export async function checkAppReputation(
  appDid: string,
  specIssuer: string,
): Promise<AppReputation> {
  try {
    const response = await fetch(
      `${specIssuer}/registry/apps/${encodeURIComponent(appDid)}`,
    );

    if (!response.ok) {
      return { trusted: false, reason: "App not in registry" };
    }

    const app = await response.json() as { revoked_at?: string; revocation_reason?: string };

    if (app.revoked_at) {
      return {
        trusted: false,
        reason: app.revocation_reason,
        revokedAt: app.revoked_at,
      };
    }

    return { trusted: true };
  } catch {
    return { trusted: false, reason: "Failed to check registry" };
  }
}
