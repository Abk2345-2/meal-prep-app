-- Auth: add Google OAuth identity fields to core.users.
-- email is unique per real user; google_sub is the stable Google subject ID.
-- provider is always 'google' for now; avatar_url is optional.

ALTER TABLE core.users
    ADD COLUMN IF NOT EXISTS email       TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS google_sub  TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS avatar_url  TEXT,
    ADD COLUMN IF NOT EXISTS provider    TEXT NOT NULL DEFAULT 'google';

CREATE INDEX IF NOT EXISTS users_google_sub_idx ON core.users (google_sub);
CREATE INDEX IF NOT EXISTS users_email_idx      ON core.users (email);
