import type { Context, MiddlewareHandler } from "hono";
import type { Env } from "../app.js";
import { verifyDpopProof } from "../crypto/dpop.js";

const NONCE_TTL_MS = 5 * 60 * 1000;

let currentNonce = generateNonce();
let nonceCreatedAt = Date.now();
let previousNonce: string | null = null;

export function generateNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

function rotateNonceIfNeeded(): string {
  if (Date.now() - nonceCreatedAt > NONCE_TTL_MS) {
    previousNonce = currentNonce;
    currentNonce = generateNonce();
    nonceCreatedAt = Date.now();
  }
  return currentNonce;
}

function isValidNonce(nonce: string): boolean {
  return nonce === currentNonce || nonce === previousNonce;
}

export function dpopMiddleware(): MiddlewareHandler<Env> {
  return async (c, next) => {
    const dpopHeader = c.req.header("DPoP");
    const activeNonce = rotateNonceIfNeeded();

    if (!dpopHeader) {
      c.header("DPoP-Nonce", activeNonce);
      return c.json({ error: "invalid_dpop_proof", error_description: "DPoP header required" }, 401);
    }

    const method = c.req.method;
    const url = new URL(c.req.url);
    const htu = `${url.origin}${url.pathname}`;

    const result = await verifyDpopProof(dpopHeader, method, htu);

    if (!result.valid) {
      c.header("DPoP-Nonce", activeNonce);
      return c.json({ error: "invalid_dpop_proof", error_description: result.reason }, 401);
    }

    if (result.nonce && !isValidNonce(result.nonce)) {
      c.header("DPoP-Nonce", activeNonce);
      return c.json({ error: "use_dpop_nonce", error_description: "DPoP nonce is stale or invalid" }, 400);
    }

    c.set("dpopJkt", result.jkt);
    c.set("dpopNonce", activeNonce);
    c.header("DPoP-Nonce", activeNonce);

    await next();
  };
}
