CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  did        text UNIQUE NOT NULL,
  handle     text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_did ON users (did);

CREATE TABLE sessions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid REFERENCES users(id) ON DELETE CASCADE,
  client_id             text NOT NULL,
  dpop_jkt              text NOT NULL,
  scope                 text NOT NULL,
  code_challenge        text NOT NULL,
  code_challenge_method text NOT NULL DEFAULT 'S256',
  redirect_uri          text NOT NULL,
  state                 text NOT NULL,
  login_hint            text,
  did                   text,
  request_uri           text UNIQUE NOT NULL,
  code                  text UNIQUE,
  expires_at            timestamptz NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_request_uri ON sessions (request_uri);
CREATE INDEX idx_sessions_code ON sessions (code);

CREATE TABLE refresh_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  token_hash  text UNIQUE NOT NULL,
  dpop_jkt    text NOT NULL,
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens (token_hash);
CREATE INDEX idx_refresh_tokens_session ON refresh_tokens (session_id);
