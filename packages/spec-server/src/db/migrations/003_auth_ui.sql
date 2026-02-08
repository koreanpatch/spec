ALTER TABLE users ADD COLUMN email text UNIQUE;
ALTER TABLE users ADD COLUMN password_hash text;
ALTER TABLE users ADD COLUMN email_verified boolean NOT NULL DEFAULT false;

CREATE INDEX idx_users_email ON users (email);

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'atproto transition:generic';
ALTER TABLE sessions ADD COLUMN authorized boolean NOT NULL DEFAULT false;
