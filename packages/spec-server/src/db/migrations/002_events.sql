CREATE TABLE app_registry (
  did               text PRIMARY KEY,
  name              text NOT NULL,
  public_key        jsonb NOT NULL,
  permissions       jsonb NOT NULL DEFAULT '[]',
  approved_at       timestamptz NOT NULL DEFAULT now(),
  revoked_at        timestamptz,
  revocation_reason text,
  revoked_by        text
);

CREATE INDEX idx_app_registry_revoked ON app_registry (did) WHERE revoked_at IS NOT NULL;

CREATE TABLE event_cache (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_did       text NOT NULL,
  event_type     text NOT NULL,
  event_data     jsonb NOT NULL,
  app_did        text NOT NULL REFERENCES app_registry(did),
  signature      text NOT NULL,
  verified       boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_cache_user ON event_cache (user_did);
CREATE INDEX idx_event_cache_type ON event_cache (event_type);
CREATE INDEX idx_event_cache_created ON event_cache (created_at);

CREATE TABLE elo_scores (
  user_did         text PRIMARY KEY,
  overall_score    integer NOT NULL DEFAULT 1000,
  reading_score    integer NOT NULL DEFAULT 1000,
  vocabulary_score integer NOT NULL DEFAULT 1000,
  listening_score  integer NOT NULL DEFAULT 1000,
  event_count      integer NOT NULL DEFAULT 0,
  last_updated     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE elo_history (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_did       text NOT NULL,
  category       text NOT NULL,
  old_score      integer NOT NULL,
  new_score      integer NOT NULL,
  event_id       uuid REFERENCES event_cache(id),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_elo_history_user ON elo_history (user_did, created_at);

CREATE TABLE firehose_cursor (
  id             integer PRIMARY KEY DEFAULT 1,
  cursor_value   bigint NOT NULL DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

INSERT INTO firehose_cursor (id, cursor_value) VALUES (1, 0);
