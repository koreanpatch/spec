import { Hono } from "hono";

function issuerUrl(): string {
  return process.env["ISSUER_URL"] ?? "http://localhost:3000";
}

export function wellKnownRoutes() {
  const router = new Hono();

  router.get("/oauth-authorization-server", (c) => {
    const issuer = issuerUrl();

    return c.json({
      issuer,
      authorization_endpoint: `${issuer}/oauth/authorize`,
      token_endpoint: `${issuer}/oauth/token`,
      pushed_authorization_request_endpoint: `${issuer}/oauth/par`,
      introspection_endpoint: `${issuer}/oauth/introspect`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none", "private_key_jwt"],
      token_endpoint_auth_signing_alg_values_supported: ["ES256"],
      scopes_supported: ["atproto", "transition:generic"],
      dpop_signing_alg_values_supported: ["ES256"],
      authorization_response_iss_parameter_supported: true,
      require_pushed_authorization_requests: true,
      client_id_metadata_document_supported: true,
    });
  });

  router.get("/oauth-protected-resource", (c) => {
    const issuer = issuerUrl();

    return c.json({
      resource: issuer,
      authorization_servers: [issuer],
    });
  });

  return router;
}
